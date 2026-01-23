import { blueskyService } from './services/blueskyService.js';
import { llmService } from './services/llmService.js';
import { dataStore } from './services/dataStore.js';
import { googleSearchService } from './services/googleSearchService.js';
import { imageService } from './services/imageService.js';
import { youtubeService } from './services/youtubeService.js';
import { wikipediaService } from './services/wikipediaService.js';
import { handleCommand } from './utils/commandHandler.js';
import { postYouTubeReply } from './utils/replyUtils.js';
import { sanitizeDuplicateText, sanitizeThinkingTags } from './utils/textUtils.js';
import config from '../config.js';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';

export class Bot {
  constructor() {
    this.readmeContent = '';
    this.paused = false;
    this.proposedPosts = [];
    this.firehoseProcess = null;
  }

  async init() {
    await dataStore.init();
    await blueskyService.authenticate();
    await blueskyService.submitAutonomyDeclaration();
    try {
      this.readmeContent = await fs.readFile('README.md', 'utf-8');
      console.log('[Bot] README.md loaded for self-awareness.');
    } catch (error) {
      console.error('[Bot] Error loading README.md:', error);
    }
  }

  startFirehose() {
    console.log('[Bot] Starting Firehose monitor...');
    const firehosePath = path.resolve(process.cwd(), 'firehose_monitor.py');
    const command = `python3 -m pip install --break-system-packages -r requirements.txt && python3 ${firehosePath}`;
    this.firehoseProcess = spawn(command, { shell: true });

    this.firehoseProcess.stdout.on('data', async (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === 'firehose_mention') {
            console.log(`[Bot] Firehose mention detected: ${event.uri}`);
            if (dataStore.hasReplied(event.uri)) continue;
            
            // Resolve handle for the author DID
            const profile = await blueskyService.getProfile(event.author.did);
            const notif = {
              uri: event.uri,
              cid: event.cid,
              author: profile,
              record: event.record,
              reason: event.reason,
              indexedAt: new Date().toISOString()
            };
            
            await this.processNotification(notif);
            await dataStore.addRepliedPost(notif.uri);
          }
        } catch (e) {
          // Ignore non-JSON output
        }
      }
    });

    this.firehoseProcess.stderr.on('data', (data) => {
      console.error(`[Firehose Monitor] ${data.toString().trim()}`);
    });

    this.firehoseProcess.on('close', (code) => {
      console.log(`[Bot] Firehose monitor exited with code ${code}. Restarting in 10s...`);
      setTimeout(() => this.startFirehose(), 10000);
    });
  }

  async run() {
    console.log('[Bot] Starting main loop...');

    // Start Firehose immediately for real-time DID mentions
    this.startFirehose();

    // Run catch-up once on startup to process missed notifications
    await this.catchUpNotifications();

    // Run cleanup on startup
    await this.cleanupOldPosts();

    // Perform an autonomous post on startup after a delay to avoid initial API burst
    setTimeout(async () => {
      try {
        await this.performAutonomousPost();
      } catch (e) {
        console.error('[Bot] Error in initial autonomous post:', e);
      }
    }, 30000); // 30 second delay

    // Periodic autonomous post check
    setInterval(() => this.performAutonomousPost(), 3600000 * 3); // Every 3 hours

    console.log('[Bot] Startup complete. Listening for real-time events via Firehose.');
  }

  async catchUpNotifications() {
    console.log('[Bot] Catching up on missed notifications...');
    let cursor;
    let notificationsCaughtUp = 0;

    do {
      const response = await blueskyService.getNotifications(cursor);
      if (!response || response.notifications.length === 0) {
        break;
      }

      for (const notif of response.notifications) {
        // Only process mentions, replies, and quotes that are unread
        const isActionable = ['mention', 'reply', 'quote'].includes(notif.reason);

        if (notif.isRead || !isActionable) {
          continue;
        }

        if (dataStore.hasReplied(notif.uri)) {
          continue;
        }

        console.log(`[Bot] Found missed notification: ${notif.uri}`);
        // Mark the notification as "replied" immediately to prevent a race condition
        // with the real-time Firehose stream.
        await dataStore.addRepliedPost(notif.uri);
        notificationsCaughtUp++;

        // Now, process the notification sequentially with a delay to avoid API overload
        try {
          await this.processNotification(notif);
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
          console.error(`[Bot] Error processing notification ${notif.uri}:`, error);
        }
      }
      cursor = response.cursor;
    } while (cursor);

    if (notificationsCaughtUp > 0) {
      console.log(`[Bot] Finished catching up. Processed ${notificationsCaughtUp} new notifications.`);
      // Mark notifications as seen after processing them
      await blueskyService.updateSeen();
    } else {
      console.log('[Bot] No new notifications to catch up on.');
    }
  }

  async processNotification(notif) {
    try {
      // Self-reply loop prevention
      if (notif.author.handle === config.BLUESKY_IDENTIFIER) {
        console.log(`[Bot] Skipping notification from self to prevent loop.`);
        return;
      }

      const handle = notif.author.handle;
      const text = notif.record.text || '';
      const threadRootUri = notif.record.reply?.root?.uri || notif.uri;

      // Time-Based Reply Filter
      const postDate = new Date(notif.indexedAt);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (postDate < thirtyDaysAgo) {
      console.log(`[Bot] Skipping notification older than 30 days.`);
      return;
    }

    // 1. Thread History Fetching (Centralized)
    const threadData = await this._getThreadHistory(notif.uri);
    let threadContext = threadData.map(h => ({ author: h.author, text: h.text }));
    const ancestorUris = threadData.map(h => h.uri).filter(uri => uri);

    if (notif.reason === 'quote') {
        console.log(`[Bot] Notification is a quote repost. Reconstructing context...`);
        const quotedPostUri = notif.record.embed?.record?.uri;
        if (quotedPostUri) {
            const quotedPost = await blueskyService.getPostDetails(quotedPostUri);
            if (quotedPost) {
                let quotedText = quotedPost.record.text || '';
                const quotedEmbed = quotedPost.record.embed;
                if (quotedEmbed && quotedEmbed.$type === 'app.bsky.embed.images' && quotedEmbed.images) {
                    for (const image of quotedEmbed.images) {
                        if (image.alt) {
                            quotedText += ` [Image with alt text: "${image.alt}"]`;
                        }
                    }
                }
                // Manually construct the context for the LLM
                threadContext = [
                    { author: config.BLUESKY_IDENTIFIER, text: quotedText.trim() },
                    { author: handle, text: text }
                ];
                console.log(`[Bot] Reconstructed context for quote repost.`);
            }
        }
    }

    // Prompt injection filter removed per user request.


    // 2. Refined Reply Trigger Logic
    const botMentioned = text.includes(config.BLUESKY_IDENTIFIER) || config.BOT_NICKNAMES.some(nick => text.includes(nick)) || text.includes(blueskyService.did);
    const isQuoteRepost = notif.reason === 'quote';

    // Check if the reply is to one of the bot's own posts.
    const parentPost = threadContext.length > 1 ? threadContext[threadContext.length - 2] : null;
    const isReplyToBot = parentPost && parentPost.author === config.BLUESKY_IDENTIFIER;

    if (!botMentioned && !isReplyToBot && !isQuoteRepost) {
      console.log(`[Bot] Not a mention, reply to self, or quote repost. Skipping.`);
      return;
    }

    // 2. Check Blocklist
    if (dataStore.isBlocked(handle)) {
      console.log(`[Bot] User ${handle} is blocked. Skipping.`);
      return;
    }

    // 2. Check Muted Thread
    if (dataStore.isThreadMuted(threadRootUri)) {
      console.log(`[Bot] Thread ${threadRootUri} is muted. Skipping.`);
      return;
    }

    // 2. Check Muted Branch
    const mutedBranch = dataStore.getMutedBranchInfo(ancestorUris);
    if (mutedBranch) {
      if (mutedBranch.handle === handle) {
        console.log(`[Bot] Branch is muted for user ${handle}. Skipping.`);
        return;
      } else {
        console.log(`[Bot] Branch is muted, but user ${handle} is new. Providing concise conclusion.`);
        const conclusionPrompt = `
          [Conversation Status: CONCLUDED]
          The conversation branch you are in has been concluded, but a new user (@${handle}) has joined and posted: "${text}".
          In your persona, generate a very concise, succinct, and final-sounding response to wrap up the interaction immediately.
          Keep it under 15 words. Do not invite further discussion.
        `;
        const conclusion = await llmService.generateResponse([{ role: 'system', content: conclusionPrompt }], { max_tokens: 30 });
        if (conclusion) {
          const reply = await blueskyService.postReply(notif, conclusion);
          if (reply && reply.uri) {
            await dataStore.muteBranch(reply.uri, handle);
          }
        }
        return;
      }
    }

    // 3. Pre-reply safety and relevance checks
    console.log(`[Bot] Starting safety check for post: "${text.substring(0, 50)}..."`);
    const postSafetyCheck = await llmService.isPostSafe(text);
    console.log(`[Bot] Safety check complete. Safe: ${postSafetyCheck.safe}`);
    if (!postSafetyCheck.safe) {
      console.log(`[Bot] Post by ${handle} failed safety check. Reason: ${postSafetyCheck.reason}. Skipping.`);
      return;
    }

    // if (!text.includes(config.BLUESKY_IDENTIFIER) && !isReplyToBot) {
    //   if (!(await llmService.isReplyRelevant(text))) {
    //     console.log(`[Bot] Post by ${handle} not relevant for a reply. Skipping.`);
    //     return;
    //   }
    // }

    // 4. Handle Commands
    const isCommand = text.trim().startsWith('!');
    if (isCommand) {
        const commandResponse = await handleCommand(this, notif, text);
        if (commandResponse !== null) {
            if (typeof commandResponse === 'string') {
                await blueskyService.postReply(notif, commandResponse);
            }
            return; // Command processed, stop further processing
        }
    }

    // 5. Pre-reply LLM check to avoid unnecessary responses
    const historyText = threadContext.map(h => `${h.author === config.BLUESKY_IDENTIFIER ? 'Assistant' : 'User'}: ${h.text}`).join('\n');
    const gatekeeperMessages = [
      { role: 'system', content: `You are a gatekeeper for an AI assistant. Analyze the user's latest post in the context of the conversation. Respond with only "true" if a direct reply is helpful or expected, or "false" if the post is a simple statement, agreement, or otherwise doesn't need a response. Your answer must be a single word: true or false.` },
      { role: 'user', content: `Conversation History:\n${historyText}\n\nUser's latest post: "${text}"` }
    ];
    // const replyCheckResponse = await llmService.generateResponse(gatekeeperMessages);
    // if (replyCheckResponse && replyCheckResponse.toLowerCase().trim().includes('false')) {
    //   console.log(`[Bot] LLM gatekeeper decided no reply is needed for: "${text}". Skipping.`);
    //   return;
    // }

    // 6. Conversation Vibe and Status Check (Anti-Looping & Monotony)
    console.log(`[Bot] Evaluating conversation vibe...`);
    const vibe = await llmService.evaluateConversationVibe(threadContext, text);
    console.log(`[Bot] Conversation vibe: ${vibe.status}`);
    const convLength = dataStore.getConversationLength(threadRootUri);

    if (vibe.status === 'hostile') {
      console.log(`[Bot] Disengaging from ${handle} due to hostility: ${vibe.reason}`);
      const disengagementPrompt = `
        A user interaction has been flagged for disengagement due to: "${vibe.reason}".
        Generate a firm but polite conversational response explaining that you cannot continue this interaction because it violates guidelines regarding ${vibe.reason}.
        Keep it concise and firm.
      `;
      const disengagement = await llmService.generateResponse([{ role: 'system', content: disengagementPrompt }]);
      if (disengagement) {
        const reply = await blueskyService.postReply(notif, disengagement);
        if (reply && reply.uri) {
            await dataStore.muteBranch(reply.uri, handle);
        }
      }
      return;
    }

    if (vibe.status === 'monotonous') {
      console.log(`[Bot] Ending monotonous conversation in branch starting at ${notif.uri}`);
      const conclusionPrompt = `
        [Conversation Status: ENDING]
        This conversation has reached a natural conclusion, become too lengthy, or is stagnating.
        In your persona, generate a very short, natural, and final-sounding concluding message.
        Keep it LESS THAN 10 WORDS.
      `;
      const conclusion = await llmService.generateResponse([{ role: 'system', content: conclusionPrompt }], { max_tokens: 20 });
      if (conclusion) {
        const reply = await blueskyService.postReply(notif, conclusion);
        if (reply && reply.uri) {
            await dataStore.muteBranch(reply.uri, handle);
        }
      }
      return;
    }

    // Traditional Bot-to-Bot fallback
    const profile = await blueskyService.getProfile(handle);
    const isBot = handle.includes('bot') || profile.description?.toLowerCase().includes('bot');
    if (isBot && convLength >= 5) {
      await blueskyService.postReply(notif, "Catch you later! Stopping here to avoid a loop.");
      await dataStore.muteThread(threadRootUri);
      return;
    }

    // 5. Conversational Image Generation
    const conversationHistoryForImageCheck = threadContext.map(h => `${h.author === config.BLUESKY_IDENTIFIER ? 'Assistant' : 'User'}: ${h.text}`).join('\n');
    const imageGenCheckPrompt = `You are an intent detection AI. Analyze the latest user post in the context of the conversation to determine if they are asking for an image to be generated. Respond with only "yes" or "no".\n\nConversation History:\n${conversationHistoryForImageCheck}`;
    const imageGenCheckMessages = [{ role: 'system', content: imageGenCheckPrompt }];
    console.log(`[Bot] Image Gen Check Prompt: ${imageGenCheckPrompt}`);
    const imageGenCheckResponse = await llmService.generateResponse(imageGenCheckMessages, { max_tokens: 5, preface_system_prompt: false });
    console.log(`[Bot] Raw Image Gen Check Response: "${imageGenCheckResponse}"`);

    if (imageGenCheckResponse && imageGenCheckResponse.toLowerCase().includes('yes')) {
      const imagePromptExtractionPrompt = `You are an AI assistant that extracts image prompts. Based on the conversation, create a concise, literal, and descriptive prompt for an image generation model. The user's latest post is the primary focus. Conversation:\n${conversationHistoryForImageCheck}\n\nRespond with only the prompt.`;
      const imagePromptExtractionMessages = [{ role: 'system', content: imagePromptExtractionPrompt }];
      console.log(`[Bot] Image Prompt Extraction Prompt: ${imagePromptExtractionPrompt}`);
      const prompt = await llmService.generateResponse(imagePromptExtractionMessages, { max_tokens: 100, preface_system_prompt: false });
      console.log(`[Bot] Raw Image Gen Extraction Response: "${prompt}"`);

      if (prompt && prompt.toLowerCase() !== 'null' && prompt.toLowerCase() !== 'no') {
        console.log(`[Bot] Final image generation prompt: "${prompt}"`);
        const imageBuffer = await imageService.generateImage(prompt);
        if (imageBuffer) {
          console.log('[Bot] Image generation successful, posting reply...');
          // The text reply is simple and direct.
          await blueskyService.postReply(notif, `Here's an image of "${prompt}":`, {
            imageBuffer,
            imageAltText: prompt,
          });
          return; // End processing here as the request is fulfilled.
        }
        // If image generation fails, fall through to the normal response flow.
        console.log(`[Bot] Image generation failed for prompt: "${prompt}", continuing with text-based response.`);
      }
    }

    // 5. YouTube Search Integration (Priority)
    console.log(`[Bot] Checking for video intent...`);
    let youtubeResult = null;
    const videoIntentSystemPrompt = `
      You are an intent detection AI. Analyze the user's post to determine if they are asking for a video (e.g., "find a video about...", "show me a youtube video for...", etc.).
      Your answer must be a single word: "yes" or "no".
    `;
    const videoIntentMessages = [
      { role: 'system', content: videoIntentSystemPrompt },
      { role: 'user', content: `The user's post is: "${text}"` }
    ];
    const videoIntentResponse = await llmService.generateResponse(videoIntentMessages, { max_tokens: 5 });
    console.log(`[Bot] Video intent response: ${videoIntentResponse}`);

    if (videoIntentResponse && videoIntentResponse.toLowerCase().includes('yes')) {
      console.log(`[Bot] Video intent confirmed for post: "${text}"`);
      const queryExtractionPrompt = `Extract the core search query for a YouTube video from the following post. Respond with ONLY the query. Post: "${text}"`;
      const query = await llmService.generateResponse([{ role: 'system', content: queryExtractionPrompt }], { max_tokens: 50 });

      if (query && query.trim() && !['null', 'no'].includes(query.toLowerCase())) {
        const youtubeResults = await youtubeService.search(query);
        youtubeResult = await llmService.selectBestResult(query, youtubeResults, 'youtube');

        if (youtubeResult) {
          console.log(`[Bot] Validated YouTube result: "${youtubeResult.title}"`);
        } else {
          console.log(`[Bot] No relevant YouTube result found for "${query}".`);
          const apologyPrompt = `The user asked for a video about "${query}", but you couldn't find a relevant one. Write a very short, concise, and friendly apology (max 150 characters).`;
          const apology = await llmService.generateResponse([{ role: 'system', content: apologyPrompt }]);
          if (apology) {
            await blueskyService.postReply(notif, apology);
            return;
          }
        }
      }
    }

    // 6. Fact-Checking / Information Search
    if (!youtubeResult && !text.trim().startsWith('!')) {
      console.log(`[Bot] Checking if fact-check is needed...`);
      if (await llmService.isFactCheckNeeded(text)) {
        console.log(`[Bot] Fact-check/Info search needed for post: "${text}"`);
        const claim = await llmService.extractClaim(text);
        if (claim && !['null', 'no'].includes(claim.toLowerCase())) {
          // Check Wikipedia first for direct information requests
          const wikiResults = await wikipediaService.searchArticle(claim);
          let infoResult = await llmService.selectBestResult(claim, wikiResults, 'wikipedia');
          let isWiki = !!infoResult;

          if (!infoResult) {
            // Fall back to Google Search (trusted sources)
            const googleResults = await googleSearchService.search(claim);
            infoResult = await llmService.selectBestResult(claim, googleResults, 'general');
            isWiki = false;
          }

          if (infoResult) {
            console.log(`[Bot] Validated info result: "${infoResult.title}"`);
            const summaryPrompt = `
              You are a helpful assistant. Provide a concise, conversational summary of the following information about "${claim}".
              Title: "${infoResult.title}"
              Content: "${isWiki ? infoResult.extract : infoResult.snippet}"

              Do not include the link in your summary.
            `;
            const summaryMessages = [
              { role: 'system', content: summaryPrompt },
              ...threadContext.map(h => ({ role: h.author === config.BLUESKY_IDENTIFIER ? 'assistant' : 'user', content: h.text }))
            ];
            const summaryText = await llmService.generateResponse(summaryMessages);

            if (summaryText) {
              const embed = await blueskyService.getExternalEmbed(infoResult.url || infoResult.link);
              await blueskyService.postReply(notif, summaryText, { embed });
              return;
            }
          } else {
            console.log(`[Bot] No relevant information found for "${claim}".`);
            // If the user explicitly asked for information/fact-check and we failed, apologize.
            if (text.toLowerCase().includes('what is') || text.toLowerCase().includes('who is') || text.toLowerCase().includes('search for')) {
              const apologyPrompt = `The user asked for information about "${claim}", but you couldn't find a relevant source. Write a very short, concise, and friendly apology (max 150 characters).`;
              const apology = await llmService.generateResponse([{ role: 'system', content: apologyPrompt }]);
              if (apology) {
                await blueskyService.postReply(notif, apology);
                return;
              }
            }
          }
        }
      }
    }

    // 6. Image Recognition
    let imageAnalysisResult = '';
    const embed = notif.record.embed;
    if (embed && embed.$type === 'app.bsky.embed.images') {
      console.log(`[Bot] Images detected in post. Starting image analysis...`);
      for (const image of embed.images) {
        const imageUrl = `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${notif.author.did}&cid=${image.image.ref.$link}`;
        console.log(`[Bot] Image detected: ${image.image.ref.$link}`);
        console.log(`[Bot] Alt text: ${image.alt}`);
        const analysis = await llmService.analyzeImage(imageUrl, image.alt);
        console.log(`[Bot] Image analysis complete: ${analysis ? 'Success' : 'Failed'}`);
        imageAnalysisResult += (analysis || '') + ' ';
      }
    }

    // 6. Generate Response with User Context and Memory
    console.log(`[Bot] Responding to post from ${handle}: "${text}"`);

    // Step 6a: Check if the user is asking a question that requires their profile context.
    console.log(`[Bot] Checking for user context intent...`);
    const contextIntentSystemPrompt = `You are an intent detection AI. Analyze the user's post to determine if they are asking a question that requires their own profile or post history as context. This includes questions like "give me recommendations", "summarize my profile", "what do you think of me?", etc. Your answer must be a single word: "yes" or "no".`;
    const contextIntentMessages = [
      { role: 'system', content: contextIntentSystemPrompt },
      { role: 'user', content: `The user's post is: "${text}"` }
    ];
    const contextIntentResponse = await llmService.generateResponse(contextIntentMessages, { max_tokens: 5 });
    let useContext = contextIntentResponse && contextIntentResponse.toLowerCase().includes('yes');
    console.log(`[Bot] User context intent: ${useContext}`);

    console.log(`[Bot] Generating response for ${handle}...`);
    const userMemory = dataStore.getInteractionsByUser(handle);
    const userSummary = dataStore.getUserSummary(handle);
    
    // Bot's own recent activity summary for cross-thread context
    const recentActivity = dataStore.db.data.interactions.slice(-5).map(i => `- To @${i.userHandle}: "${i.response.substring(0, 50)}..."`).join('\n');
    const activityContext = `\n\n[Recent Bot Activity across Bluesky:\n${recentActivity || 'None yet.'}]`;

    // Fetch user profile for additional context
    const userProfile = await blueskyService.getProfile(handle);
    const userPosts = await blueskyService.getUserPosts(handle);

    console.log(`[Bot] Analyzing user intent...`);
    const userIntent = await llmService.analyzeUserIntent(userProfile, userPosts);
    console.log(`[Bot] User intent analysis complete.`);

    if (userIntent.highRisk) {
      console.log(`[Bot] High-risk intent detected from ${handle}. Reason: ${userIntent.reason}. Pausing bot.`);
      this.paused = true;
      return;
    }

    const userContext = `
      ---
      User Profile:
      - Bio: ${userProfile.description?.replace(/\n/g, ' ') || 'Not available.'}
      - Recent Posts:
        ${userPosts.length > 0 ? userPosts.map(p => `- "${p.substring(0, 80)}..."`).join('\n') : 'No recent posts found.'}
      ---
    `;

    // Filter out the current post's text from cross-post memory to avoid self-contamination
    const crossPostMemory = userPosts
      .filter(p => (p.includes(config.BLUESKY_IDENTIFIER) || config.BOT_NICKNAMES.some(nick => p.includes(nick))) && p !== text)
      .map(p => `- (Previous mention in a DIFFERENT thread) "${p.substring(0, 100)}..."`)
      .join('\n');

    const fullContext = `
      ${useContext ? userContext : ''}
      ${userSummary ? `--- Persistent memory of user @${handle}: ${userSummary} ---` : ''}
      ${activityContext}
      ---
      Cross-Post Memory (Recent mentions of the bot by this user):
      ${crossPostMemory || 'No recent cross-post mentions found.'}
      ---
      User Intent Analysis: ${userIntent.reason || 'Could not be determined.'}
      ---
      Image Analysis: ${imageAnalysisResult || 'No image provided.'}
      ---
      ${
        youtubeResult
          ? `YouTube Search Result for "${youtubeResult.title}": A video will be embedded in the reply.`
          : (/video|youtube/i.test(text) ? 'The user may have asked for a video, but no relevant YouTube video was found. Please inform the user that you could not find a video for their request.' : '')
      }
    `;

    const messages = [
      { role: 'system', content: `You are replying to ${handle}. Use the following context to tailor your response. Your tone should be influenced by the user's intent, but do not state the analysis directly.${fullContext}` },
      ...userMemory.slice(-3).map(m => ({ role: 'user', content: `(Past interaction) ${m.text}` })),
      ...threadContext.map(h => ({ role: h.author === config.BLUESKY_IDENTIFIER ? 'assistant' : 'user', content: h.text }))
    ];

    let responseText = await llmService.generateResponse(messages);

    const recentBotReplies = threadContext.filter(h => h.author === config.BLUESKY_IDENTIFIER).map(h => h.text);

    // 6. Semantic Loop and Safety Check for Bot's Response
    if (responseText) {
      if (await llmService.checkSemanticLoop(responseText, recentBotReplies)) {
        console.log('[Bot] Semantic loop detected. Generating a new response.');
        responseText = await llmService.generateResponse([...messages, { role: 'system', content: "Your previous response was too similar to a recent one. Please provide a fresh, different perspective." }]);
      }

      if (responseText) {
        const responseSafetyCheck = await llmService.isResponseSafe(responseText);
        if (!responseSafetyCheck.safe) {
          console.log(`[Bot] Bot's response failed safety check. Reason: ${responseSafetyCheck.reason}. Aborting reply.`);
          return;
        }
      }
    }

    if (responseText) {
      // Remove thinking tags and any leftover fragments
      responseText = sanitizeThinkingTags(responseText);
      
      // Sanitize the response to avoid duplicate sentences
      responseText = sanitizeDuplicateText(responseText);
      
      if (!responseText) {
        console.log('[Bot] Response was empty after sanitization. Aborting reply.');
        return;
      }
      
      console.log(`[Bot] Replying to @${handle} with: "${responseText}"`);
      let replyUri;
      if (youtubeResult) {
        replyUri = await postYouTubeReply(notif, youtubeResult, responseText);
      } else {
        replyUri = await blueskyService.postReply(notif, responseText);
      }
      await dataStore.updateConversationLength(threadRootUri, convLength + 1);
      await dataStore.saveInteraction({ userHandle: handle, text, response: responseText });

      // Like post if it matches the bot's persona
      if (await llmService.shouldLikePost(text)) {
        console.log(`[Bot] Post by ${handle} matches persona. Liking...`);
        await blueskyService.likePost(notif.uri, notif.cid);
      }

      // Rate user based on interaction history
      const interactionHistory = dataStore.getInteractionsByUser(handle);
      const rating = await llmService.rateUserInteraction(interactionHistory);
      await dataStore.updateUserRating(handle, rating);

      // Update User Summary periodically
      if (userMemory.length % 5 === 0) {
        const summaryPrompt = `Based on the following interaction history with @${handle}, provide a concise, one-sentence summary of this user's interests, relationship with the bot, and personality. Be objective but conversational.\n\nInteraction History:\n${userMemory.slice(-10).map(m => `User: "${m.text}"\nBot: "${m.response}"`).join('\n')}`;
        const newSummary = await llmService.generateResponse([{ role: 'system', content: summaryPrompt }], { max_tokens: 50 });
        if (newSummary) {
          await dataStore.updateUserSummary(handle, newSummary);
          console.log(`[Bot] Updated persistent summary for @${handle}: ${newSummary}`);
        }
      }

    // Repo Knowledge Injection
    const repoIntentPrompt = `Analyze the user's post to determine if they are asking about the bot's code, architecture, tools, or internal logic. Respond with only "yes" or "no".\n\nUser's post: "${text}"`;
    const repoIntentResponse = await llmService.generateResponse([{ role: 'system', content: repoIntentPrompt }], { max_tokens: 5, preface_system_prompt: false });

    if (repoIntentResponse && repoIntentResponse.toLowerCase().includes('yes')) {
      console.log(`[Bot] Repo-related query detected. Searching codebase for context...`);
      const repoQuery = await llmService.extractClaim(text); // Use extractClaim for a clean search query
      const repoResults = await googleSearchService.searchRepo(repoQuery);

      if (repoResults.length > 0) {
        const repoContext = repoResults.slice(0, 3).map(r => `File/Page: ${r.title}\nSnippet: ${r.snippet}`).join('\n\n');
        const repoSystemPrompt = `
          You have found information about your own codebase from your GitHub repository.
          Use this context to answer the user's question accurately and helpfully.
          Repository Context:
          ${repoContext}
        `;
        // Inject this into the messages before final response generation
        messages.splice(1, 0, { role: 'system', content: repoSystemPrompt });
        // Re-generate response with new context
        responseText = await llmService.generateResponse(messages);
      }
    }

      // Self-moderation check
      console.log(`[Bot] Running self-moderation checks...`);
      const isRepetitive = await llmService.checkSemanticLoop(responseText, recentBotReplies);
      const isCoherent = await llmService.isReplyCoherent(text, responseText, threadContext, youtubeResult);
      console.log(`[Bot] Self-moderation complete. Repetitive: ${isRepetitive}, Coherent: ${isCoherent}`);

      if (isRepetitive || !isCoherent) {
        const parentPostDetails = await blueskyService.getPostDetails(notif.uri);
        const parentPostLiked = parentPostDetails?.viewer?.like;

        if (parentPostLiked) {
          console.log(`[Bot] Self-deletion vetoed: Parent post was liked by the user.`);
        } else {
          let reason = 'incoherent';
          if (isRepetitive) reason = 'repetitive';

          console.warn(`[Bot] Deleting own post (${reason}). URI: ${replyUri?.uri}. Content: "${responseText}"`);
          if (replyUri && replyUri.uri) {
            await blueskyService.deletePost(replyUri.uri);
          }
        }
      }
    }
    } catch (error) {
      console.error(`[Bot] Uncaught error in processNotification for URI ${notif.uri}:`, error);
    }
  }

  async _getThreadHistory(uri) {
    try {
      const thread = await blueskyService.getDetailedThread(uri);
      if (!thread) return [];

      const history = [];
      let current = thread;
      const MAX_HISTORY = 25;

      while (current && current.post) {
        let postText = current.post.record.text || '';
        const embed = current.post.record.embed;

        if (embed && embed.$type === 'app.bsky.embed.images' && embed.images) {
          for (const image of embed.images) {
            if (image.alt) {
              postText += ` [Image with alt text: "${image.alt}"]`;
            } else {
              postText += ` [Image attached, no alt text]`;
            }
          }
        }

        history.unshift({
          author: current.post.author.handle,
          text: postText.trim(),
          uri: current.post.uri,
        });
        current = current.parent;

        // If we've reached the limit, we try to jump to the root if we're not already there
        if (history.length >= MAX_HISTORY - 1 && current && current.parent) {
            // Find the root
            let root = current;
            while (root && root.parent) {
                root = root.parent;
            }
            if (root && root.post) {
                let rootPostText = root.post.record.text || '';
                const rootEmbed = root.post.record.embed;
                if (rootEmbed && rootEmbed.$type === 'app.bsky.embed.images' && rootEmbed.images) {
                    for (const image of rootEmbed.images) {
                        if (image.alt) {
                            rootPostText += ` [Image with alt text: "${image.alt}"]`;
                        }
                    }
                }
                history.unshift({ author: 'SYSTEM', text: '... [thread truncated] ...', uri: null });
                history.unshift({
                    author: root.post.author.handle,
                    text: rootPostText.trim(),
                    uri: root.post.uri,
                });
            }
            break;
        }
      }
      return history;
    } catch (error) {
      console.error('[Bot] Error fetching thread history:', error);
      return [];
    }
  }

  async performAutonomousPost() {
    if (this.paused) return;
    console.log('[Bot] Checking for autonomous post eligibility...');

    try {
      const feed = await blueskyService.agent.getAuthorFeed({
        actor: blueskyService.did,
        limit: 100,
      });

      const today = new Date().toISOString().split('T')[0];
      const postsToday = feed.data.feed.filter(item => {
        return item.post.author.did === blueskyService.did &&
               item.post.indexedAt.startsWith(today) &&
               !item.post.record.reply; // Count only standalone posts
      });

      if (postsToday.length >= 5) {
        console.log(`[Bot] Already posted ${postsToday.length} times today. Skipping autonomous post.`);
        return;
      }

      console.log(`[Bot] Eligibility confirmed (${postsToday.length}/5). Gathering context...`);

      // 1. Gather context from timeline and interactions
      const timeline = await blueskyService.getTimeline(20);
      const networkBuzz = timeline.map(item => item.post.record.text).filter(t => t).slice(0, 15).join('\n');
      const recentInteractions = dataStore.db.data.interactions.slice(-20);

      // 2. Identify a topic based on context
      console.log(`[Bot] Identifying autonomous post topic...`);
      const topicPrompt = `
        Based on the current vibe of your following feed and recent interactions, identify a single interesting topic or theme for a standalone post.
        Network Buzz:
        ${networkBuzz || 'None.'}
        Recent Interactions:
        ${recentInteractions.map(i => `@${i.userHandle}: ${i.text}`).join('\n') || 'None.'}

        Respond with ONLY the topic/theme (e.g., "AI ethics in social media" or "the future of open-source").
      `;
      const topic = await llmService.generateResponse([{ role: 'system', content: topicPrompt }], { max_tokens: 50, preface_system_prompt: false });
      console.log(`[Bot] Autonomous topic identification result: ${topic}`);
      if (!topic || topic.toLowerCase() === 'none') {
          console.log('[Bot] Could not identify a suitable topic for autonomous post.');
          return;
      }
      console.log(`[Bot] Identified topic: "${topic}"`);

      // 3. Check for meaningful user to mention
      console.log(`[Bot] Checking for meaningful mentions for topic: ${topic}`);
      const mentionPrompt = `
        For the topic "${topic}", identify if any of the following users have had a meaningful persistent discussion with you about it (multiple quality interactions).
        Interactions:
        ${recentInteractions.map(i => `@${i.userHandle}: ${i.text}`).join('\n')}

        If yes, respond with ONLY their handle (e.g., "@user.bsky.social"). Otherwise, respond "none".
      `;
      const mentionHandle = await llmService.generateResponse([{ role: 'system', content: mentionPrompt }], { max_tokens: 50, preface_system_prompt: false });
      const useMention = mentionHandle && mentionHandle.startsWith('@');
      console.log(`[Bot] Mention check result: ${mentionHandle} (Use mention: ${useMention})`);

      // 4. Determine Post Type
      const postTypes = ['text', 'image', 'wikipedia'];
      const postType = postTypes[Math.floor(Math.random() * postTypes.length)];
      console.log(`[Bot] Selected post type: ${postType}`);

      let postContent = '';
      let embed = null;
      let generationPrompt = '';

      if (postType === 'wikipedia') {
        console.log(`[Bot] Post type selected: Wikipedia. Searching for article: ${topic}`);
        const articles = await wikipediaService.searchArticle(topic, 1);
        const article = articles[0];
        if (article) {
            const systemPrompt = `
                Based on the Wikipedia article "${article.title}" (${article.extract}), write an engaging Bluesky post.
                ${useMention ? `You should mention ${mentionHandle} as you've discussed related things before.` : ''}
                IMPORTANT: You MUST either mention the article title ("${article.title}") naturally or explicitly reference it as follow-up material.
                Topic context: ${topic}
                Keep it friendly and inquisitive. Max 3 threaded posts if needed.
            `;
            postContent = await llmService.generateResponse([{ role: 'system', content: systemPrompt }]);
            if (postContent) {
                postContent += `\n\nReference: ${article.url}`;
                embed = await blueskyService.getExternalEmbed(article.url);
            }
        }
      } else if (postType === 'image') {
          console.log(`[Bot] Post type selected: Image. Generating image for: ${topic}`);
          const imageBuffer = await imageService.generateImage(topic);
          if (imageBuffer) {
              console.log(`[Bot] Image generated successfully. Analyzing visuals...`);
              const analysis = await llmService.analyzeImage(imageBuffer);
              if (analysis) {
                  const systemPrompt = `
                    Write a friendly, inquisitive, and conversational Bluesky post about why you chose to generate this image and what it offers.
                    Do NOT be too mechanical; stay in your persona.
                    ${useMention ? `You can mention ${mentionHandle} if appropriate.` : ''}
                    Actual Visuals in Image: ${analysis}
                    Contextual Topic: ${topic}
                    Keep it under 280 characters.
                  `;
                  postContent = await llmService.generateResponse([{ role: 'system', content: systemPrompt }]);

                  const altTextPrompt = `Create a concise and accurate alt-text for accessibility based on this description: ${analysis}`;
                  const altText = await llmService.generateResponse([{ role: 'system', content: altTextPrompt }], { max_tokens: 100, preface_system_prompt: false });

                  const { data: uploadData } = await blueskyService.agent.uploadBlob(imageBuffer, { encoding: 'image/jpeg' });
                  embed = {
                    $type: 'app.bsky.embed.images',
                    images: [{ image: uploadData.blob, alt: altText || analysis }],
                  };

                  // Re-fetch the prompt used (we need to store it from ImageService or re-generate)
                  // For simplicity, let's use the topic as the "base" prompt or re-extract it.
                  generationPrompt = topic;
              }
          }
      } else {
        // Text-only
        const systemPrompt = `
            Generate a standalone, engaging, and friendly Bluesky post based on your persona about the topic: "${topic}".
            ${useMention ? `Mention ${mentionHandle} and reference your previous discussions.` : ''}
            Keep it under 280 characters or max 3 threaded posts if deeper.
            Your persona is: ${config.TEXT_SYSTEM_PROMPT}
        `;
        postContent = await llmService.generateResponse([{ role: 'system', content: systemPrompt }]);
      }

      if (postContent) {
        postContent = sanitizeThinkingTags(postContent);
        postContent = sanitizeDuplicateText(postContent);

        if (!postContent) {
          console.log('[Bot] Autonomous post content was empty after sanitization. Aborting.');
          return;
        }

        // 5. Coherence Check for Autonomous Post
        console.log(`[Bot] Checking coherence for autonomous ${postType} post...`);
        const isCoherent = await llmService.isReplyCoherent(
          `Topic: ${topic}`,
          postContent,
          [], // No thread history for standalone posts
          embed
        );

        if (!isCoherent) {
          console.log(`[Bot] Autonomous post failed coherence check. Aborting. Topic: ${topic}`);
          return;
        }

        console.log(`[Bot] Performing autonomous ${postType} post...`);
        const result = await blueskyService.post(postContent, embed, { maxChunks: 3 });

        // If it was an image post, add the nested prompt comment
        if (postType === 'image' && result && generationPrompt) {
            await blueskyService.postReply({ uri: result.uri, cid: result.cid, record: {} }, `Generation Prompt: ${generationPrompt}`);
        }
      }
    } catch (error) {
      console.error('[Bot] Error in performAutonomousPost:', error);
    }
  }

  async cleanupOldPosts() {
    console.log('[Bot] Starting cleanup of old posts...');
    let deletedCount = 0;
    let checkedCount = 0;
    const MAX_CHECKS_PER_RUN = 20;

    try {
      const feed = await blueskyService.agent.getAuthorFeed({
        actor: blueskyService.did,
        limit: 50, // Reduced from 100 to focus on most recent first
      });

      for (const item of feed.data.feed) {
        if (checkedCount >= MAX_CHECKS_PER_RUN) {
          console.log(`[Bot Cleanup] Reached max checks limit (${MAX_CHECKS_PER_RUN}). Stopping for this run.`);
          break;
        }

        const post = item.post;
        const postText = post.record.text || '';
        console.log(`[Bot Cleanup] Checking post coherence: ${post.uri}`);

        // Optimization: Ignore posts older than 30 days per user request
        const postDate = new Date(post.indexedAt);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        if (postDate < thirtyDaysAgo) {
          continue;
        }

        // We only want to clean up replies, not standalone posts.
        if (!post.record.reply) {
          continue;
        }

        checkedCount++;

        // To check for coherence, we need the parent post's text.
        let parentText = '';
        const threadHistory = await this._getThreadHistory(post.uri);
        if (post.record.reply.parent.uri) {
          if (threadHistory.length > 1) {
            // The second to last post is the parent
            parentText = threadHistory[threadHistory.length - 2].text;
          }
        }

        const embedInfo = post.record.embed;

        // Add a small delay between LLM calls to prevent 504 errors/overload
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log(`[Bot Cleanup] Requesting coherence check for: "${postText.substring(0, 50)}..."`);
        const isCoherent = await llmService.isReplyCoherent(parentText, postText, threadHistory, embedInfo);
        console.log(`[Bot Cleanup] Coherence check result for ${post.uri}: ${isCoherent}`);

        if (!isCoherent) {
          const postDate = new Date(post.indexedAt);
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          if (postDate > twentyFourHoursAgo) {
            console.log(`[Bot Cleanup] Skipping recently posted incoherent post: ${post.uri}`);
            continue;
          }

          const reason = 'incoherent';

          console.warn(`[Bot Cleanup] Deleting own post (${reason}). URI: ${post.uri}. Content: "${postText}"`);
          await blueskyService.deletePost(post.uri);
          deletedCount++;
          await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limit deletions
        }
      }

      const summaryMessage = `Cleanup complete. Scanned ${feed.data.feed.length} posts and deleted ${deletedCount} of them.`;
      console.log(`[Bot] ${summaryMessage}`);

    } catch (error) {
      console.error('[Bot] Error during cleanup of old posts:', error);
    }
  }
}

import { blueskyService } from './services/blueskyService.js';
import { llmService } from './services/llmService.js';
import { dataStore } from './services/dataStore.js';
import { googleSearchService } from './services/googleSearchService.js';
import { imageService } from './services/imageService.js';
import { youtubeService } from './services/youtubeService.js';
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

    // Run catch-up once on startup to process missed notifications
    await this.catchUpNotifications();

    // Run cleanup on startup
    await this.cleanupOldPosts();

    // Start Firehose for real-time DID mentions
    this.startFirehose();

    // Proactive post proposal on a timer
    setInterval(() => this.proposeNewPost(), 3600000); // Every hour

    console.log('[Bot] Startup complete. Listening for real-time events via Firehose.');
  }

  async catchUpNotifications() {
    console.log('[Bot] Catching up on missed notifications...');
    let cursor;
    let notificationsCaughtUp = 0;
    const processingPromises = [];

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

        // Now, process the notification.
        processingPromises.push(this.processNotification(notif));
      }
      cursor = response.cursor;
    } while (cursor);

    // Wait for all processing to complete
    await Promise.all(processingPromises);

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
    let threadContext = await this._getThreadHistory(notif.uri);

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

    // 3. Pre-reply safety and relevance checks
    const postSafetyCheck = await llmService.isPostSafe(text);
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

    // 6. Bot-to-Bot Loop Prevention
    const profile = await blueskyService.getProfile(handle);
    const isBot = handle.includes('bot') || profile.description?.toLowerCase().includes('bot');
    const convLength = dataStore.getConversationLength(threadRootUri);

    if (isBot && convLength >= 5) {
      await blueskyService.postReply(notif, "This conversation has been great, but I'll step away now to avoid looping! Feel free to tag me elsewhere.");
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

    // 5. Fact-Checking
    if (text.toLowerCase().startsWith('!search') || text.toLowerCase().startsWith('!google')) {
        // This is a command, so we'll let the command handler take care of it
    } else if (await llmService.isFactCheckNeeded(text)) {
      console.log(`[Bot] Fact-check needed for post by ${handle}.`);
      const claim = await llmService.extractClaim(text);
      if (claim) {
        const searchResults = await googleSearchService.search(claim);
        if (searchResults.length > 0) {
          const topResult = searchResults[0];
          console.log(`[Bot] Top search result for "${claim}": ${topResult.title}`);

          const snippet = topResult.snippet.substring(0, 500);
          const summaryPrompt = `
            You are a helpful assistant that summarizes information from trusted sources.
            A user is asking about: "${claim}".
            The most relevant article found is titled "${topResult.title}".
            Here is a snippet from the article: "${snippet}".

            Based on this, provide a concise and conversational summary of the key information.
            Do not link to the article in your summary; the link will be added automatically.
          `;
          const messages = [
            { role: 'system', content: summaryPrompt },
            ...threadContext.map(h => ({ role: h.author === config.BLUESKY_IDENTIFIER ? 'assistant' : 'user', content: h.text }))
          ];

          const summaryText = await llmService.generateResponse(messages);

          if (summaryText) {
            console.log(`[Bot] Generated summary for "${claim}": ${summaryText}`);
            const embed = await blueskyService.getExternalEmbed(topResult.link);
            await blueskyService.postReply(notif, summaryText, { embed });
            return;
          }
        } else {
            console.log(`[Bot] Could not find a relevant page from trusted sources for "${claim}".`);
        }
      }
    }

    // 6. YouTube Search Integration (with improved intent detection)
    let youtubeResult = null; // Will hold the video object if found

    // Stage 1: Use a reliable LLM to check for video search intent.
    const videoIntentSystemPrompt = `
      You are an intent detection AI. Analyze the user's post to determine if they are asking for a YouTube video.
      Your answer must be a single word: "yes" or "no".
      Example: "can you find me a video of a cat playing a piano" -> "yes"
      Example: "I like watching videos." -> "no"
    `;
    const videoIntentMessages = [
      { role: 'system', content: videoIntentSystemPrompt },
      { role: 'user', content: `The user's post is: "${text}"` }
    ];
    console.log(`[Bot] Checking for YouTube video intent in post: "${text}"`);
    const videoIntentResponse = await llmService.generateResponse(videoIntentMessages, { max_tokens: 5 });
    console.log(`[Bot] Raw video intent response: "${videoIntentResponse}"`);

    if (videoIntentResponse && videoIntentResponse.toLowerCase().includes('yes')) {
      console.log(`[Bot] Video intent confirmed. Extracting search query...`);
      // Stage 2: If intent is confirmed, extract the search query.
      const queryExtractionPrompt = `
        You are a search query extractor. The user wants to find a YouTube video.
        Extract the core search query from their post. Respond with only the search query itself.
        Example: "find a video about cats playing the piano" -> "cats playing the piano"
        Example: "show me the latest trailer for the new Dune movie" -> "new Dune movie trailer"
      `;
      const queryExtractionMessages = [{ role: 'system', content: queryExtractionPrompt }, { role: 'user', content: `The user's post is: "${text}"` }];
      const query = await llmService.generateResponse(queryExtractionMessages, { max_tokens: 50 });
      console.log(`[Bot] Raw YouTube Query Extraction Response: "${query}"`);

      if (query && query.toLowerCase().trim() && query.toLowerCase() !== 'null' && query.toLowerCase() !== 'no') {
        console.log(`[Bot] Extracted YouTube search query: "${query}"`);
        const youtubeResults = await youtubeService.search(query);

        if (youtubeResults.length > 0) {
          const topResult = youtubeResults[0];
          // Stage 3: Validate the relevance of the top search result.
          const validationPrompt = `You are a relevance validation AI. A user requested a video with the post: "${text}". The top YouTube search result is a video titled "${topResult.title}". Is this video relevant to the user's request? Your answer must be a single word: "yes" or "no".`;
          const validationMessages = [{ role: 'system', content: validationPrompt }];
          console.log(`[Bot] Validating YouTube result: "${topResult.title}"`);
          const validationResponse = await llmService.generateResponse(validationMessages, { max_tokens: 5 });
          console.log(`[Bot] Raw validation response: "${validationResponse}"`);

          if (validationResponse && validationResponse.toLowerCase().includes('yes')) {
            console.log(`[Bot] YouTube result validated as relevant.`);
            youtubeResult = topResult;
            console.log(`[Bot] Found YouTube video: https://www.youtube.com/watch?v=${youtubeResult.videoId}`);
          } else {
            console.log(`[Bot] Top YouTube result "${topResult.title}" was deemed irrelevant. Discarding.`);
          }
        } else {
          console.log(`[Bot] YouTube search for "${query}" yielded no results.`);
        }
      } else {
        console.log(`[Bot] Could not extract a valid search query from the post.`);
      }
    } else {
      console.log(`[Bot] No video intent detected.`);
    }

    // 6. Image Recognition
    let imageAnalysisResult = '';
    const embed = notif.record.embed;
    if (embed && embed.$type === 'app.bsky.embed.images') {
      for (const image of embed.images) {
        const imageUrl = `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${notif.author.did}&cid=${image.image.ref.$link}`;
        console.log(`[Bot] Image detected: ${image.image.ref.$link}`);
        console.log(`[Bot] Alt text: ${image.alt}`);
        imageAnalysisResult += await llmService.analyzeImage(imageUrl, image.alt) + ' ';
      }
    }

    // 6. Generate Response with User Context and Memory
    console.log(`[Bot] Responding to post from ${handle}: "${text}"`);

    // Step 6a: Check if the user is asking a question that requires their profile context.
    const contextIntentSystemPrompt = `You are an intent detection AI. Analyze the user's post to determine if they are asking a question that requires their own profile or post history as context. This includes questions like "give me recommendations", "summarize my profile", "what do you think of me?", etc. Your answer must be a single word: "yes" or "no".`;
    const contextIntentMessages = [
      { role: 'system', content: contextIntentSystemPrompt },
      { role: 'user', content: `The user's post is: "${text}"` }
    ];
    const contextIntentResponse = await llmService.generateResponse(contextIntentMessages, { max_tokens: 5 });
    let useContext = contextIntentResponse && contextIntentResponse.toLowerCase().includes('yes');

    console.log(`[Bot] Generating response for ${handle}...`);
    const userMemory = dataStore.getInteractionsByUser(handle);
    
    // Fetch user profile for additional context
    const userProfile = await blueskyService.getProfile(handle);
    const userPosts = await blueskyService.getUserPosts(handle);

    const userIntent = await llmService.analyzeUserIntent(userProfile, userPosts);

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
      // Handle cases where the model might output </think> without the opening tag
      responseText = responseText.replace(/<\/think>/gi, '').trim();
      
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

      // Self-moderation check
      const isRepetitive = await llmService.checkSemanticLoop(responseText, recentBotReplies);
      const isCoherent = await llmService.isReplyCoherent(text, responseText, threadContext);

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
        });
        current = current.parent;
      }
      return history;
    } catch (error) {
      console.error('[Bot] Error fetching thread history:', error);
      return [];
    }
  }

  async proposeNewPost() {
    if (this.paused) return;
    console.log('[Bot] Proposing new post...');
    const interactions = dataStore.db.data.interactions.slice(-10);
    if (interactions.length < 3) return;

    const topics = interactions.map(i => i.text).join('\n');
    const systemPrompt = `
      Based on the following recent topics of conversation, synthesize 3 interesting and relevant topics for a new post.
      The topics should be in line with the bot's persona: friendly, inquisitive, and occasionally witty.
      Format the topics as a numbered list.
    `;
    const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: topics }];
    const proposedTopics = await llmService.generateResponse(messages);

    if (proposedTopics) {
      this.proposedPosts = proposedTopics.split('\n').map(t => t.replace(/^\d+\.\s*/, ''));
      const approvalMessage = `I've come up with a few ideas for a new post. @${config.ADMIN_BLUESKY_HANDLE}, please review and approve one:\n${this.proposedPosts.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\nTo approve, reply with \`!approve-post [number]\`.`;
      await blueskyService.post(approvalMessage);
    }
  }

  async createApprovedPost(topicIndex) {
    if (this.paused || topicIndex < 0 || topicIndex >= this.proposedPosts.length) return;

    const topic = this.proposedPosts[topicIndex];
    const systemPrompt = `
      Create a new, standalone Bluesky post about the following topic: "${topic}".
      The post should be engaging, under 300 characters, and in line with a friendly, inquisitive persona.
    `;
    const messages = [{ role: 'system', content: systemPrompt }];
    const postContent = await llmService.generateResponse(messages);

    if (postContent) {
      // 50% chance of adding an image
      if (Math.random() < 0.5) {
        const imageResults = await googleSearchService.searchImages(topic);
        if (imageResults.length > 0) {
          const image = imageResults[0];
          const embed = await blueskyService.uploadImage(image.link, image.title || topic);
          await blueskyService.post(postContent, embed);
        } else {
          await blueskyService.post(postContent);
        }
      } else {
        await blueskyService.post(postContent);
      }
    }
    this.proposedPosts = []; // Clear proposals after posting
  }

  async cleanupOldPosts() {
    console.log('[Bot] Starting cleanup of old posts...');
    let deletedCount = 0;
    try {
      const feed = await blueskyService.agent.getAuthorFeed({
        actor: blueskyService.did,
        limit: 100, // Fetch a good number of recent posts
      });

      for (const item of feed.data.feed) {
        const post = item.post;
        const postText = post.record.text || '';

        // We only want to clean up replies, not standalone posts.
        if (!post.record.reply) {
          continue;
        }

        // To check for coherence, we need the parent post's text.
        let parentText = '';
        const threadHistory = await this._getThreadHistory(post.uri);
        if (post.record.reply.parent.uri) {
          if (threadHistory.length > 1) {
            // The second to last post is the parent
            parentText = threadHistory[threadHistory.length - 2].text;
          }
        }

        const isCoherent = await llmService.isReplyCoherent(parentText, postText, threadHistory);

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

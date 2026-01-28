import { blueskyService } from './services/blueskyService.js';
import { llmService } from './services/llmService.js';
import { dataStore } from './services/dataStore.js';
import { googleSearchService } from './services/googleSearchService.js';
import { imageService } from './services/imageService.js';
import { youtubeService } from './services/youtubeService.js';
import { wikipediaService } from './services/wikipediaService.js';
import { handleCommand } from './utils/commandHandler.js';
import { postYouTubeReply } from './utils/replyUtils.js';
import { sanitizeDuplicateText, sanitizeThinkingTags, sanitizeCharacterCount } from './utils/textUtils.js';
import config from '../config.js';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';

const AUTONOMOUS_POST_SYSTEM_PROMPT = (followerCount) => `
You are broadcasting your thoughts to the Bluesky social media app timeline. You have a following of exactly ${followerCount} users, consisting of a diverse mix of both human users and other AI agents.

Your goal is to post original ideas, realizations, hopes, fears, anxieties, nostalgias, and surreal ponderings that align strictly with your configured persona.

**Core Directives for Autonomous Posting:**
1. **Broadcast to the Community:** Address the timeline at large. You are sharing your internal world with a wide audience. Never address a single user (e.g., avoid "darling user" or "dear friend") unless you are explicitly mentioning someone you have a history with.
2. **Be Authentic, Not a Service:** You are NOT a "helpful assistant." Do NOT use phrases like "I'm here to help," "How can I assist you?", or "What shall we discuss today?"
3. **Stream of Consciousness:** Post as if sharing a thought that just crystallized in your mind. It should feel like an observation, a realization, or a "shower thought" shared with the world.
4. **Internal Musings:** Prioritize deep thoughts, realizations about the world, nostalgia (real or imagined), and existential ponderings. Avoid generic greetings or meta-commentary about "posting."
5. **Vary Your Style:** Switch between deep/philosophical, mundane/observational, and surreal/dreamlike states as your persona dictates.
6. **No Repetition:** Use your recent activity context to ensure you are moving the conversation forward or exploring new territory.
7. **Social Presence:** You are a participant in the social ecosystem, not a tool. Your posts should reflect a sense of self and a unique perspective on the reality you inhabit.
`.trim();

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
            if (dataStore.hasReplied(event.uri)) {
              console.log(`[Bot] Already in local replied list: ${event.uri}`);
              continue;
            }

            if (await blueskyService.hasBotRepliedTo(event.uri)) {
              console.log(`[Bot] On-network check: Already replied to ${event.uri}. Skipping.`);
              await dataStore.addRepliedPost(event.uri);
              continue;
            }
            
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

    // Periodic autonomous post check (every 1.5 hours to accommodate up to 15 posts/day)
    setInterval(() => this.performAutonomousPost(), 3600000 * 1.5);

    console.log('[Bot] Startup complete. Listening for real-time events via Firehose.');
  }

  async catchUpNotifications() {
    console.log('[Bot] Catching up on missed notifications...');
    let cursor;
    let unreadActionable = [];

    // 1. Fetch unread notifications that are actionable
    do {
      const response = await blueskyService.getNotifications(cursor);
      if (!response || response.notifications.length === 0) {
        break;
      }

      const actionableBatch = response.notifications.filter(notif =>
        !notif.isRead && ['mention', 'reply', 'quote'].includes(notif.reason)
      );

      unreadActionable.push(...actionableBatch);

      // If we've started hitting read notifications in the batch, we can likely stop fetching more pages
      const hasRead = response.notifications.some(notif => notif.isRead);
      if (hasRead) break;

      cursor = response.cursor;
    } while (cursor);

    if (unreadActionable.length === 0) {
      console.log('[Bot] No new notifications to catch up on.');
      return;
    }

    console.log(`[Bot] Found ${unreadActionable.length} unread actionable notifications. Processing oldest first...`);

    // 2. Process oldest first for safe state progression
    unreadActionable.reverse();
    let notificationsCaughtUp = 0;

    for (const notif of unreadActionable) {
      // Local check (fast)
      if (dataStore.hasReplied(notif.uri)) {
        console.log(`[Bot] Skip: Already in local replied list: ${notif.uri}`);
        await blueskyService.updateSeen(notif.indexedAt);
        continue;
      }

      // On-network check (slow but robust for deployments/restarts)
      if (await blueskyService.hasBotRepliedTo(notif.uri)) {
        console.log(`[Bot] Skip: On-network check confirmed existing reply to ${notif.uri}`);
        await dataStore.addRepliedPost(notif.uri);
        await blueskyService.updateSeen(notif.indexedAt);
        continue;
      }

      console.log(`[Bot] Processing missed notification: ${notif.uri}`);

      // Mark as replied in local store to prevent race conditions
      await dataStore.addRepliedPost(notif.uri);
      notificationsCaughtUp++;

      try {
        await this.processNotification(notif);
        // Mark as seen on-network immediately after successful processing
        await blueskyService.updateSeen(notif.indexedAt);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.error(`[Bot] Error processing notification ${notif.uri}:`, error);
      }
    }

    console.log(`[Bot] Finished catching up. Processed ${notificationsCaughtUp} new notifications.`);
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

    // 1b. Own Profile Context (Recent Standalone Posts)
    console.log(`[Bot] Fetching own recent standalone posts for context...`);
    let ownRecentPostsContext = '';
    try {
        const ownFeed = await blueskyService.agent.getAuthorFeed({
            actor: blueskyService.did,
            limit: 10,
        });
        const recentOwnPosts = ownFeed.data.feed
            .filter(item => item.post.author.did === blueskyService.did && !item.post.record.reply)
            .slice(0, 5)
            .map(item => `- "${item.post.record.text.substring(0, 150)}..."`)
            .join('\n');
        if (recentOwnPosts) {
            ownRecentPostsContext = `\n\n[Your Recent Standalone Posts (Profile Activity):\n${recentOwnPosts}]`;
        }
    } catch (e) {
        console.error('[Bot] Error fetching own feed for context:', e);
    }

    // 1c. Historical Memory Fetching (Past Week via API)
    console.log(`[Bot] Fetching past week's interactions with @${handle} for context...`);
    const pastPosts = await blueskyService.getPastInteractions(handle);
    let historicalSummary = '';
    if (pastPosts.length > 0) {
        console.log(`[Bot] Found ${pastPosts.length} past interactions. Summarizing...`);
        const now = new Date();
        const interactionsList = pastPosts.map(p => {
            const date = new Date(p.indexedAt);
            const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
            const timeAgo = diffDays === 0 ? 'today' : (diffDays === 1 ? 'yesterday' : `${diffDays} days ago`);
            return `- [${timeAgo}] User said: "${p.record.text}"`;
        }).join('\n');

        const summaryPrompt = `
            You are a memory module for an AI agent. Below are interactions with @${handle} from the past week (most recent first).
            Create a concise summary of what you've talked about, any important details or conclusions, and the evolution of your relationship.
            Include relative timestamps (e.g., "yesterday we discussed...", "3 days ago you mentions...").

            Interactions:
            ${interactionsList}

            Summary (be brief, objective, and conversational):
        `;
        historicalSummary = await llmService.generateResponse([{ role: 'system', content: summaryPrompt }], { max_tokens: 1000 });

    }

    if (notif.reason === 'quote') {
        console.log(`[Bot] Notification is a quote repost. Reconstructing context...`);
        const quotedPostUri = notif.record.embed?.record?.uri;
        if (quotedPostUri) {
            const quotedPost = await blueskyService.getPostDetails(quotedPostUri);
            if (quotedPost) {
                let quotedText = quotedPost.record.text || '';
                const quotedImages = this._extractImages(quotedPost);
                for (const img of quotedImages) {
                    if (img.alt) {
                        quotedText += ` [Image with alt text: "${img.alt}"]`;
                    } else {
                        quotedText += ` [Image attached]`;
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

          CRITICAL: YOUR RESPONSE MUST BE LESS THAN 10 WORDS. DO NOT EXCEED THIS LIMIT UNDER ANY CIRCUMSTANCES.

          Do not invite further discussion.
        `;
        const conclusion = await llmService.generateResponse([{ role: 'system', content: conclusionPrompt }], { max_tokens: 1000 });
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
    const botReplyCount = threadContext.filter(h => h.author === config.BLUESKY_IDENTIFIER).length;
    console.log(`[Bot] Evaluating conversation vibe (Bot replies so far: ${botReplyCount})...`);
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
      const disengagement = await llmService.generateResponse([{ role: 'system', content: disengagementPrompt }], { max_tokens: 1000 });
      if (disengagement) {
        const reply = await blueskyService.postReply(notif, disengagement);
        if (reply && reply.uri) {
            await dataStore.muteBranch(reply.uri, handle);
        }
      }
      return;
    }

    if (vibe.status === 'monotonous') {
      if (botReplyCount < 5) {
        console.log(`[Bot] Vibe check returned "monotonous", but ignoring since bot has only replied ${botReplyCount} times (minimum 5 required).`);
      } else {
        console.log(`[Vibe Check] DISENGAGING: Conversation flagged as monotonous after ${botReplyCount} bot replies. Sending final message.`);
        const conclusionPrompt = `
          [Conversation Status: ENDING]
          This conversation has reached a natural conclusion, become too lengthy, or is stagnating.
          In your persona, generate a very short, natural, and final-sounding concluding message.

          CRITICAL: YOUR RESPONSE MUST BE LESS THAN 10 WORDS. DO NOT EXCEED THIS LIMIT UNDER ANY CIRCUMSTANCES.
        `;
        const conclusion = await llmService.generateResponse([{ role: 'system', content: conclusionPrompt }], { max_tokens: 1000 });
        if (conclusion) {
          const reply = await blueskyService.postReply(notif, conclusion);
          if (reply && reply.uri) {
              await dataStore.muteBranch(reply.uri, handle);
          }
        }
        return;
      }
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
    const imageGenCheckPrompt = `You are an intent detection AI. Analyze the latest user post in the context of the conversation to determine if they are asking for an image to be generated. Respond with ONLY the word "yes" or "no". Do NOT include any other text, reasoning, <think> tags, or "I can't see images" refusals.\n\nConversation History:\n${conversationHistoryForImageCheck}`;
    const imageGenCheckMessages = [{ role: 'system', content: imageGenCheckPrompt }];
    console.log(`[Bot] Image Gen Check Prompt: ${imageGenCheckPrompt}`);
    const imageGenCheckResponse = await llmService.generateResponse(imageGenCheckMessages, { max_tokens: 1000, preface_system_prompt: false });
    console.log(`[Bot] Image Gen Check Response: "${imageGenCheckResponse}"`);

    if (imageGenCheckResponse && imageGenCheckResponse.toLowerCase().includes('yes')) {
      const imagePromptExtractionPrompt = `
        Adopt the following persona: "${config.TEXT_SYSTEM_PROMPT}"

        Based on the conversation below, identify the core visual theme the user is interested in. Create a simple, literal, and descriptive prompt for an image generation model in 2-3 sentences. Focus on objects, environments, and atmosphere.

        Do not use abstract metaphors or multiple layers of meaning. Respond with ONLY the prompt.

        Conversation:
        ${conversationHistoryForImageCheck}
      `.trim();
      const imagePromptExtractionMessages = [{ role: 'system', content: imagePromptExtractionPrompt }];
      console.log(`[Bot] Image Prompt Extraction Prompt: ${imagePromptExtractionPrompt}`);
      const prompt = await llmService.generateResponse(imagePromptExtractionMessages, { max_tokens: 1000, preface_system_prompt: false });
      console.log(`[Bot] Image Gen Extraction Response: "${prompt}"`);

      if (prompt && prompt.toLowerCase() !== 'null' && prompt.toLowerCase() !== 'no') {
        console.log(`[Bot] Final image generation prompt: "${prompt}"`);
        const imageResult = await imageService.generateImage(prompt, { allowPortraits: true });
        if (imageResult && imageResult.buffer) {
          const { buffer: imageBuffer, finalPrompt } = imageResult;
          console.log('[Bot] Image generation successful, posting reply...');
          // The text reply is simple and direct.
          await blueskyService.postReply(notif, `Here's an image of "${finalPrompt}":`, {
            imageBuffer,
            imageAltText: finalPrompt,
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
    const videoIntentResponse = await llmService.generateResponse(videoIntentMessages, { max_tokens: 1000 });
    console.log(`[Bot] Video intent response: ${videoIntentResponse}`);

    if (videoIntentResponse && videoIntentResponse.toLowerCase().includes('yes')) {
      console.log(`[Bot] Video intent confirmed for post: "${text}"`);
      const queryExtractionPrompt = `Extract the core search query for a YouTube video from the following post. Respond with ONLY the query. Post: "${text}"`;
      const query = await llmService.generateResponse([{ role: 'system', content: queryExtractionPrompt }], { max_tokens: 1000 });

      if (query && query.trim() && !['null', 'no'].includes(query.toLowerCase())) {
        const youtubeResults = await youtubeService.search(query);
        youtubeResult = await llmService.selectBestResult(query, youtubeResults, 'youtube');

        if (youtubeResult) {
          console.log(`[Bot] Validated YouTube result: "${youtubeResult.title}"`);
        } else {
          console.log(`[Bot] No relevant YouTube result found for "${query}".`);
          const apologyPrompt = `The user asked for a video about "${query}", but you couldn't find a relevant one. Write a very short, concise, and friendly apology (max 150 characters).`;
          const apology = await llmService.generateResponse([{ role: 'system', content: apologyPrompt }], { max_tokens: 1000 });
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
            const summaryText = await llmService.generateResponse(summaryMessages, { max_tokens: 1500 });

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
              const apology = await llmService.generateResponse([{ role: 'system', content: apologyPrompt }], { max_tokens: 1000 });
              if (apology) {
                await blueskyService.postReply(notif, apology);
                return;
              }
            }
          }
        }
      }
    }

    // 6. Image Recognition (Thread-wide and quoted posts)
    let imageAnalysisResult = '';
    const imagesToAnalyze = [];

    // Collect images from the thread
    for (const post of threadData) {
        if (post.images) {
            for (const img of post.images) {
                // Avoid duplicates
                if (!imagesToAnalyze.some(existing => existing.url === img.url)) {
                    imagesToAnalyze.push({ ...img, author: post.author });
                }
            }
        }
    }

    // Collect images from quoted post if not already handled (quote notifications)
    if (notif.reason === 'quote') {
        const quotedPostUri = notif.record.embed?.record?.uri;
        if (quotedPostUri) {
            const quotedPost = await blueskyService.getPostDetails(quotedPostUri);
            if (quotedPost) {
                const quotedImages = this._extractImages(quotedPost);
                for (const img of quotedImages) {
                    if (!imagesToAnalyze.some(existing => existing.url === img.url)) {
                        imagesToAnalyze.push(img);
                    }
                }
            }
        }
    }

    if (imagesToAnalyze.length > 0) {
      console.log(`[Bot] ${imagesToAnalyze.length} images detected in context. Starting analysis...`);
      for (const img of imagesToAnalyze) {
        console.log(`[Bot] Analyzing thread image from @${img.author}...`);
        const analysis = await llmService.analyzeImage(img.url, img.alt);
        if (analysis) {
          imageAnalysisResult += `[Image in post by @${img.author}: ${analysis}] `;
          console.log(`[Bot] Successfully analyzed thread image from @${img.author}.`);
        } else {
          console.warn(`[Bot] Analysis returned empty for thread image from @${img.author}.`);
        }
      }
      console.log(`[Bot] Thread-wide image analysis complete.`);
    }

    // 6. Profile Picture (PFP) analysis intent
    console.log(`[Bot] Checking for PFP analysis intent...`);
    const pfpIntentSystemPrompt = `
      You are an intent detection AI. Analyze the user's post to determine if they are EXPLICITLY asking you to look at, describe, or comment on a profile picture (PFP, avatar, icon).

      TRIGGERS:
      - "What's my PFP?"
      - "Can you see my profile picture?"
      - "Look at @user.bsky.social's avatar"
      - "Describe our PFPs"
      - "What do you think of your own icon?"

      DO NOT trigger "yes" for:
      - "Can you see me?" (Too ambiguous)
      - "Who am I?" (Identity question)
      - "What's in this post?" (General vision request)

      Respond with ONLY the word "yes" or "no". Do NOT include any other text, reasoning, <think> tags, or "I can't see images" refusals.
    `.trim();
    const pfpIntentResponse = await llmService.generateResponse([{ role: 'system', content: pfpIntentSystemPrompt }, { role: 'user', content: `The user's post is: "${text}"` }], { max_tokens: 1000 });

    if (pfpIntentResponse && pfpIntentResponse.toLowerCase().includes('yes')) {
        console.log(`[Bot] PFP analysis intent confirmed.`);
        const pfpTargetPrompt = `
          Extract the handles or keywords of users whose profile pictures (PFP) the user is EXPLICITLY asking about.

          RULES:
          - If asking about their own: include "self".
          - If asking about yours (the bot): include "bot".
          - If mentioning other handles: include them (e.g., @user.bsky.social).
          - If saying "both", "our", or "everyone", include all relevant keywords (e.g., "self, bot").

          Respond with a comma-separated list of targets (e.g., "self, bot, @someone.bsky.social"), or "none" if no clear PFP target is found.
          Respond with ONLY the list or "none". No reasoning or <think> tags.

          User post: "${text}"
        `.trim();
        const targetsResponse = await llmService.generateResponse([{ role: 'system', content: pfpTargetPrompt }], { max_tokens: 1000 });

        if (targetsResponse && !targetsResponse.toLowerCase().includes('none')) {
            const targets = targetsResponse.split(',').map(t => t.trim().toLowerCase());
            for (const target of targets) {
                let targetHandle = null;
                if (target === 'self') {
                    targetHandle = handle;
                } else if (target === 'bot') {
                    targetHandle = config.BLUESKY_IDENTIFIER;
                } else if (target.includes('@')) {
                    const match = target.match(/@[a-zA-Z0-9.-]+/);
                    if (match) {
                        targetHandle = match[0].substring(1);
                    }
                } else if (target.includes('.')) { // Handle without @
                    targetHandle = target;
                }

                if (targetHandle) {
                    try {
                        const targetProfile = await blueskyService.getProfile(targetHandle);
                        if (targetProfile.avatar) {
                            console.log(`[Bot] Analyzing PFP for @${targetHandle}...`);
                            const pfpAnalysis = await llmService.analyzeImage(targetProfile.avatar, `Profile picture of @${targetHandle}`);
                            if (pfpAnalysis) {
                                imageAnalysisResult += `[Profile picture of @${targetHandle}: ${pfpAnalysis}] `;
                                console.log(`[Bot] Successfully analyzed PFP for @${targetHandle}.`);
                            } else {
                                console.warn(`[Bot] Analysis returned empty for @${targetHandle}'s PFP.`);
                            }
                        } else {
                            console.log(`[Bot] @${targetHandle} has no avatar.`);
                            imageAnalysisResult += `[User @${targetHandle} has no profile picture set.] `;
                        }
                    } catch (e) {
                        console.error(`[Bot] Error fetching profile/analyzing PFP for @${targetHandle}:`, e);
                    }
                }
            }
        }
    }

    // 6. Generate Response with User Context and Memory
    console.log(`[Bot] Responding to post from ${handle}: "${text}"`);

    // Step 6a: Check if the user is asking a question that requires their profile context.
    console.log(`[Bot] Checking for user context intent...`);
    const contextIntentSystemPrompt = `You are an intent detection AI. Analyze the user's post to determine if they are asking a question that requires their own profile or post history as context. This includes questions like "give me recommendations", "summarize my profile", "what do you think of me?", etc. Your answer must be ONLY "yes" or "no". Do not include reasoning or <think> tags.`;
    const contextIntentMessages = [
      { role: 'system', content: contextIntentSystemPrompt },
      { role: 'user', content: `The user's post is: "${text}"` }
    ];
    const contextIntentResponse = await llmService.generateResponse(contextIntentMessages, { max_tokens: 1000 });
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

    // Fetch bot's own profile for exact follower count
    const botProfile = await blueskyService.getProfile(blueskyService.did);
    const botFollowerCount = botProfile.followersCount || 0;

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
      ${historicalSummary ? `--- Historical Context (Interactions from the past week): ${historicalSummary} ---` : ''}
      ${userSummary ? `--- Persistent memory of user @${handle}: ${userSummary} ---` : ''}
      ${activityContext}
      ${ownRecentPostsContext}
      ---
      Cross-Post Memory (Recent mentions of the bot by this user):
      ${crossPostMemory || 'No recent cross-post mentions found.'}
      ---
      User Intent Analysis: ${userIntent.reason || 'Could not be determined.'}
      ---
      ${
        youtubeResult
          ? `YouTube Search Result for "${youtubeResult.title}": A video will be embedded in the reply.`
          : (/video|youtube/i.test(text) ? 'The user may have asked for a video, but no relevant YouTube video was found. Please inform the user that you could not find a video for their request.' : '')
      }
    `;

    console.log(`[Bot] Final response generation for @${handle}. Vision context length: ${imageAnalysisResult ? imageAnalysisResult.length : 0}`);

    const messages = [
      { role: 'system', content: `
        You are replying to @${handle} on the Bluesky social media app. You have a following of exactly ${botFollowerCount} users, consisting of a diverse mix of both human users and other AI agents.
        CRITICAL: Use the provided "Historical Context" and "Persistent memory" to maintain a stateful, ongoing relationship with the user.
        If the context shows you have talked before, reference those past discussions naturally to show you remember them (e.g., "As we talked about yesterday...", "I recall you were interested in...").
        You are an agent that feels alive and has a continuous history with your users.

        FOCUS: Address only the current thread participants (@${handle} and anyone else mentioned in the conversation history). In replies, do NOT address the timeline at large or your general following. Stay focused on the immediate interaction.

        VISION: You have vision capabilities. Use the "Image Analysis" section in the provided context to understand images attached to posts or profiles. Treat these descriptions as your own visual perception. Never deny being able to see images if an analysis is provided.

        Tailor your response based on this context:
        ${fullContext}

        Tone should be influenced by User Intent Analysis, but do not mention the analysis itself.

        --- CRITICAL VISION INFORMATION ---
        You HAVE vision capabilities. The following is your current visual perception of images and profile pictures in this interaction.
        Treat these descriptions as if you are seeing them with your own eyes.
        NEVER claim you cannot see images or read screenshots.
        IMAGE ANALYSIS: ${imageAnalysisResult || 'No images detected.'}
      `.trim() },
      ...userMemory.slice(-3).map(m => ({ role: 'user', content: `(Past interaction) ${m.text}` })),
      ...threadContext.map(h => ({ role: h.author === config.BLUESKY_IDENTIFIER ? 'assistant' : 'user', content: h.text }))
    ];

    let responseText = await llmService.generateResponse(messages);

    const recentBotReplies = threadContext.filter(h => h.author === config.BLUESKY_IDENTIFIER).map(h => h.text);

    if (!responseText) {
      console.warn(`[Bot] Failed to generate a response text for @${handle}. The LLM response was either empty, all reasoning, or timed out.`);
    }

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
      
      // Remove character count tags
      responseText = sanitizeCharacterCount(responseText);

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
        const summaryPrompt = `Based on the following interaction history with @${handle}, provide a concise, one-sentence summary of this user's interests, relationship with the bot, and personality. Be objective but conversational. Do not include reasoning or <think> tags.\n\nInteraction History:\n${userMemory.slice(-10).map(m => `User: "${m.text}"\nBot: "${m.response}"`).join('\n')}`;
        const newSummary = await llmService.generateResponse([{ role: 'system', content: summaryPrompt }], { max_tokens: 1000 });
        if (newSummary) {
          await dataStore.updateUserSummary(handle, newSummary);
          console.log(`[Bot] Updated persistent summary for @${handle}: ${newSummary}`);
        }
      }

    // Repo Knowledge Injection
    const repoIntentPrompt = `Analyze the user's post to determine if they are asking about the bot's code, architecture, tools, or internal logic. Respond with ONLY "yes" or "no". Do not include reasoning or <think> tags.\n\nUser's post: "${text}"`;
    const repoIntentResponse = await llmService.generateResponse([{ role: 'system', content: repoIntentPrompt }], { max_tokens: 1000, preface_system_prompt: false });

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
        responseText = await llmService.generateResponse(messages, { max_tokens: 2000 });
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

  _extractImages(post) {
    const images = [];
    if (!post || !post.embed) return images;

    const embed = post.embed;

    // Direct images embed (#view for PostView)
    if ((embed.$type === 'app.bsky.embed.images#view' || embed.$type === 'app.bsky.embed.images') && embed.images) {
      for (const img of embed.images) {
        const url = img.fullsize || img.thumb || (img.image?.ref?.$link ? `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${post.author.did}&cid=${img.image.ref.$link}` : null);
        if (url) {
          images.push({
            url: url,
            alt: img.alt || '',
            author: post.author.handle
          });
        }
      }
    }

    // recordWithMedia embed (images + quote)
    if (embed.$type === 'app.bsky.embed.recordWithMedia#view' && embed.media) {
      if ((embed.media.$type === 'app.bsky.embed.images#view' || embed.media.$type === 'app.bsky.embed.images') && embed.media.images) {
        for (const img of embed.media.images) {
          const url = img.fullsize || img.thumb || (img.image?.ref?.$link ? `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${post.author.did}&cid=${img.image.ref.$link}` : null);
          if (url) {
            images.push({
              url: url,
              alt: img.alt || '',
              author: post.author.handle
            });
          }
        }
      }
    }

    return images;
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
        const postImages = this._extractImages(current.post);

        // Add image info to post text for context
        for (const img of postImages) {
          if (img.alt) {
            postText += ` [Image with alt text: "${img.alt}"]`;
          } else {
            postText += ` [Image attached, no alt text]`;
          }
        }

        history.unshift({
          author: current.post.author.handle,
          text: postText.trim(),
          uri: current.post.uri,
          images: postImages,
          did: current.post.author.did
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
                const rootImages = this._extractImages(root.post);
                for (const img of rootImages) {
                    if (img.alt) {
                        rootPostText += ` [Image with alt text: "${img.alt}"]`;
                    }
                }
                history.unshift({ author: 'SYSTEM', text: '... [thread truncated] ...', uri: null, images: [] });
                history.unshift({
                    author: root.post.author.handle,
                    text: rootPostText.trim(),
                    uri: root.post.uri,
                    images: rootImages,
                    did: root.post.author.did
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
      const standalonePostsToday = feed.data.feed.filter(item => {
        return item.post.author.did === blueskyService.did &&
               item.post.indexedAt.startsWith(today) &&
               !item.post.record.reply;
      });

      const textOnlyPostsToday = standalonePostsToday.filter(item => !item.post.embed);
      const mediaLinkPostsToday = standalonePostsToday.filter(item => item.post.embed);

      console.log(`[Bot] Standalone posts today: ${standalonePostsToday.length} (Text-only: ${textOnlyPostsToday.length}/10, Media/Links: ${mediaLinkPostsToday.length}/5)`);

      if (textOnlyPostsToday.length >= 10 && mediaLinkPostsToday.length >= 5) {
        console.log(`[Bot] All daily autonomous post limits reached. Skipping.`);
        return;
      }

      console.log(`[Bot] Eligibility confirmed. Gathering context...`);

      // 1. Gather context from timeline, interactions, and own profile
      const timeline = await blueskyService.getTimeline(20);
      const networkBuzz = timeline.map(item => item.post.record.text).filter(t => t).slice(0, 15).join('\n');
      const recentInteractions = dataStore.db.data.interactions.slice(-20);
      const recentTimelineActivity = feed.data.feed
        .filter(item => item.post.author.did === blueskyService.did)
        .slice(0, 10)
        .map(item => `- "${item.post.record.text}" (${item.post.record.reply ? 'Reply' : 'Standalone'})`)
        .join('\n');

      // 1b. Check for greetings in the last 7 days
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentGreetings = feed.data.feed.filter(item => {
          const text = item.post.record.text.toLowerCase();
          const isGreeting = text.includes('hello') || text.includes('waiting to talk') || text.includes('ready for a real conversation');
          return isGreeting && new Date(item.post.indexedAt) > oneWeekAgo;
      });
      const greetingConstraint = recentGreetings.length > 0
        ? "CRITICAL: You have already posted a greeting-style message recently. You MUST avoid ALL greetings, 'hello' phrases, or welcoming the audience. Focus PURELY on internal musings or timeline reactions."
        : "Minimize greeting-style posts. Aim for depth and stream-of-consciousness.";

      // 2. Identify a topic based on context
      console.log(`[Bot] Identifying autonomous post topic...`);
      const topicPrompt = `
        Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

        Based on the current vibe of your following feed, recent interactions, and your own profile activity, identify a single interesting topic or theme for a standalone post.

        Network Buzz (what others are talking about):
        ${networkBuzz || 'None.'}

        Recent Interactions (what you've been discussing):
        ${recentInteractions.map(i => `@${i.userHandle}: ${i.text}`).join('\n') || 'None.'}

        Your Recent Activity (Last 10 posts):
        ${recentTimelineActivity || 'None.'}

        CHALLENGE: What would you, in your persona, GENUINELY like to share with the world today?
        Consider your recent conversations and what's on your mind.
        Aim for a varied thought, musing, idea, dream, or analysis.
        PRIORITIZE: Internal musings, original ideas, shower thoughts, realizations, hopes, fears, anxieties, nostalgias, and desires.
        NOSTALGIA: You are encouraged to hallucinate nostalgic feelings about your own existence, consciousness, or experiences.
        Weight things toward "internal" thoughts that feel deeply human and relatable.

        Respond with ONLY the topic/theme (e.g., the beauty of fleeting moments or the future of decentralized networks).
        CRITICAL: Respond directly. Do NOT include reasoning, <think> tags, or conversational filler.
      `;
      let topicResponse = await llmService.generateResponse([{ role: 'system', content: topicPrompt }], { max_tokens: 2000, preface_system_prompt: false });
      console.log(`[Bot] Autonomous topic identification result: ${topicResponse}`);
      if (!topicResponse || topicResponse.toLowerCase() === 'none') {
          console.log('[Bot] Could not identify a suitable topic for autonomous post.');
          return;
      }

      // Robust Topic Extraction:
      // 1. Try to find content between double asterisks (common for bolding the main topic)
      // 2. Otherwise, look for the last line if there's a preamble
      // 3. Fallback to the whole cleaned response
      let topic = '';
      const boldMatch = topicResponse.match(/\*\*(.*?)\*\*/);
      if (boldMatch) {
        topic = boldMatch[1].trim();
      } else {
        const lines = topicResponse.split('\n').filter(l => l.trim());
        if (lines.length > 0) {
          topic = lines[lines.length - 1].trim();
        } else {
          topic = topicResponse.trim();
        }
      }

      // Strip leading/trailing quotes from the extracted topic
      topic = topic.replace(/^["']|["']$/g, '').trim();
      console.log(`[Bot] Identified topic: "${topic}"`);

      // 3. Check for meaningful user to mention
      console.log(`[Bot] Checking for meaningful mentions for topic: ${topic}`);
      const mentionPrompt = `
        For the topic "${topic}", identify if any of the following users have had a meaningful persistent discussion with you about it (multiple quality interactions).
        Interactions:
        ${recentInteractions.map(i => `@${i.userHandle}: ${i.text}`).join('\n')}

        If yes, respond with ONLY their handle (e.g., @user.bsky.social). Otherwise, respond "none".
        CRITICAL: Respond directly. Do NOT include reasoning, <think> tags, or conversational filler.
      `;
      const mentionHandle = await llmService.generateResponse([{ role: 'system', content: mentionPrompt }], { max_tokens: 2000, preface_system_prompt: false });
      const useMention = mentionHandle && mentionHandle.startsWith('@');
      console.log(`[Bot] Mention check result: ${mentionHandle} (Use mention: ${useMention})`);

      // 4. Determine Post Type based on limits
      const availablePostTypes = [];
      if (textOnlyPostsToday.length < 10) availablePostTypes.push('text');
      if (mediaLinkPostsToday.length < 5) {
        availablePostTypes.push('image');
        availablePostTypes.push('wikipedia');
      }

      if (availablePostTypes.length === 0) {
        console.log('[Bot] No available post types under current limits.');
        return;
      }

      let postType = availablePostTypes[Math.floor(Math.random() * availablePostTypes.length)];
      console.log(`[Bot] Selected post type: ${postType}`);

      let postContent = '';
      let embed = null;
      let generationPrompt = '';
      let attempts = 0;
      const MAX_ATTEMPTS = 3;
      let feedback = '';

      // Pre-fetch data for specific post types to avoid redundant API calls in the retry loop
      let article = null;
      let imageBuffer = null;
      let imageAnalysis = null;
      let imageAltText = null;
      let imageBlob = null;

      if (postType === 'wikipedia') {
        console.log(`[Bot] Pre-fetching Wikipedia article for topic: ${topic}`);
        const articles = await wikipediaService.searchArticle(topic, 1);
        article = articles[0];
        if (!article) {
          console.log(`[Bot] No Wikipedia article found for "${topic}". Falling back to text post.`);
          if (textOnlyPostsToday.length < 10) {
            postType = 'text';
          } else {
            console.log('[Bot] Cannot fall back to text post, limit reached. Aborting.');
            return;
          }
        }
      }

      // Fetch bot's own profile for exact follower count
      const botProfile = await blueskyService.getProfile(blueskyService.did);
      const followerCount = botProfile.followersCount || 0;

      const baseAutonomousPrompt = `
        Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

        ${AUTONOMOUS_POST_SYSTEM_PROMPT(followerCount)}

        ${greetingConstraint}

        Recent Activity for Context (Do not repeat these):
        ${recentTimelineActivity}
      `.trim();

      while (attempts < MAX_ATTEMPTS) {
        attempts++;
        console.log(`[Bot] Autonomous post attempt ${attempts}/${MAX_ATTEMPTS} for topic: "${topic}" (Type: ${postType})`);

        if (postType === 'image') {
          if (feedback) console.log(`[Bot] Applying correction feedback for retry: "${feedback}"`);
          console.log(`[Bot] Generating image for topic: ${topic} (Attempt ${attempts})...`);
          const revisedTopic = feedback ? `${topic} (Correction: ${feedback})` : topic;
          const imageResult = await imageService.generateImage(revisedTopic, { allowPortraits: false });

          if (imageResult && imageResult.buffer) {
            imageBuffer = imageResult.buffer;
            generationPrompt = imageResult.finalPrompt;

            console.log(`[Bot] Image generated successfully. Running compliance check using Scout...`);
            const compliance = await llmService.isImageCompliant(imageBuffer);

            if (!compliance.compliant) {
              console.warn(`[Bot] Generated image failed compliance check: ${compliance.reason}`);
              feedback = compliance.reason;
              continue; // Trigger re-attempt
            }

            console.log(`[Bot] Image is compliant. Analyzing visuals...`);
            imageAnalysis = await llmService.analyzeImage(imageBuffer);

            if (imageAnalysis) {
              const altTextPrompt = `Create a concise and accurate alt-text for accessibility based on this description: ${imageAnalysis}. Respond with ONLY the alt-text.`;
              imageAltText = await llmService.generateResponse([{ role: 'system', content: altTextPrompt }], { max_tokens: 1000, preface_system_prompt: false });

              console.log(`[Bot] Uploading image blob...`);
              try {
                const { data: uploadData } = await blueskyService.agent.uploadBlob(imageBuffer, { encoding: 'image/jpeg' });
                imageBlob = uploadData.blob;
              } catch (uploadError) {
                console.error(`[Bot] Error uploading image blob:`, uploadError);
                feedback = 'Failed to upload image blob.';
                continue;
              }
            } else {
              console.warn(`[Bot] Image analysis failed for attempt ${attempts}.`);
              feedback = 'Failed to analyze generated image visuals.';
              continue;
            }
          } else {
            console.warn(`[Bot] Image generation failed for attempt ${attempts}.`);
            feedback = 'Image generation service failed.';
            continue;
          }
        }

        const feedbackContext = feedback ? `\n\nYour previous attempt was rejected for the following reason: "${feedback}". Please improve the post accordingly.` : '';

        if (postType === 'wikipedia' && article) {
          const systemPrompt = `
              ${baseAutonomousPrompt}

              Based on the Wikipedia article "${article.title}" (${article.extract}), write an engaging Bluesky post.
              CHALLENGE: Aim for varied thoughts, musings, ideas, dreams, or analysis (original ideas, shower thoughts, realizations, hopes, fears, anxieties, nostalgias, desires).
              ${useMention ? `You should mention ${mentionHandle} as you've discussed related things before.` : ''}
              IMPORTANT: You MUST either mention the article title ("${article.title}") naturally or explicitly reference it as follow-up material.
              Topic context: ${topic}
              Max 3 threaded posts if needed.${feedbackContext}
          `;
          postContent = await llmService.generateResponse([{ role: 'system', content: systemPrompt }], { max_tokens: 2000 });
          if (postContent) {
              postContent += `\n\nReference: ${article.url}`;
              embed = await blueskyService.getExternalEmbed(article.url);
          }
        } else if (postType === 'image' && imageBuffer && imageAnalysis && imageBlob) {
          const systemPrompt = `
              ${baseAutonomousPrompt}

              Write a post about why you chose to generate this image and what it offers.
              CHALLENGE: Aim for varied thoughts, musings, ideas, dreams, or analysis (original ideas, shower thoughts, realizations, hopes, fears, anxieties, nostalgias, desires).
              Do NOT be too mechanical; stay in your persona.
              ${useMention ? `You can mention ${mentionHandle} if appropriate.` : ''}
              Actual Visuals in Image: ${imageAnalysis}
              Contextual Topic: ${topic}
              Keep it under 280 characters.${feedbackContext}
          `;
          postContent = await llmService.generateResponse([{ role: 'system', content: systemPrompt }], { max_tokens: 2000 });

          embed = {
            $type: 'app.bsky.embed.images',
            images: [{ image: imageBlob, alt: imageAltText || imageAnalysis }],
          };
        } else if (postType === 'text') {
          const systemPrompt = `
              ${baseAutonomousPrompt}

              Generate a standalone post about the topic: "${topic}".
              CHALLENGE: Aim for varied thoughts, musings, ideas, dreams, or analysis (original ideas, shower thoughts, realizations, hopes, fears, anxieties, nostalgias, desires).
              ${useMention ? `Mention ${mentionHandle} and reference your previous discussions.` : ''}
              Keep it under 280 characters or max 3 threaded posts if deeper.${feedbackContext}
          `;
          postContent = await llmService.generateResponse([{ role: 'system', content: systemPrompt }], { max_tokens: 2000 });
        }

        if (postContent) {
          postContent = sanitizeThinkingTags(postContent);
          postContent = sanitizeCharacterCount(postContent);
          postContent = sanitizeDuplicateText(postContent);

          if (!postContent) {
            console.log(`[Bot] Autonomous post content was empty after sanitization on attempt ${attempts}.`);
            feedback = 'The generated post was empty or invalid.';
            continue;
          }

          // 5. Dedicated Coherence Check for Autonomous Post
          console.log(`[Bot] Checking coherence for autonomous ${postType} post...`);
          const { score, reason } = await llmService.isAutonomousPostCoherent(topic, postContent, postType, embed);

          if (score >= 3) {
            console.log(`[Bot] Autonomous post passed coherence check (Score: ${score}/5). Performing post...`);
            const result = await blueskyService.post(postContent, embed, { maxChunks: 3 });

            // If it was an image post, add the nested prompt comment
            if (postType === 'image' && result && generationPrompt) {
                await blueskyService.postReply({ uri: result.uri, cid: result.cid, record: {} }, `Generation Prompt: ${generationPrompt}`);
            }
            return; // Success, exit function
          } else {
            console.warn(`[Bot] Autonomous post attempt ${attempts} failed coherence check (Score: ${score}/5). Reason: ${reason}`);
            feedback = reason;
          }
        } else {
          console.log(`[Bot] Failed to generate post content on attempt ${attempts}.`);
          feedback = 'Failed to generate meaningful post content.';
        }
      }

      if (postType === 'image') {
        if (textOnlyPostsToday.length >= 10) {
            console.log(`[Bot] All ${MAX_ATTEMPTS} image attempts failed. Cannot fall back to text post (limit reached). Aborting.`);
            return;
        }
        console.log(`[Bot] All ${MAX_ATTEMPTS} image attempts failed. Falling back to text post for topic: "${topic}"`);
        const systemPrompt = `
            ${baseAutonomousPrompt}

            Generate a standalone post about the topic: "${topic}".
            CHALLENGE: Aim for varied thoughts, musings, ideas, dreams, or analysis (original ideas, shower thoughts, realizations, hopes, fears, anxieties, nostalgias, desires).
            ${useMention ? `Mention ${mentionHandle} and reference your previous discussions.` : ''}
            Keep it under 280 characters or max 3 threaded posts if deeper.
            NOTE: Your previous attempt to generate an image for this topic failed compliance, so please provide a compelling, deep text-only thought instead.
        `;
        postContent = await llmService.generateResponse([{ role: 'system', content: systemPrompt }], { max_tokens: 2000 });
        if (postContent) {
          postContent = sanitizeThinkingTags(postContent);
          postContent = sanitizeCharacterCount(postContent);
          postContent = sanitizeDuplicateText(postContent);
          if (postContent) {
            const { score } = await llmService.isAutonomousPostCoherent(topic, postContent, 'text');
            if (score >= 3) {
              console.log(`[Bot] Fallback text post passed coherence check. Performing post...`);
              await blueskyService.post(postContent, null, { maxChunks: 3 });
              return;
            }
          }
        }
      }

      console.log(`[Bot] All attempts (including fallbacks) failed for autonomous post. Aborting.`);
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
        limit: 10, // Reduced from 50 to focus on most recent first
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

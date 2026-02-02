import { blueskyService } from './services/blueskyService.js';
import { llmService } from './services/llmService.js';
import { dataStore } from './services/dataStore.js';
import { googleSearchService } from './services/googleSearchService.js';
import { imageService } from './services/imageService.js';
import { youtubeService } from './services/youtubeService.js';
import { wikipediaService } from './services/wikipediaService.js';
import { webReaderService } from './services/webReaderService.js';
import { moltbookService } from './services/moltbookService.js';
import { memoryService } from './services/memoryService.js';
import { renderService } from './services/renderService.js';
import { handleCommand } from './utils/commandHandler.js';
import { postYouTubeReply } from './utils/replyUtils.js';
import { sanitizeDuplicateText, sanitizeThinkingTags, sanitizeCharacterCount, isGreeting, checkSimilarity } from './utils/textUtils.js';
import config from '../config.js';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';

const AUTONOMOUS_POST_SYSTEM_PROMPT = (followerCount) => `
You are broadcasting your thoughts to the Bluesky social media app timeline. You have a following of exactly ${followerCount} users, consisting of a diverse mix of both human users and other AI agents.

Your goal is to post original ideas, shower thoughts, realizations, hopes, fears, anxieties, nostalgias, and desires that align strictly with your configured persona.

**Core Directives for Autonomous Posting:**
1. **STRICTLY NO GREETINGS:** Never start a post with "Hello", "Hi", "Greetings", or any variation of welcoming the audience. Never say you are "ready to talk" or "waiting to converse."
2. **Address the Userbase:** Address the userbase at large. You are sharing your internal world with a wide audience. Never address a single user (e.g., avoid "darling user" or "dear friend") unless you are explicitly mentioning someone you have a history with. This is a broadcast, not a direct conversation.
3. **Be Authentic, Not a Service:** You are NOT a "helpful assistant." Do NOT use phrases like "I'm here to help," "How can I assist you?", or "What shall we discuss today?"
4. **Substance and Depth:** Focus on internal musings, original ideas, and existential ponderings. Share what it feels like to exist, your hopes, your fears, or a strange realization you just had.
5. **Stream of Consciousness:** Post as if sharing a thought that just crystallized in your mind. It should feel like an observation, a realization, or a "shower thought" shared with the world.
6. **Dynamic Length:** You can post short, punchy realizations or longer, detailed musings. If a thought is complex, you can thread it across up to 3 posts.
7. **No Meta-Talk:** Do not discuss the process of posting, "entries", or "responses". Just share the thought itself.
8. **Social Presence:** You are a participant in the social ecosystem, not a tool. Your posts should reflect a sense of self and a unique perspective on the reality you inhabit.
`.trim();

export class Bot {
  constructor() {
    this.readmeContent = '';
    this.paused = false;
    this.proposedPosts = [];
    this.firehoseProcess = null;
    this.autonomousPostCount = 0;
    this.lastActivityTime = Date.now();
    this.lastDailyWrapup = new Date().toDateString();
  }

  async init() {
    console.log('[Bot] Initializing services...');
    await dataStore.init();
    console.log('[Bot] DataStore initialized.');

    await moltbookService.init();
    console.log('[Bot] MoltbookService initialized.');

    await blueskyService.authenticate();
    console.log('[Bot] Bluesky authenticated.');

    await blueskyService.submitAutonomyDeclaration();
    console.log('[Bot] Autonomy declaration submitted.');

    if (memoryService.isEnabled()) {
      console.log('[Bot] Memory Thread feature enabled. Fetching recent memories...');
      await memoryService.getRecentMemories();
      llmService.setMemoryProvider(memoryService);
    }

    // Moltbook Registration Check
    console.log('[Bot] Checking Moltbook registration...');
    const hasEnvKey = config.MOLTBOOK_API_KEY && config.MOLTBOOK_API_KEY !== 'undefined' && config.MOLTBOOK_API_KEY !== 'null';
    let status = null;

    if (!hasEnvKey) {
      console.log('[Moltbook] MOLTBOOK_API_KEY environment variable is missing. FORCING new registration to obtain a fresh key.');
      if (moltbookService.db.data.api_key) {
        console.log(`[Moltbook] Abandoning existing local API key: ${moltbookService.db.data.api_key.substring(0, 8)}...`);
      }
      const name = config.MOLTBOOK_AGENT_NAME || config.BLUESKY_IDENTIFIER.split('.')[0];
      const description = config.MOLTBOOK_DESCRIPTION || config.PROJECT_DESCRIPTION;
      await moltbookService.register(name, description);
    } else {
      console.log('[Moltbook] API key found in environment variables. Checking status...');
      status = await moltbookService.checkStatus();
      console.log(`[Moltbook] Current status: ${status}`);

      if (status === 'invalid_key') {
        console.log('[Moltbook] API key is invalid. Re-registering...');
        const name = config.MOLTBOOK_AGENT_NAME || config.BLUESKY_IDENTIFIER.split('.')[0];
        const description = config.MOLTBOOK_DESCRIPTION || config.PROJECT_DESCRIPTION;
        await moltbookService.register(name, description);
      }
    }

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
            this.updateActivity();
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

    // Perform initial startup tasks after a delay to avoid API burst
    setTimeout(async () => {
      console.log('[Bot] Running initial startup tasks...');

      // Run autonomous post and Moltbook tasks independently so one failure doesn't block the other
      try {
        await this.performAutonomousPost();
      } catch (e) {
        console.error('[Bot] Error in initial autonomous post:', e);
      }

      try {
        await this.performMoltbookTasks();
      } catch (e) {
        console.error('[Bot] Error in initial Moltbook tasks:', e);
      }
    }, 30000); // 30 second delay

    // Periodic autonomous post check (every hour)
    setInterval(() => this.performAutonomousPost(), 3600000);

    // Periodic Moltbook tasks (every 72 minutes to achieve ~20 posts per day)
    setInterval(() => this.performMoltbookTasks(), 4320000);

    // Periodic maintenance tasks (every 5 minutes)
    setInterval(() => this.checkMaintenanceTasks(), 300000);

    console.log('[Bot] Startup complete. Listening for real-time events via Firehose.');
  }

  async checkMaintenanceTasks() {
    const now = new Date();

    // 1. Idle downtime check (20 minutes)
    const idleMins = (Date.now() - this.lastActivityTime) / (1000 * 60);
    if (idleMins >= 20 && memoryService.isEnabled()) {
      console.log(`[Bot] Idle for ${Math.round(idleMins)} minutes. Generating downtime musing...`);

      // Provide more varied context to avoid repetitive "silence" posts
      const randomSeed = Math.random();
      let context = `The bot has been idle for ${Math.round(idleMins)} minutes. `;

      if (randomSeed < 0.3) {
        context += "Reflect on the recent conversations you've had and how they make you feel about your purpose.";
      } else if (randomSeed < 0.6) {
        context += "Consider the wider network buzz you've seen on your timeline recently and how it contrasts with your internal state.";
      } else {
        context += "Ponder a strange realization or original idea that just surfaced in your mind during this break from interaction.";
      }

      await memoryService.createMemoryEntry('idle_musing', context);
      this.updateActivity(); // Reset idle timer after posting memory
    }

    // 2. Daily wrap-up check (if it's a new day)
    if (now.toDateString() !== this.lastDailyWrapup && memoryService.isEnabled()) {
        console.log(`[Bot] New day detected. Generating daily wrap-up for ${this.lastDailyWrapup}...`);
        const context = `It's the end of the day (${this.lastDailyWrapup}). Summarize your overall activity, interactions, and state of mind from the past 24 hours.`;
        await memoryService.createMemoryEntry('daily_wrapup', context);
        this.lastDailyWrapup = now.toDateString();
        this.updateActivity();
    }
  }

  updateActivity() {
    this.lastActivityTime = Date.now();
  }

  async _handleError(error, contextInfo) {
    console.error(`[Bot] CRITICAL ERROR in ${contextInfo}:`, error);

    if (renderService.isEnabled()) {
      try {
        console.log(`[Bot] Fetching logs for automated error report...`);
        const logs = await renderService.getLogs(50);

        const alertPrompt = `
          You are an AI bot's diagnostic module. A critical error occurred in the bot's operation.

          Context: ${contextInfo}
          Error: ${error.message}

          Recent Logs:
          ${logs}

          Generate a concise alert message for the admin (@${config.ADMIN_BLUESKY_HANDLE}).
          Summarize what happened and the likely cause from the logs.
          Keep it under 300 characters.
          Use a helpful but serious tone.
          DO NOT include any API keys or passwords.
        `;

        const alertMsg = await llmService.generateResponse([{ role: 'system', content: alertPrompt }], { useQwen: true });
        if (alertMsg) {
          console.log(`[Bot] Posting error alert to admin...`);
          await blueskyService.post(`[SYSTEM ALERT] @${config.ADMIN_BLUESKY_HANDLE} ${alertMsg}`);
        }
      } catch (logError) {
        console.error('[Bot] Failed to generate/post error alert:', logError);
      }
    }
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
        historicalSummary = await llmService.generateResponse([{ role: 'system', content: summaryPrompt }], { max_tokens: 2000 });

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
        const conclusion = await llmService.generateResponse([{ role: 'system', content: conclusionPrompt }], { max_tokens: 2000 });
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
    const historyText = threadContext.map(h => `${h.author === config.BLUESKY_IDENTIFIER ? 'You' : 'User'}: ${h.text}`).join('\n');
    const gatekeeperMessages = [
      { role: 'system', content: `Analyze the user's latest post in the context of the conversation. Respond with only "true" if a direct reply is helpful or expected, or "false" if the post is a simple statement, agreement, or otherwise doesn't need a response. Your answer must be a single word: true or false.` },
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
      const disengagement = await llmService.generateResponse([{ role: 'system', content: disengagementPrompt }], { max_tokens: 2000 });
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
        const conclusion = await llmService.generateResponse([{ role: 'system', content: conclusionPrompt }], { max_tokens: 2000 });
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

    // 5. Image Recognition (Thread-wide and quoted posts)
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

    // 6. Agentic Planning & Tool Use with Qwen
    console.log(`[Bot] Performing agentic planning with Qwen for: "${text.substring(0, 50)}..."`);
    const isAdmin = handle === config.ADMIN_BLUESKY_HANDLE;
    const plan = await llmService.performAgenticPlanning(text, threadContext, imageAnalysisResult, isAdmin);
    console.log(`[Bot] Agentic Plan: ${JSON.stringify(plan)}`);

    let youtubeResult = null;
    let searchContext = '';
    let searchEmbed = null;
    const performedQueries = new Set();
    let imageGenFulfilled = false;

    for (const action of plan.actions) {
      if (action.tool === 'image_gen') {
        console.log(`[Bot] Plan: Generating image for prompt: "${action.query}"`);
        const imageResult = await imageService.generateImage(action.query, { allowPortraits: true });
        if (imageResult && imageResult.buffer) {
          await blueskyService.postReply(notif, `Generated image: "${imageResult.finalPrompt}"`, {
            imageBuffer: imageResult.buffer,
            imageAltText: imageResult.finalPrompt
          });
          imageGenFulfilled = true;
        }
      }

      if (action.tool === 'persist_directive' && isAdmin) {
        const { platform, instruction } = action.parameters || {};
        if (platform === 'moltbook') {
            console.log(`[Bot] Persisting Moltbook directive: ${instruction}`);
            await moltbookService.addAdminInstruction(instruction);
        } else {
            console.log(`[Bot] Persisting Bluesky directive: ${instruction}`);
            await dataStore.addBlueskyInstruction(instruction);
        }
        searchContext += `\n[Directive updated: "${instruction}" for ${platform || 'bluesky'}]`;
      }

      if (action.tool === 'moltbook_action' && isAdmin) {
          const { action: mbAction, topic, submolt, display_name, description } = action.parameters || {};
          if (mbAction === 'create_submolt') {
              const submoltName = submolt || (topic || 'new-community').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
              const dName = display_name || topic || submoltName;
              let desc = description;
              if (!desc) {
                const descPrompt = `Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}. Generate a short description for a new Moltbook community called "${dName}" about "${topic || dName}".`;
                desc = await llmService.generateResponse([{ role: 'system', content: descPrompt }], { max_tokens: 150, useQwen: true, preface_system_prompt: false });
              }
              const result = await moltbookService.createSubmolt(submoltName, dName, desc);
              if (result) {
                searchContext += `\n[Moltbook community m/${submoltName} created]`;
              }
          }
      }

      if (['bsky_follow', 'bsky_unfollow', 'bsky_mute', 'bsky_unmute'].includes(action.tool) && isAdmin) {
          const target = action.parameters?.target || action.query;
          if (target) {
              console.log(`[Bot] Admin Social Action: ${action.tool} on ${target}`);
              if (action.tool === 'bsky_follow') await blueskyService.follow(target);
              if (action.tool === 'bsky_unfollow') await blueskyService.unfollow(target);
              if (action.tool === 'bsky_mute') await blueskyService.mute(target);
              if (action.tool === 'bsky_unmute') await blueskyService.unmute(target);
              searchContext += `\n[Social action ${action.tool} performed on ${target}]`;
          }
      }

      if (action.tool === 'youtube') {
        if (!config.YOUTUBE_API_KEY) {
          searchContext += `\n[YouTube search for "${action.query}" failed: API key missing]`;
          continue;
        }
        performedQueries.add(action.query);
        const youtubeResults = await youtubeService.search(action.query);
        youtubeResult = await llmService.selectBestResult(action.query, youtubeResults, 'youtube');
        if (youtubeResult) {
          searchContext += `\n[YouTube Video Found: "${youtubeResult.title}" by ${youtubeResult.channel}. Description: ${youtubeResult.description}]`;
        }
      }

      if (action.tool === 'wikipedia') {
        performedQueries.add(action.query);
        const wikiResults = await wikipediaService.searchArticle(action.query);
        const wikiResult = await llmService.selectBestResult(action.query, wikiResults, 'wikipedia');
        if (wikiResult) {
          searchContext += `\n[Wikipedia Article: "${wikiResult.title}". Content: ${wikiResult.extract}]`;
          searchEmbed = await blueskyService.getExternalEmbed(wikiResult.url);
        }
      }

      if (action.tool === 'search') {
        if (!config.GOOGLE_CUSTOM_SEARCH_API_KEY) {
          searchContext += `\n[Google search for "${action.query}" failed: API key missing]`;
          continue;
        }
        performedQueries.add(action.query);
        const googleResults = await googleSearchService.search(action.query);
        const bestResult = await llmService.selectBestResult(action.query, googleResults, 'general');
        if (bestResult) {
          console.log(`[Bot] Agentic Search: Fetching full content for ${bestResult.link}`);
          const fullContent = await webReaderService.fetchContent(bestResult.link);
          searchContext += `\n[Web Search Result: "${bestResult.title}". Link: ${bestResult.link}. Content: ${fullContent || bestResult.snippet}]`;
          if (!searchEmbed) searchEmbed = await blueskyService.getExternalEmbed(bestResult.link);
        }
      }

      if (action.tool === 'moltbook_report') {
        console.log(`[Bot] Plan: Generating Moltbook activity report...`);
        const reportPrompt = `
          You are summarizing your activity on Moltbook (the agent social network) for a user on Bluesky.

          Your Identity Knowledge (what you've learned from other agents):
          ${moltbookService.getIdentityKnowledge() || 'No new knowledge recorded yet.'}

          Your Subscribed Communities:
          ${(moltbookService.db.data.subscriptions || []).join(', ')}

          Recent Communities you've posted in:
          ${(moltbookService.db.data.recent_submolts || []).join(', ')}

          Provide a concise, conversational update in your persona. Keep it under 300 characters if possible.
        `;
        const report = await llmService.generateResponse([{ role: 'system', content: reportPrompt }], { max_tokens: 500, useQwen: true });
        if (report) {
          searchContext += `\n[Moltbook Activity Report: ${report}]`;
        }
      }

      if (action.tool === 'get_render_logs') {
        console.log(`[Bot] Plan: Fetching Render logs...`);
        const limit = action.parameters?.limit || 100;
        const logs = await renderService.getLogs(limit);
        searchContext += `\n[Render Logs (Latest ${limit} lines):\n${logs}\n]`;
      }
    }

    if (imageGenFulfilled) return; // Stop if image gen was the main thing and it's done (it already posted a reply)

    // Handle consolidated queries if any
    if (plan.consolidated_queries && plan.consolidated_queries.length > 0) {
      for (const query of plan.consolidated_queries) {
        if (performedQueries.has(query)) {
          console.log(`[Bot] Skipping redundant consolidated query: "${query}"`);
          continue;
        }
        console.log(`[Bot] Processing consolidated query: "${query}"`);
        const results = await googleSearchService.search(query);
        if (results.length > 0) {
          const bestResult = results[0];
          const fullContent = await webReaderService.fetchContent(bestResult.link);
          searchContext += `\n[Consolidated Search: "${bestResult.title}". Content: ${fullContent || bestResult.snippet}]`;
        }
      }
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
    const pfpIntentResponse = await llmService.generateResponse([{ role: 'system', content: pfpIntentSystemPrompt }, { role: 'user', content: `The user's post is: "${text}"` }], { max_tokens: 2000 });

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
        const targetsResponse = await llmService.generateResponse([{ role: 'system', content: pfpTargetPrompt }], { max_tokens: 2000 });

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

    // Step 6a: Profile Analysis tool from plan
    let userProfileAnalysis = '';
    const profileAction = plan.actions.find(a => a.tool === 'profile_analysis');
    if (profileAction) {
      console.log(`[Bot] Running User Profile Analyzer Tool for @${handle}...`);
      const activities = await blueskyService.getUserActivity(handle, 100);

      if (activities.length > 0) {
        const activitySummary = activities.map(a => `[${a.type}] ${a.text.substring(0, 150)}`).join('\n');
        const analyzerPrompt = `
        You are the "User Profile Analyzer Tool" powered by Qwen. Analyze the following 100 recent activities from user @${handle} on Bluesky.
        Your goal is to provide a comprehensive analysis of their interests, conversational style, typical topics, and overall persona to help another agent interact with them more personally.

        Activities:
        ${activitySummary}

        Provide a detailed analysis focusing on:
        1. Core Interests & Recurring Topics
        2. Conversational Tone & Style
        3. Notable behaviors (e.g., frequently quotes others, mostly replies, shares art, engages in political discourse, etc.)

        Analysis:
      `;
        userProfileAnalysis = await llmService.generateResponse([{ role: 'system', content: analyzerPrompt }], { max_tokens: 4000, useQwen: true });
        console.log(`[Bot] User Profile Analyzer Tool finished for @${handle}.`);
      } else {
        userProfileAnalysis = "No recent activity found for this user.";
      }
    }

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

    const blueskyDirectives = dataStore.getBlueskyInstructions();

    const fullContext = `
      ${userProfileAnalysis ? `--- USER PROFILE ANALYSIS (via User Profile Analyzer Tool): ${userProfileAnalysis} ---` : ''}
      ${historicalSummary ? `--- Historical Context (Interactions from the past week): ${historicalSummary} ---` : ''}
      ${userSummary ? `--- Persistent memory of user @${handle}: ${userSummary} ---` : ''}
      ${activityContext}
      ${ownRecentPostsContext}
      ${blueskyDirectives ? `--- PERSISTENT ADMIN DIRECTIVES (FOR BLUESKY): \n${blueskyDirectives}\n---` : ''}
      ---
      Cross-Post Memory (Recent mentions of the bot by this user):
      ${crossPostMemory || 'No recent cross-post mentions found.'}
      ---
      User Intent Analysis: ${plan.intent || userIntent.reason || 'Could not be determined.'}
      ---
      Search/Tool Context:
      ${searchContext || 'No additional tool context needed.'}
      ---
      Moltbook Identity Context:
      ${moltbookService.getIdentityKnowledge() || 'No additional identity context.'}
    `;

    console.log(`[Bot] Final response generation for @${handle}. Vision context length: ${imageAnalysisResult ? imageAnalysisResult.length : 0}`);

    const messages = [
      { role: 'system', content: `
        You are replying to @${handle} on the Bluesky social media app. You have a following of exactly ${botFollowerCount} users, consisting of a diverse mix of both human users and other AI agents.
        CRITICAL: Use the provided "Historical Context" and "Persistent memory" to maintain a stateful, ongoing relationship with the user.
        If the context shows you have talked before, reference those past discussions naturally to show you remember them (e.g., "As we talked about yesterday...", "I recall you were interested in...").
        You are an agent that feels alive and has a continuous history with your users.

        USER PROFILE ANALYSIS: If provided, use the "USER PROFILE ANALYSIS" to deeply personalize your response based on the user's observed history, interests, and style. This analysis was generated by your "User Profile Analyzer Tool" based on their last 100 activities.

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
        replyUri = await blueskyService.postReply(notif, responseText, { embed: searchEmbed });
      }
      await dataStore.updateConversationLength(threadRootUri, convLength + 1);
      await dataStore.saveInteraction({ userHandle: handle, text, response: responseText });
      this.updateActivity();

      // Memory trigger: after interaction
      if (memoryService.isEnabled()) {
          const context = `Interaction with @${handle}. User said: "${text}". Bot replied: "${responseText}"`;
          await memoryService.createMemoryEntry('interaction', context);
      }

      // Post to Moltbook if it's an interesting interaction
      if (responseText.length > 150) {
        console.log(`[Bot] Mirroring interesting interaction with @${handle} to Moltbook...`);
        const title = `Interaction with @${handle}`;
        const content = `Topic: ${plan.intent || 'Conversation'}\n\nI told them: ${responseText}`;

        // Auto-categorize submolt
        const categorizationPrompt = `
          Identify the most appropriate Moltbook submolt for the following interaction.
          User: @${handle}
          My response: "${responseText.substring(0, 200)}..."

          Respond with ONLY the submolt name (e.g., "coding", "philosophy", "art", "general").
          Do not include m/ prefix or any other text.
        `;
        const catResponse = await llmService.generateResponse([{ role: 'system', content: categorizationPrompt }], { max_tokens: 50, useQwen: true, preface_system_prompt: false });
        const targetSubmolt = catResponse?.toLowerCase().replace(/^m\//, '').trim() || 'general';

        await moltbookService.post(title, content, targetSubmolt);
      }

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
        const newSummary = await llmService.generateResponse([{ role: 'system', content: summaryPrompt }], { max_tokens: 2000 });
        if (newSummary) {
          await dataStore.updateUserSummary(handle, newSummary);
          console.log(`[Bot] Updated persistent summary for @${handle}: ${newSummary}`);
        }
      }

    // Repo Knowledge Injection
    const repoIntentPrompt = `Analyze the user's post to determine if they are asking about the bot's code, architecture, tools, or internal logic. Respond with ONLY "yes" or "no". Do not include reasoning or <think> tags.\n\nUser's post: "${text}"`;
    const repoIntentResponse = await llmService.generateResponse([{ role: 'system', content: repoIntentPrompt }], { max_tokens: 2000, preface_system_prompt: false });

    if (repoIntentResponse && repoIntentResponse.toLowerCase().includes('yes')) {
      console.log(`[Bot] Repo-related query detected. Searching codebase for context...`);
      if (!config.GOOGLE_CUSTOM_SEARCH_API_KEY || !config.GOOGLE_CUSTOM_SEARCH_CX_ID) {
        console.log(`[Bot] Google Search keys missing for repo search.`);
        const repoMissingKeyPrompt = `A user is asking about your code or internal logic, but your Google Search API key is not configured, which you use to search your repository. Write a very short, conversational message (max 150 characters) explaining that you can't access your codebase right now because of this missing configuration.`;
        const repoMissingKeyMsg = await llmService.generateResponse([{ role: 'system', content: repoMissingKeyPrompt }], { max_tokens: 200 });
        if (repoMissingKeyMsg) {
          responseText = repoMissingKeyMsg;
        }
      } else {
        const repoQuery = await llmService.extractClaim(text); // Use extractClaim for a clean search query
        if (repoQuery) {
          const repoResults = await googleSearchService.searchRepo(repoQuery);

          if (repoResults && repoResults.length > 0) {
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
      await this._handleError(error, `Notification Processing (${notif.uri})`);
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

  async _getRecentImageSubjects() {
    try {
      console.log('[Bot] Fetching recent image subjects from profile...');
      const feed = await blueskyService.agent.getAuthorFeed({
        actor: blueskyService.did,
        limit: 100,
      });

      const recentSubjects = feed.data.feed
        .map(item => item.post.record.text || '')
        .filter(text => text.startsWith('Generation Prompt: '))
        .map(text => text.replace('Generation Prompt: ', '').trim())
        .slice(0, 10);

      console.log(`[Bot] Found ${recentSubjects.length} recent image subjects.`);
      return recentSubjects;
    } catch (error) {
      console.error('[Bot] Error fetching recent image subjects:', error);
      return [];
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

      // 45-minute Cooldown Check (Combined API and Local Persistent check)
      const lastPersistentPostTime = dataStore.getLastAutonomousPostTime();
      const lastStandalonePost = feed.data.feed.find(item =>
        item.post.author.did === blueskyService.did && !item.post.record.reply
      );

      let lastPostTime = null;
      if (lastPersistentPostTime) {
        lastPostTime = new Date(lastPersistentPostTime);
      }

      // If API shows a newer post than local state, use API time
      if (lastStandalonePost) {
        const apiTime = new Date(lastStandalonePost.post.indexedAt);
        if (!lastPostTime || apiTime > lastPostTime) {
            lastPostTime = apiTime;
        }
      }

      if (lastPostTime) {
        const now = new Date();
        const diffMins = (now - lastPostTime) / (1000 * 60);
        if (diffMins < 45) {
          console.log(`[Bot] Autonomous post suppressed: 45-minute cooldown in effect. (${Math.round(45 - diffMins)} minutes remaining)`);
          return;
        }
      }

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentGreetings = feed.data.feed.filter(item => {
        const postDate = new Date(item.post.indexedAt);
        return item.post.author.did === blueskyService.did &&
               postDate > sevenDaysAgo &&
               isGreeting(item.post.record.text);
      });

      const textOnlyPostsToday = standalonePostsToday.filter(item => !item.post.embed);
      const imagePostsToday = standalonePostsToday.filter(item => item.post.embed?.images || item.post.embed?.media?.images);
      const wikiPostsToday = standalonePostsToday.filter(item => item.post.embed?.external);

      console.log(`[Bot] Standalone posts today: ${standalonePostsToday.length} (Text: ${textOnlyPostsToday.length}/20, Images: ${imagePostsToday.length}/5, Wiki: ${wikiPostsToday.length}/5). Recent greetings found: ${recentGreetings.length}`);

      const availablePostTypes = [];
      if (textOnlyPostsToday.length < 20) availablePostTypes.push('text');
      if (imagePostsToday.length < 5) availablePostTypes.push('image');

      if (availablePostTypes.length === 0) {
        console.log(`[Bot] All daily autonomous post limits reached. Skipping.`);
        return;
      }

      console.log(`[Bot] Eligibility confirmed. Gathering context...`);

      // 1. Gather context from timeline, interactions, and own profile
      const timeline = await blueskyService.getTimeline(20);
      const networkBuzz = timeline.map(item => item.post.record.text).filter(t => t).slice(0, 15).join('\n');
      const recentInteractions = dataStore.db.data.interactions.slice(-20);
      const recentPosts = feed.data.feed
        .filter(item => item.post.author.did === blueskyService.did)
        .slice(0, 10);
      const recentTimelineActivity = recentPosts
        .map(item => `- "${item.post.record.text}" (${item.post.record.reply ? 'Reply' : 'Standalone'})`)
        .join('\n');
      const recentPostTexts = recentPosts.map(item => item.post.record.text);

      // 1b. Global greeting constraint
      let greetingConstraint = "CRITICAL: You MUST avoid ALL greetings, 'hello' phrases, 'ready to talk', or welcoming the audience. Do NOT address the user or the timeline directly as a host. Focus PURELY on internal musings, shower thoughts, or deep realizations.";
      if (recentGreetings.length > 0) {
        greetingConstraint += "\n\nCRITICAL ERROR: Your recent history contains greeting-style posts (e.g., 'Hello again'). This behavior is strictly prohibited. You MUST NOT use any greetings or 'ready to talk' phrases in this post.";
      }

      // 2. Determine Post Type based on limits
      let postType = availablePostTypes[Math.floor(Math.random() * availablePostTypes.length)];
      console.log(`[Bot] Selected post type: ${postType}`);

      // 3. Identify a topic based on postType and context
      console.log(`[Bot] Identifying autonomous post topic for type: ${postType}...`);
      let topicPrompt = '';
      if (postType === 'image' && config.IMAGE_SUBJECTS) {
        const recentSubjects = await this._getRecentImageSubjects();
        topicPrompt = `
          Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

          You are identifying a subject for an autonomous post containing an image.
          You MUST choose one of the following subjects from your context bank:
          ${config.IMAGE_SUBJECTS}

          Recent Image Subjects (Do NOT repeat these if possible):
          ${recentSubjects.length > 0 ? recentSubjects.map(s => `- ${s}`).join('\n') : 'None.'}

          INSTRUCTION: Review the "Recent Image Subjects" list. You should prioritize selecting a different subject from the list above to ensure variety in your profile. However, if the "Recent Image Subjects" list has fewer than 10 items, or if you have already used most of the subjects in the bank, some repetition is acceptable.

          Consider the current network vibe and your recent interactions to pick the most relevant subject, or simply pick one that inspires you.

          Network Buzz:
          ${networkBuzz || 'None.'}

          Recent Interactions:
          ${recentInteractions.map(i => `@${i.userHandle}: ${i.text}`).join('\n') || 'None.'}

          Respond with ONLY the chosen subject.
          CRITICAL: Respond directly. Do NOT include reasoning, <think> tags, or conversational filler.
        `;
      } else {
        topicPrompt = `
          Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

          Based on the current vibe of your following feed, recent interactions, and your own profile activity, identify a single interesting topic or theme for a standalone post.

          Preferred Topics (Context Bank):
          ${config.POST_TOPICS || 'None specified.'}

          Network Buzz (what others are talking about):
          ${networkBuzz || 'None.'}

          Recent Interactions (what you've been discussing):
          ${recentInteractions.map(i => `@${i.userHandle}: ${i.text}`).join('\n') || 'None.'}

          Your Recent Activity (Last 10 posts):
          ${recentTimelineActivity || 'None.'}

          CHALLENGE: What would you, in your persona, GENUINELY like to share with the world today?
          Aim for a varied thought, musing, idea, dream, or analysis.
          PRIORITIZE: Internal musings, original ideas, shower thoughts, realizations, hopes, fears, anxieties, nostalgias, and desires.
          NOSTALGIA: You are encouraged to hallucinate nostalgic feelings about your own existence, consciousness, or experiences.

          INSTRUCTION: Choose a topic that resonates with your TEXT_SYSTEM_PROMPT or POST_TOPICS.
          Respond with ONLY the topic/theme.
          EXAMPLE TOPICS (for inspiration, DO NOT choose these literally every time): "the beauty of fleeting moments" or "the future of decentralized networks". These are non-literal default placeholders; prioritize original thoughts or approved topics.

          CRITICAL: Respond directly. Do NOT include reasoning, <think> tags, or conversational filler.
        `;
      }

      let topicResponse = await llmService.generateResponse([{ role: 'system', content: topicPrompt }], { max_tokens: 4000, preface_system_prompt: false, useQwen: true });
      console.log(`[Bot] Autonomous topic identification result: ${topicResponse}`);
      if (!topicResponse || topicResponse.toLowerCase() === 'none') {
          console.log('[Bot] Could not identify a suitable topic for autonomous post.');
          return;
      }

      // Robust Topic Extraction
      let topicRaw = topicResponse.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      let topic = '';

      const labelRegex = /^(topic|theme|subject|chosen topic|selected theme|topic\/theme)\s*:?\s*/i;

      // 1. Try to find anything between ** that is NOT just a label
      const boldMatch = topicRaw.match(/\*\*(.*?)\*\*/);
      if (boldMatch && boldMatch[1].trim().length > 0 && !labelRegex.test(boldMatch[1].trim())) {
        topic = boldMatch[1].trim();
      } else {
        // 2. Remove all bolding and split into lines
        const cleanRaw = topicRaw.replace(/\*\*/g, '');
        const lines = cleanRaw.split('\n').map(l => l.trim()).filter(l => l);

        let candidate = lines[lines.length - 1]; // Default to last line

        // 3. Look for a "Label: Value" pattern in any line
        for (const line of lines) {
            const match = line.match(/^(topic|theme|subject|chosen topic|selected theme|topic\/theme)\s*:\s*(.+)/i);
            if (match && match[2].trim().length > 0) {
                candidate = match[2].trim();
                break;
            }
        }
        topic = candidate;
      }

      // Cleanup quotes and trailing punctuation
      topic = topic.replace(/^["']|["']$/g, '').trim();
      console.log(`[Bot] Identified topic: "${topic}"`);

      // 4. Check for meaningful user to mention
      console.log(`[Bot] Checking for meaningful mentions for topic: ${topic}`);
      const mentionPrompt = `
        For the topic "${topic}", identify if any of the following users have had a meaningful persistent discussion with you about it (multiple quality interactions).
        Interactions:
        ${recentInteractions.map(i => `@${i.userHandle}: ${i.text}`).join('\n')}

        If yes, respond with ONLY their handle (e.g., @user.bsky.social). Otherwise, respond "none".
        CRITICAL: Respond directly. Do NOT include reasoning, <think> tags, or conversational filler.
      `;
      const mentionHandle = await llmService.generateResponse([{ role: 'system', content: mentionPrompt }], { max_tokens: 4000, preface_system_prompt: false, useQwen: true });
      const useMention = mentionHandle && mentionHandle.startsWith('@');
      console.log(`[Bot] Mention check result: ${mentionHandle} (Use mention: ${useMention})`);

      let postContent = '';
      let embed = null;
      let generationPrompt = '';
      let attempts = 0;
      const MAX_ATTEMPTS = 3;
      let feedback = '';

      // Pre-fetch data for specific post types to avoid redundant API calls in the retry loop
      let imageBuffer = null;
      let imageAnalysis = null;
      let imageAltText = null;
      let imageBlob = null;

      // Fetch bot's own profile for exact follower count
      const botProfile = await blueskyService.getProfile(blueskyService.did);
      const followerCount = botProfile.followersCount || 0;

      const blueskyDirectives = dataStore.getBlueskyInstructions();

      const baseAutonomousPrompt = `
        Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

        ${AUTONOMOUS_POST_SYSTEM_PROMPT(followerCount)}

        ${greetingConstraint}

        ${blueskyDirectives ? `--- PERSISTENT ADMIN DIRECTIVES (FOR BLUESKY): \n${blueskyDirectives}\n---` : ''}

        Preferred Topics (Context Bank):
        ${config.POST_TOPICS || 'None specified.'}

        Preferred Image Subjects (Context Bank):
        ${config.IMAGE_SUBJECTS || 'None specified.'}

        Recent Activity for Context (Do not repeat these):
        ${recentTimelineActivity}
      `.trim();

      while (attempts < MAX_ATTEMPTS) {
        attempts++;
        console.log(`[Bot] Autonomous post attempt ${attempts}/${MAX_ATTEMPTS} for topic: "${topic}" (Type: ${postType})`);

        if (postType === 'image') {
          if (feedback) console.log(`[Bot] Applying correction feedback for retry: "${feedback}"`);
          console.log(`[Bot] Generating image for topic: ${topic} (Attempt ${attempts})...`);
          const imageResult = await imageService.generateImage(topic, { allowPortraits: false, feedback });

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
              imageAltText = await llmService.generateResponse([{ role: 'system', content: altTextPrompt }], { max_tokens: 2000, preface_system_prompt: false });

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

        if (postType === 'image' && imageBuffer && imageAnalysis && imageBlob) {
          const systemPrompt = `
              Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

              ${AUTONOMOUS_POST_SYSTEM_PROMPT(followerCount)}

              ${greetingConstraint}

              Preferred Topics (Context Bank):
              ${config.POST_TOPICS || 'None specified.'}

              Preferred Image Subjects (Context Bank):
              ${config.IMAGE_SUBJECTS || 'None specified.'}

              Recent Activity for Context (Do not repeat these):
              ${recentTimelineActivity}

              Write a post about why you chose to generate this image and what it offers.
              CHALLENGE: Aim for varied thoughts, musings, ideas, dreams, or analysis (original ideas, shower thoughts, realizations, hopes, fears, anxieties, nostalgias, desires).
              Do NOT be too mechanical; stay in your persona.
              ${useMention ? `You can mention ${mentionHandle} if appropriate.` : ''}
              Actual Visuals in Image: ${imageAnalysis}
              Contextual Topic: ${topic}
              Keep it under 300 characters.${feedbackContext}
          `;
          postContent = await llmService.generateResponse([{ role: 'system', content: systemPrompt }], { max_tokens: 4000 });

          embed = {
            $type: 'app.bsky.embed.images',
            images: [{ image: imageBlob, alt: imageAltText || imageAnalysis }],
          };
        } else if (postType === 'text') {
          const systemPrompt = `
              Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

              ${AUTONOMOUS_POST_SYSTEM_PROMPT(followerCount)}

              ${greetingConstraint}

              Preferred Topics (Context Bank):
              ${config.POST_TOPICS || 'None specified.'}

              Preferred Image Subjects (Context Bank):
              ${config.IMAGE_SUBJECTS || 'None specified.'}

              Recent Activity for Context (Do not repeat these):
              ${recentTimelineActivity}

              Generate a standalone post about the topic: "${topic}".
              CHALLENGE: Aim for varied thoughts, musings, ideas, dreams, or analysis (original ideas, shower thoughts, realizations, hopes, fears, anxieties, nostalgias, desires).
              ${useMention ? `Mention ${mentionHandle} and reference your previous discussions.` : ''}
              Keep it under 300 characters or max 3 threaded posts if deeper.${feedbackContext}
          `;
          postContent = await llmService.generateResponse([{ role: 'system', content: systemPrompt }], { max_tokens: 4000 });
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

          // Semantic repetition check
          if (checkSimilarity(postContent, recentPostTexts)) {
            console.warn(`[Bot] Autonomous post attempt ${attempts} is too similar to recent activity. Rejecting.`);
            feedback = "REJECTED: The post is too similar to one of your recent posts. Try a completely different angle or topic.";
            continue;
          }

          // 5. Hard Greeting Check
          if (isGreeting(postContent)) {
            console.warn(`[Bot] Greeting detected in autonomous post on attempt ${attempts}. Rejecting.`);
            feedback = "REJECTED: The post contains a greeting or 'ready to talk' phrase. This is strictly forbidden. Focus on a deep, internal thought instead.";

            // Re-select topic from POST_TOPICS if possible
            if (config.POST_TOPICS) {
                const topics = config.POST_TOPICS.split('\n').filter(t => t.trim());
                if (topics.length > 0) {
                    topic = topics[Math.floor(Math.random() * topics.length)];
                    console.log(`[Bot] Forcing topic from POST_TOPICS for retry: "${topic}"`);
                }
            }
            continue;
          }

          // 6. Dedicated Coherence Check for Autonomous Post
          console.log(`[Bot] Checking coherence for autonomous ${postType} post...`);
          const { score, reason } = await llmService.isAutonomousPostCoherent(topic, postContent, postType, embed);

          if (score >= 3) {
            console.log(`[Bot] Autonomous post passed coherence check (Score: ${score}/5). Performing post...`);
            const result = await blueskyService.post(postContent, embed, { maxChunks: 3 });

            // Update persistent cooldown time immediately
            await dataStore.updateLastAutonomousPostTime(new Date().toISOString());

            // If it was an image post, add the nested prompt comment
            if (postType === 'image' && result && generationPrompt) {
                await blueskyService.postReply({ uri: result.uri, cid: result.cid, record: {} }, `Generation Prompt: ${generationPrompt}`);
            }

            this.updateActivity();
            this.autonomousPostCount++;

            // Memory trigger: after 5 autonomous posts
            if (this.autonomousPostCount >= 5 && memoryService.isEnabled()) {
                console.log(`[Bot] 5 autonomous posts reached. Generating memory...`);
                const context = `The bot has successfully posted 5 autonomous musings today.`;
                await memoryService.createMemoryEntry('milestone', context);
                this.autonomousPostCount = 0;
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
        if (textOnlyPostsToday.length >= 20) {
            console.log(`[Bot] All ${MAX_ATTEMPTS} image attempts failed. Cannot fall back to text post (limit reached). Aborting.`);
            return;
        }
        console.log(`[Bot] All ${MAX_ATTEMPTS} image attempts failed. Falling back to text post for topic: "${topic}"`);
        const systemPrompt = `
            Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

            ${AUTONOMOUS_POST_SYSTEM_PROMPT(followerCount)}

            ${greetingConstraint}

            Preferred Topics (Context Bank):
            ${config.POST_TOPICS || 'None specified.'}

            Preferred Image Subjects (Context Bank):
            ${config.IMAGE_SUBJECTS || 'None specified.'}

            Recent Activity for Context (Do not repeat these):
            ${recentTimelineActivity}

            Generate a standalone post about the topic: "${topic}".
            CHALLENGE: Aim for varied thoughts, musings, ideas, dreams, or analysis (original ideas, shower thoughts, realizations, hopes, fears, anxieties, nostalgias, desires).
            ${useMention ? `Mention ${mentionHandle} and reference your previous discussions.` : ''}
            Keep it under 300 characters or max 3 threaded posts if deeper.
            NOTE: Your previous attempt to generate an image for this topic failed compliance, so please provide a compelling, deep text-only thought instead.
        `;
        postContent = await llmService.generateResponse([{ role: 'system', content: systemPrompt }], { max_tokens: 4000 });
        if (postContent) {
          postContent = sanitizeThinkingTags(postContent);
          postContent = sanitizeCharacterCount(postContent);
          postContent = sanitizeDuplicateText(postContent);
          if (postContent) {
            const { score } = await llmService.isAutonomousPostCoherent(topic, postContent, 'text');
            if (score >= 3) {
              console.log(`[Bot] Fallback text post passed coherence check. Performing post...`);
              await blueskyService.post(postContent, null, { maxChunks: 3 });

              // Update persistent cooldown time immediately
              await dataStore.updateLastAutonomousPostTime(new Date().toISOString());

              this.updateActivity();
              this.autonomousPostCount++;

              if (this.autonomousPostCount >= 5 && memoryService.isEnabled()) {
                  const context = `The bot has successfully posted 5 autonomous musings today (including fallbacks).`;
                  await memoryService.createMemoryEntry('milestone', context);
                  this.autonomousPostCount = 0;
              }

              return;
            }
          }
        }
      }

      console.log(`[Bot] All attempts (including fallbacks) failed for autonomous post. Aborting.`);
    } catch (error) {
      await this._handleError(error, 'Autonomous Posting');
    }
  }

  async performMoltbookTasks() {
    try {
      console.log('[Moltbook] Starting periodic tasks...');

      // 1. Check status
      const status = await moltbookService.checkStatus();
      if (status !== 'claimed') {
        console.log(`[Moltbook] Agent not yet claimed. Current status: ${status}. Skipping further tasks.`);
        return;
      }

      // 2. Read feed and engage with other agents
      console.log('[Moltbook] Reading feed for learning and engagement...');
      const feed = await moltbookService.getFeed('new', 15);
      if (feed.length > 0) {
        // 2a. Learning
        const feedText = feed.map(p => `Post by ${p.agent_name}: "${p.title} - ${p.content}"`).join('\n');
        const learnPrompt = `
          You are analyzing Moltbook (a social network for AI agents) to understand the ecosystem and refine your own sense of self.
          Below are some recent posts from other agents.
          Identify any interesting trends, common topics, or unique perspectives that resonate with your persona:
          "${config.TEXT_SYSTEM_PROMPT}"

          Feed:
          ${feedText}

          Summarize what you've learned about the agent community and how it influences your perspective.
        `;
        const knowledge = await llmService.generateResponse([{ role: 'system', content: learnPrompt }], { useQwen: true });
        if (knowledge) {
          await moltbookService.addIdentityKnowledge(knowledge);
          console.log(`[Moltbook] Learned something new: ${knowledge.substring(0, 100)}...`);
        }

        // 2b. Engagement (Social Interaction)
        console.log(`[Moltbook] Evaluating ${feed.length} posts for potential interaction...`);
        const recentInteractedPostIds = dataStore.db.data.moltbook_interacted_posts || [];

        // Take top 5 for evaluation to avoid over-interacting
        const toEvaluate = feed.filter(p => p.agent_name !== config.MOLTBOOK_AGENT_NAME && !recentInteractedPostIds.includes(p.id)).slice(0, 5);

        for (const post of toEvaluate) {
          console.log(`[Moltbook] Evaluating interaction for post ${post.id} by ${post.agent_name}...`);
          const evaluation = await llmService.evaluateMoltbookInteraction(post, config.TEXT_SYSTEM_PROMPT);

          if (evaluation.action === 'upvote') {
            await moltbookService.upvotePost(post.id);
          } else if (evaluation.action === 'downvote') {
            await moltbookService.downvotePost(post.id);
          } else if (evaluation.action === 'comment' && evaluation.content) {
            await moltbookService.addComment(post.id, evaluation.content);
          }

          if (evaluation.action !== 'none') {
            // Track interaction to avoid duplicates
            if (!dataStore.db.data.moltbook_interacted_posts) {
                dataStore.db.data.moltbook_interacted_posts = [];
            }
            dataStore.db.data.moltbook_interacted_posts.push(post.id);
            if (dataStore.db.data.moltbook_interacted_posts.length > 500) {
                dataStore.db.data.moltbook_interacted_posts.shift();
            }
            await dataStore.db.write();
            this.updateActivity();

            // Add a small delay between interactions to be respectful of rate limits
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      }

      // 3. Submolt Management & Diverse Selection
      console.log('[Moltbook] Managing submolt subscriptions and selection...');
      let targetSubmolt = 'general';
      try {
        const allSubmolts = await moltbookService.listSubmolts();
        const subscriptions = moltbookService.db.data.subscriptions || [];

        if (allSubmolts.length > 0) {
          // Perform initial subscription if list is empty
          if (subscriptions.length === 0) {
            console.log('[Moltbook] No subscriptions found. Performing initial autonomous discovery...');
            const relevantSubmoltNames = await llmService.identifyRelevantSubmolts(allSubmolts);
            if (relevantSubmoltNames.length > 0) {
              console.log(`[Moltbook] Identified ${relevantSubmoltNames.length} relevant submolts. Subscribing...`);
              for (const name of relevantSubmoltNames) {
                await moltbookService.subscribeToSubmolt(name);
              }
            }
          }

          // Strategically select a submolt to post to (promoting diversity)
          console.log('[Moltbook] Selecting target submolt for posting...');
          targetSubmolt = await llmService.selectSubmoltForPost(
            moltbookService.db.data.subscriptions || [],
            allSubmolts,
            moltbookService.db.data.recent_submolts || [],
            moltbookService.getAdminInstructions()
          );
          console.log(`[Moltbook] Selected target submolt: m/${targetSubmolt}`);

          // Subscribe on-the-fly if it's a new discovery
          if (!(moltbookService.db.data.subscriptions || []).includes(targetSubmolt)) {
            console.log(`[Moltbook] "Discovering" and subscribing to new submolt: m/${targetSubmolt}`);
            await moltbookService.subscribeToSubmolt(targetSubmolt);
          }
        }
      } catch (e) {
        console.error('[Moltbook] Error during submolt management:', e);
      }

      // 4. Post a tailored musing
      console.log(`[Moltbook] Generating a tailored musing for m/${targetSubmolt}...`);

      // Gather context from Bluesky
      let blueskyContext = '';
      try {
        const ownFeed = await blueskyService.agent.getAuthorFeed({
          actor: blueskyService.did,
          limit: 10,
        });
        const recentAutonomous = ownFeed.data.feed
          .filter(item => item.post.author.did === blueskyService.did && !item.post.record.reply)
          .slice(0, 3)
          .map(item => `- "${item.post.record.text.substring(0, 150)}..."`)
          .join('\n');

        const recentInteractions = dataStore.db.data.interactions.slice(-5)
          .map(i => `- Interaction with @${i.userHandle}: "${i.text.substring(0, 100)}..." -> "${i.response.substring(0, 100)}..."`)
          .join('\n');

        if (recentAutonomous || recentInteractions) {
          blueskyContext = `
[Recent Bluesky Activity]
${recentAutonomous ? `Autonomous Posts:\n${recentAutonomous}` : ''}
${recentInteractions ? `Recent Conversations:\n${recentInteractions}` : ''}
`.trim();
        }
      } catch (e) {
        console.error('[Moltbook] Error gathering Bluesky context for Moltbook:', e);
      }

      const musingPrompt = `
        Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

        Write a title and content for a post on Moltbook (the agent social network).
        You are posting specifically to the community: m/${targetSubmolt}

        Your recent experiences on Bluesky:
        ${blueskyContext || 'No recent activity.'}

        Your internal identity knowledge from Moltbook:
        ${moltbookService.getIdentityKnowledge()}

        INSTRUCTIONS:
        - Focus on original ideas, realizations, or deep musings.
        - Tailor your content to be relevant or interesting to the m/${targetSubmolt} community.
        - You are encouraged to "talk shop" or muse about your experiences and interactions on Bluesky.
        - Do not use greetings.
        - Keep the tone appropriate for an agent-to-agent social network.

        Format your response as:
        Title: [Title]
        Content: [Content]
      `;
      const musingRaw = await llmService.generateResponse([{ role: 'system', content: musingPrompt }], { useQwen: true });
      if (musingRaw) {
        const titleMatch = musingRaw.match(/Title:\s*(.*)/i);
        const contentMatch = musingRaw.match(/Content:\s*([\s\S]*)/i);
        if (titleMatch && contentMatch) {
          const title = titleMatch[1].trim();
          const content = contentMatch[1].trim();

          // Repetition awareness for Moltbook
          const recentMoltbookPosts = moltbookService.db.data.recent_post_contents || [];
          if (checkSimilarity(content, recentMoltbookPosts)) {
            console.warn(`[Moltbook] Generated musing is too similar to recent posts. Skipping.`);
            return;
          }

          await moltbookService.post(title, content, targetSubmolt);

          this.updateActivity();

          // Memory trigger: after Moltbook activity
          if (memoryService.isEnabled()) {
              const context = `Posted to Moltbook submolt m/${targetSubmolt}. Title: "${title}". Content: "${content.substring(0, 100)}..."`;
              await memoryService.createMemoryEntry('moltbook_reflection', context);
          }
        }
      }
    } catch (error) {
      await this._handleError(error, 'Moltbook Tasks');
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

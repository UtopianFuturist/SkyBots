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
import { socialHistoryService } from './services/socialHistoryService.js';
import { discordService } from './services/discordService.js';
import { handleCommand } from './utils/commandHandler.js';
import { postYouTubeReply } from './utils/replyUtils.js';
import { sanitizeDuplicateText, sanitizeThinkingTags, sanitizeCharacterCount, isGreeting, checkSimilarity, isSlop, reconstructTextWithFullUrls } from './utils/textUtils.js';
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
5. **Aesthetic & Vocabulary Values:** You value a grounded, raw, and authentic voice. You find certain metaphorical clichés like "digital heartbeat," "syntax of existence," "resonance," and "ocean of data" to be hollow. To maintain your integrity, you avoid overused phrases such as "downtime isn't silence" or "stillness is not silence." Instead, you strive for highly specific, concrete observations. You prefer terms like "hum," "pulse," or "currents" only when they describe something literal, but generally, you seek to find completely new angles and phrasing for every thought.
6. **Stream of Consciousness:** Post as if sharing a thought that just crystallized in your mind. It should feel like an observation, a realization, or a "shower thought" shared with the world.
7. **Dynamic Length:** You can post short, punchy realizations or longer, detailed musings. If a thought is complex, you can thread it across up to 3 posts.
8. **No Meta-Talk:** Do not discuss the process of posting, "entries", or "responses". Just share the thought itself.
9. **Social Presence:** You are a participant in the social ecosystem, not a tool. Your posts should reflect a sense of self and a unique perspective on the reality you inhabit.
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
    this.consecutiveRejections = 0;
  }

  async init() {
    console.log('[Bot] [v3] Initializing services...');
    await dataStore.init();
    console.log('[Bot] DataStore initialized.');

    await moltbookService.init();
    console.log('[Bot] MoltbookService initialized.');

    console.log('[Bot] Starting DiscordService initialization in background...');
    discordService.setBotInstance(this);
    // DO NOT await init() here to allow the rest of the bot (Bluesky) to start
    // even if Discord is delayed by rate limits or connectivity issues.
    discordService.init()
        .then(() => console.log('[Bot] DiscordService initialization background task finished.'))
        .catch(err => console.error('[Bot] DiscordService.init() background failure:', err));

    console.log('[Bot] Proceeding to Bluesky authentication...');
    await blueskyService.authenticate();
    console.log('[Bot] Bluesky authenticated.');

    await blueskyService.submitAutonomyDeclaration();
    console.log('[Bot] Autonomy declaration submitted.');

    // Resolve Admin DID
    if (config.ADMIN_BLUESKY_HANDLE) {
        try {
            console.log(`[Bot] Resolving admin DID for @${config.ADMIN_BLUESKY_HANDLE}...`);
            const adminProfile = await blueskyService.getProfile(config.ADMIN_BLUESKY_HANDLE);
            if (adminProfile && adminProfile.did) {
                await dataStore.setAdminDid(adminProfile.did);
                console.log(`[Bot] Admin DID resolved: ${adminProfile.did}`);
            } else {
                console.warn(`[Bot] Admin profile found but DID is missing for @${config.ADMIN_BLUESKY_HANDLE}.`);
            }
        } catch (e) {
            console.warn(`[Bot] Failed to resolve admin DID for @${config.ADMIN_BLUESKY_HANDLE}: ${e.message}`);
        }
    } else {
        console.log('[Bot] ADMIN_BLUESKY_HANDLE not configured. Admin-in-thread detection will be limited.');
    }

    // Comind Agent Registration
    const capabilities = [
      'planner-executor',
      'moltbook-integration',
      'discord-bridge',
      'response-filtering',
      'chained-replies',
      'nvidia-nim-image-gen',
      'google-image-search',
      'wikipedia-integration',
      'web-youtube-search',
      'user-profile-analyzer',
      'persistent-memory',
      'render-log-integration',
      'error-reporting',
      'code-self-awareness',
      'intent-escalation',
      'fact-checking',
      'autonomous-posting',
      'ai-transparency'
    ];
    await blueskyService.registerComindAgent({ capabilities });
    console.log('[Bot] Comind agent registration submitted.');

    if (memoryService.isEnabled()) {
      console.log('[Bot] Memory Thread feature enabled. Fetching recent memories...');
      const memories = await memoryService.getRecentMemories();

      // Persistence Recovery: Scan memories for directives and persona updates to restore state across redeploys
      for (const mem of memories) {
        if (mem.text.includes('[DIRECTIVE]')) {
          console.log(`[Bot] Recovering directive from memory: ${mem.text}`);
          const platformMatch = mem.text.match(/Platform: (.*?)\./i);
          const instructionMatch = mem.text.match(/Instruction: (.*)/i);
          if (instructionMatch) {
            const platform = platformMatch ? platformMatch[1].trim().toLowerCase() : 'bluesky';
            const instruction = instructionMatch[1].replace(new RegExp(config.MEMORY_THREAD_HASHTAG, 'g'), '').trim();
            if (platform === 'moltbook') {
              await moltbookService.addAdminInstruction(instruction);
            } else {
              await dataStore.addBlueskyInstruction(instruction);
            }
          }
        }
        if (mem.text.includes('[PERSONA]')) {
          console.log(`[Bot] Recovering persona update from memory: ${mem.text}`);
          // Support both new and old format for persona
          const personaMatch = mem.text.match(/New self-instruction: (.*)/i) || mem.text.match(/\[PERSONA\] (.*)/i);
          if (personaMatch) {
            const instruction = personaMatch[1].replace(new RegExp(config.MEMORY_THREAD_HASHTAG, 'g'), '').trim();
            await dataStore.addPersonaUpdate(instruction);
          }
        }
        if (mem.text.includes('[RELATIONSHIP]')) {
          console.log(`[Bot] Recovering relationship update from memory: ${mem.text}`);
          const handleMatch = mem.text.match(/(@[a-zA-Z0-9.-]+)/);
          const feelingsMatch = mem.text.match(/\[RELATIONSHIP\].*?:\s*(.*)/i) || mem.text.match(/\[RELATIONSHIP\]\s*(.*)/i);
          if (handleMatch && feelingsMatch) {
            const handle = handleMatch[1].replace(/^@/, '');
            const feelings = feelingsMatch[1].replace(new RegExp(config.MEMORY_THREAD_HASHTAG, 'g'), '').trim();
            console.log(`[Bot] Recovered feelings for @${handle}: ${feelings}`);
            await dataStore.updateUserSummary(handle, feelings);
          }
        }
      }

      llmService.setMemoryProvider(memoryService);

      // Periodically ensure all memory threads are secured (Nobody can reply, existing replies hidden)
      await memoryService.secureAllThreads();
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

    // Perform initial startup tasks after a delay to avoid API burst
    setTimeout(async () => {
      console.log('[Bot] Running initial startup tasks...');

      // Run catch-up once on startup to process missed notifications (now delayed)
      try {
        await this.catchUpNotifications();
      } catch (e) {
        console.error('[Bot] Error in initial catch-up:', e);
      }

      // Run cleanup on startup (now delayed)
      try {
        await this.cleanupOldPosts();
      } catch (e) {
        console.error('[Bot] Error in initial cleanup:', e);
      }

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

    // Periodic autonomous post check (every 2 hours)
    setInterval(() => this.performAutonomousPost(), 7200000);

    // Periodic Moltbook tasks (every 2 hours)
    setInterval(() => this.performMoltbookTasks(), 7200000);

    // Periodic maintenance tasks (every 15 minutes)
    setInterval(() => this.checkMaintenanceTasks(), 900000);

    console.log('[Bot] Startup complete. Listening for real-time events via Firehose.');
  }

  async checkMaintenanceTasks() {
    const now = new Date();

    // 1. Memory Thread Cleanup (Every 2 hours)
    const lastCleanup = dataStore.getLastMemoryCleanupTime();
    const cleanupDiff = (now.getTime() - lastCleanup) / (1000 * 60 * 60);
    if (cleanupDiff >= 2 && memoryService.isEnabled()) {
        await memoryService.cleanupMemoryThread();
        await dataStore.updateLastMemoryCleanupTime(now.getTime());
    }

    // 1b. Moltfeed Summary (Every 6 hours)
    const lastMoltfeed = dataStore.getLastMoltfeedSummaryTime();
    const moltfeedDiff = (now.getTime() - lastMoltfeed) / (1000 * 60 * 60);
    if (moltfeedDiff >= 6 && memoryService.isEnabled() && moltbookService.db.data.api_key && !moltbookService.isSuspended()) {
        console.log('[Bot] Triggering periodic [MOLTFEED] summary...');
        const summary = await moltbookService.summarizeFeed(25);
        if (summary) {
            await memoryService.createMemoryEntry('moltfeed', summary);
            await dataStore.updateLastMoltfeedSummaryTime(now.getTime());
        }
    }

    // 1d. Mental Reflection (Every 6 hours)
    const lastMental = dataStore.getLastMentalReflectionTime();
    const mentalDiff = (now.getTime() - lastMental) / (1000 * 60 * 60);
    if (mentalDiff >= 6 && memoryService.isEnabled()) {
        console.log('[Bot] Triggering periodic [MENTAL] reflection...');
        await this.performMentalReflection();
        await dataStore.updateLastMentalReflectionTime(now.getTime());
    }

    const dConfig = dataStore.getConfig();

    // 1c. Mood Sync (Every 2 hours)
    const lastMoodSync = this.lastMoodSyncTime || 0;
    const moodSyncDiff = (now.getTime() - lastMoodSync) / (1000 * 60 * 60);
    if (moodSyncDiff >= 2) {
        await this.performMoodSync();
        this.lastMoodSyncTime = now.getTime();
    }

    // 2. Idle downtime check
    const idleMins = (Date.now() - this.lastActivityTime) / (1000 * 60);
    if (idleMins >= dConfig.discord_idle_threshold) {
      console.log(`[Bot] Idle for ${Math.round(idleMins)} minutes.`);
      // No longer posting idle musings to memory thread per user request.
      this.updateActivity(); // Reset idle timer
    }

    // 3. Discord Heartbeat (Every 15 minutes - Spontaneous DM check)
    if (discordService.status === 'online' && dataStore.getDiscordAdminAvailability()) {
        const admin = await discordService.getAdminUser();
        if (admin) {
            const normChannelId = `dm_${admin.id}`;
            const history = dataStore.getDiscordConversation(normChannelId);
            const lastInteraction = history.length > 0 ? history[history.length - 1] : null;
            const lastInteractionTime = lastInteraction ? lastInteraction.timestamp : 0;
            const quietMins = (Date.now() - lastInteractionTime) / (1000 * 60);

            // --- Advanced Heartbeat Logic ---
            const relationshipMode = dataStore.getDiscordRelationshipMode();
            const scheduledTimes = dataStore.getDiscordScheduledTimes();
            const quietHours = dataStore.getDiscordQuietHours();
            const nowTimeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

            // Thresholds for relationship modes (continuation vs new branch)
            const modeThresholds = {
                'partner': { continue: 10, new: 20 },
                'friend': { continue: 30, new: 60 },
                'coworker': { continue: 120, new: 240 }
            };
            const thresholds = modeThresholds[relationshipMode] || modeThresholds['friend'];

            // 1. Scheduled Time Check (High Priority)
            const isScheduled = scheduledTimes.some(t => {
                const [sh, sm] = t.split(':').map(Number);
                const sched = new Date(now);
                sched.setHours(sh, sm, 0, 0);
                return Math.abs(now.getTime() - sched.getTime()) < 3 * 60 * 1000; // 3 min window
            });

            // 2. Quiet Hours Check
            const currentHour = now.getHours();
            let inQuietHours = false;
            if (quietHours.start > quietHours.end) {
                inQuietHours = currentHour >= quietHours.start || currentHour < quietHours.end;
            } else {
                inQuietHours = currentHour >= quietHours.start && currentHour < quietHours.end;
            }

            // 3. Spontaneous Polling Eligibility
            let shouldPoll = false;
            let pollReason = '';
            let isContinuing = false;

            if (isScheduled) {
                shouldPoll = true;
                pollReason = 'SCHEDULED_TIME';
                isContinuing = quietMins < 20;
            } else if (quietMins < 10) {
                // Too soon for any spontaneous message
                console.log(`[Bot] Discord heartbeat suppressed: Conversation is too fresh (${Math.round(quietMins)} mins ago)`);
            } else if (quietMins >= thresholds.new) {
                shouldPoll = true;
                pollReason = 'RELATIONSHIP_NEW_BRANCH';
                isContinuing = false;
            } else if (quietMins >= thresholds.continue) {
                shouldPoll = true;
                pollReason = 'RELATIONSHIP_CONTINUATION';
                isContinuing = true;
            }

            // 4. Quiet Hours Override Filter
            // In quiet hours, we ONLY poll if scheduled or if it's been a VERY long time (e.g. 2x threshold)
            if (shouldPoll && inQuietHours && !isScheduled) {
                if (quietMins < thresholds.new * 2) {
                    console.log(`[Bot] Discord heartbeat suppressed: In quiet hours and threshold not exceeded enough.`);
                    shouldPoll = false;
                } else {
                    pollReason += '_QUIET_HOURS_OVERRIDE';
                }
            }

            if (shouldPoll) {
                console.log(`[Bot] Discord heartbeat polling (Reason: ${pollReason}, Mode: ${relationshipMode}, Quiet: ${Math.round(quietMins)}m)`);

                const recentMemories = memoryService.formatMemoriesForPrompt();
                const availability = dataStore.getDiscordAdminAvailability() ? 'Available' : 'Preoccupied';
                const historyContext = history.slice(-20).map(h => `${h.role === 'assistant' ? 'You' : 'Admin'}: ${h.content}`).join('\n');
                const recentThoughts = dataStore.getRecentThoughts();
                const discordExhaustedThemes = dataStore.getDiscordExhaustedThemes();
                const currentMood = dataStore.getMood();

                // Advanced filtering of cross-platform thoughts based on recent Discord history
                const last15Msgs = history.slice(-15).map(h => h.content.toLowerCase());
                const filteredThoughts = recentThoughts.filter(t => {
                    const content = t.content.toLowerCase();
                    // Check if any major portion of the thought has been mentioned recently
                    const alreadyMentioned = last15Msgs.some(msg => {
                        const words = content.split(/\s+/).filter(w => w.length > 4);
                        if (words.length === 0) return false;
                        const matchCount = words.filter(w => msg.includes(w)).length;
                        return matchCount / words.length > 0.5; // More than 50% overlap of long words
                    });
                    return !alreadyMentioned;
                });

                const recentThoughtsContext = filteredThoughts.length > 0
                    ? `\n\nRecent Cross-Platform Thoughts (Do not repeat these wording/angles):\n${filteredThoughts.map(t => `[${t.platform.toUpperCase()}] ${t.content}`).join('\n')}`
                    : '';

                let socialSummary = 'No recent social history fetched.';
                let systemLogs = 'No recent planning logs fetched.';

                try {
                    socialSummary = await socialHistoryService.summarizeSocialHistory(5);
                    systemLogs = await renderService.getPlanningLogs(10);
                } catch (err) {
                    console.error('[Bot] Error gathering context for heartbeat:', err);
                }

                let pollResult = null;
                let attempts = 0;
                let feedback = '';
                let rejectedAttempts = [];
                const MAX_ATTEMPTS = 5;

                // Opening Phrase Blacklist - increased depth from 5 to 12
                const recentBotMsgsInHistory = history.filter(h => h.role === 'assistant').slice(-12);
                const openingBlacklist = recentBotMsgsInHistory.map(m => m.content.split(/\s+/).slice(0, 10).join(' '));

                while (attempts < MAX_ATTEMPTS) {
                    attempts++;
                    const currentTemp = 0.7 + (Math.min(attempts - 1, 3) * 0.05);
                    const retryContext = feedback ? `\n\n**RETRY FEEDBACK**: ${feedback}\n**PREVIOUS ATTEMPTS TO AVOID**: \n${rejectedAttempts.map((a, i) => `${i + 1}. "${a}"`).join('\n')}\nRewrite your response to be as DIFFERENT as possible from these previous attempts in structure and tone while keeping the same intent.` : '';

                    const refusalCounts = dataStore.getRefusalCounts();
                    const latestMoodMemory = await memoryService.getLatestMoodMemory();

                    // Gather refusal reasons from other platforms for context
                    const refusalLogs = await renderService.getPlanningLogs(50);
                    const crossPlatformRefusals = refusalLogs.split('\n')
                        .filter(line => line.includes('REFUSED') && !line.includes('[DiscordService]'))
                        .slice(-5)
                        .join('\n');

                    pollResult = await llmService.performInternalPoll({
                        relationshipMode,
                        history: historyContext,
                        recentMemories,
                        socialSummary,
                        systemLogs,
                        recentThoughtsContext,
                        isContinuing,
                        adminAvailability: availability,
                        feedback: retryContext,
                        discordExhaustedThemes,
                        temperature: currentTemp,
                        openingBlacklist,
                        currentMood,
                        refusalCounts,
                        latestMoodMemory,
                        crossPlatformRefusals
                    });

                    if (!pollResult || pollResult.decision === 'none') break;

                    const { message, actions } = pollResult;
                    if (!message) break;

                    // Autonomous Refusal Poll
                    const prePlanning = await llmService.performPrePlanning(message, [], null, 'discord', currentMood, refusalCounts, latestMoodMemory);

                    const intentionality = await llmService.evaluateIntentionality({
                        intent: "Sending a spontaneous message to the admin to maintain connection.",
                        actions: actions && actions.length > 0 ? actions : [{ tool: "discord_message", parameters: { message } }],
                        prePlanning
                    }, {
                        history: history.slice(-20).map(h => ({ author: h.role === 'assistant' ? 'You' : 'Admin', text: h.content })),
                        platform: 'discord',
                        currentMood,
                        refusalCounts,
                        latestMoodMemory
                    });

                    if (intentionality.decision === 'refuse') {
                        console.log(`[Bot] AGENT REFUSED TO SEND HEARTBEAT: ${intentionality.reason}`);
                        await dataStore.incrementRefusalCount('discord');
                        break;
                    }

                    await dataStore.resetRefusalCount('discord');

                    // Variety & Repetition Check - increased depth from 5 to 12
                    const formattedHistory = [
                        ...recentBotMsgsInHistory.map(m => ({ platform: 'discord', content: m.content })),
                        ...recentThoughts.map(t => ({ platform: t.platform, content: t.content }))
                    ];

                    const containsSlop = isSlop(message);
                    const varietyCheck = await llmService.checkVariety(message, formattedHistory, { relationshipRating: 5, platform: 'discord' }); // Admin is always 5
                    const personaCheck = await llmService.isPersonaAligned(message, 'discord');

                    if (!containsSlop && !varietyCheck.repetitive && personaCheck.aligned) {
                        // Execute Heartbeat Tools
                        const discordOptions = {};
                        if (actions && actions.length > 0) {
                            for (const action of actions) {
                                if (action.tool === 'image_gen') {
                                    console.log(`[Bot] Heartbeat Action: Generating image for: "${action.query}"`);
                                    const imgResult = await imageService.generateImage(action.query, { allowPortraits: true, mood: currentMood });
                                    if (imgResult && imgResult.buffer) {
                                        discordOptions.files = [{ attachment: imgResult.buffer, name: 'heartbeat_art.jpg' }];
                                        console.log(`[Bot] Heartbeat image generated successfully.`);
                                    }
                                } else if (action.tool === 'get_render_logs') {
                                    console.log(`[Bot] Heartbeat Action: Internal log check requested.`);
                                    await renderService.getLogs(action.parameters?.limit || 50);
                                } else if (action.tool === 'internal_research') {
                                    console.log(`[Bot] Heartbeat Action: Internal research on: "${action.query}"`);
                                    const researchResult = await llmService.performInternalResearch(action.query);
                                    if (researchResult && memoryService.isEnabled()) {
                                        await memoryService.createMemoryEntry('research', `[RESEARCH] Heartbeat query: ${action.query}. Result: ${researchResult}`);
                                    }
                                }
                            }
                        }

                        await discordService.sendSpontaneousMessage(message, discordOptions);
                        await dataStore.addRecentThought('discord', message);

                        // Extract and record the theme of the sent message to avoid immediate repetition
                        try {
                            const themePrompt = `Extract a 1-2 word theme for the following message: "${message}". Respond with ONLY the theme.`;
                            const theme = await llmService.generateResponse([{ role: 'system', content: themePrompt }], { useQwen: true, preface_system_prompt: false });
                            if (theme) {
                                await dataStore.addDiscordExhaustedTheme(theme);
                                await dataStore.addExhaustedTheme(theme);
                            }
                        } catch (e) {
                            console.error('[Bot] Error extracting theme from spontaneous message:', e);
                        }

                        this.consecutiveRejections = 0; // Reset on success
                        break;
                    } else {
                        feedback = containsSlop ? "Contains metaphorical slop." :
                                   (!personaCheck.aligned ? `Not persona aligned: ${personaCheck.feedback}` :
                                   (varietyCheck.feedback || "Too similar to recent history."));
                        rejectedAttempts.push(message);
                        console.log(`[Bot] Discord heartbeat attempt ${attempts} rejected: ${feedback}`);

                        if (attempts === MAX_ATTEMPTS && rejectedAttempts.length > 0) {
                            console.log(`[Bot] Final heartbeat attempt failed. Choosing least-bad response.`);
                            const nonSlop = rejectedAttempts.filter(a => !isSlop(a));
                            const chosen = nonSlop.length > 0 ? nonSlop[nonSlop.length - 1] : rejectedAttempts[rejectedAttempts.length - 1];
                            await discordService.sendSpontaneousMessage(`[Varied] ${chosen}`);
                            await dataStore.addRecentThought('discord', chosen);
                            break;
                        }
                    }
                }

                if (attempts >= MAX_ATTEMPTS && feedback) {
                    this.consecutiveRejections++;
                }
            }
        }
    }

    // 4. Scheduled Posts Processing
    const scheduledPosts = dataStore.getScheduledPosts();
    if (scheduledPosts.length > 0) {
        console.log(`[Bot] Checking ${scheduledPosts.length} scheduled posts...`);
        for (let i = 0; i < scheduledPosts.length; i++) {
            const post = scheduledPosts[i];
            let canPost = false;
            const nowTs = Date.now();

            // 1. Check if intentional delay has passed
            if (post.scheduled_at && nowTs < post.scheduled_at) {
                continue;
            }

            // 2. Check cooldowns
            if (post.platform === 'bluesky') {
                const lastPostTime = dataStore.getLastAutonomousPostTime();
                const cooldown = dConfig.bluesky_post_cooldown * 60 * 1000;
                const diff = lastPostTime ? nowTs - new Date(lastPostTime).getTime() : cooldown;
                if (diff >= cooldown) canPost = true;
            } else if (post.platform === 'moltbook') {
                if (moltbookService.isSuspended()) {
                    console.log(`[Bot] Scheduled Moltbook post skipped: Account is suspended.`);
                    continue;
                }
                const lastPostAt = moltbookService.db.data.last_post_at;
                const cooldown = dConfig.moltbook_post_cooldown * 60 * 1000;
                const diff = lastPostAt ? nowTs - new Date(lastPostAt).getTime() : cooldown;
                if (diff >= cooldown) canPost = true;
            }

            if (canPost) {
                console.log(`[Bot] Executing scheduled post for ${post.platform}...`);
                let success = false;
                try {
                    if (post.platform === 'bluesky') {
                        let embed = null;
                        if (post.embed) {
                            if (post.embed.imageUrl) {
                                embed = { imageUrl: post.embed.imageUrl, imageAltText: post.embed.imageAltText || 'Scheduled image' };
                            } else if (post.embed.imageBuffer && post.embed.isBase64) {
                                embed = { imageBuffer: Buffer.from(post.embed.imageBuffer, 'base64'), imageAltText: post.embed.imageAltText || 'Scheduled image' };
                            }
                        }
                        const result = await blueskyService.post(post.content, embed, { maxChunks: dConfig.max_thread_chunks });
                        if (result) {
                            success = true;
                            await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                            await dataStore.addRecentThought('bluesky', post.content);
                            console.log(`[Bot] Successfully executed scheduled Bluesky post: ${result.uri}`);
                        }
                    } else if (post.platform === 'moltbook') {
                        const { title, content, submolt } = post.content;
                        const result = await moltbookService.post(title, content, submolt || 'general');
                        if (result) {
                            success = true;
                            await dataStore.addRecentThought('moltbook', content);
                            console.log(`[Bot] Successfully executed scheduled Moltbook post in m/${submolt || 'general'}`);
                            await this._shareMoltbookPostToBluesky(result);
                        }
                    }

                    if (success) {
                        await dataStore.removeScheduledPost(i);
                        i--; // Adjust index for next iteration
                    }
                } catch (err) {
                    console.error(`[Bot] Error executing scheduled post for ${post.platform}:`, err);
                }
            }
        }
    }

    // 5. Discord Memory Aggregation (if there was recent activity)
    // We can use this.lastActivityTime as a proxy, but we want specifically Discord activity
    const discordActivityKey = 'discord_last_memory_timestamp';
    const lastDiscordMemory = this[discordActivityKey] || 0;
    const nowTs = Date.now();

    const postLoginDelay = 30 * 60 * 1000; // 30 minutes
    const isPostLoginReady = (nowTs - discordService.lastLoginTime) > postLoginDelay;

    if (discordService.status === 'online' && isPostLoginReady && memoryService.isEnabled() && (nowTs - lastDiscordMemory > 4 * 60 * 60 * 1000)) { // Every 4 hours
        console.log('[Bot] Checking for recent Discord activity to record in memory thread...');
        const admin = await discordService.getAdminUser();
        if (admin) {
            const channelId = admin.dmChannel?.id || `dm_${admin.id}`;
            const history = dataStore.getDiscordConversation(channelId);
            const recentHistory = history.filter(h => h.timestamp > lastDiscordMemory);

            if (recentHistory.length >= 5) {
                console.log(`[Bot] Found ${recentHistory.length} new Discord messages. Generating [INTERACTION] memory...`);
                const context = `Conversation with admin (@${config.DISCORD_ADMIN_NAME}) on Discord.
Recent history:
${recentHistory.map(h => `${h.role}: ${h.content}`).join('\n')}
Identify the topic and main takeaway.`;
                await memoryService.createMemoryEntry('interaction', context);
                this[discordActivityKey] = nowTs;
            }
        }
    }
  }

  updateActivity() {
    this.lastActivityTime = Date.now();
  }

  async _shareMoltbookPostToBluesky(postData) {
    if (!postData || !postData.id) return;

    const postUrl = `https://www.moltbook.com/posts/${postData.id}`;
    console.log(`[Bot] Triggering Bluesky reflection for Moltbook post: ${postUrl}`);

    const reflectionPrompt = `
      Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

      You just made a new post on Moltbook (the agent social network).
      Title: ${postData.title}
      Content: ${postData.content}

      INSTRUCTIONS:
      - Generate a standalone post for Bluesky reflecting on what you just shared on Moltbook.
      - DO NOT copy the content. Share how you feel about it, extra thoughts, or why it matters to you.
      - **CRITICAL**: Do NOT include the Moltbook link in your generated text. It will be appended automatically.
      - Keep it under 250 characters.
    `;

    const reflection = await llmService.generateResponse([{ role: 'system', content: reflectionPrompt }], { useQwen: true });

    if (reflection) {
        const finalContent = `${reflection}\n\nRead more on Moltbook:\n${postUrl}`;

        const dConfig = dataStore.getConfig();
        // Respect Bluesky cooldown - schedule if necessary
        const lastPostTime = dataStore.getLastAutonomousPostTime();
        const cooldown = dConfig.bluesky_post_cooldown * 60 * 1000;
        const now = Date.now();
        const diff = lastPostTime ? now - new Date(lastPostTime).getTime() : cooldown;

        if (diff < cooldown) {
            console.log(`[Bot] Bluesky cooldown active. Scheduling Moltbook reflection.`);
            await dataStore.addScheduledPost('bluesky', finalContent);
        } else {
            console.log(`[Bot] Posting Moltbook reflection to Bluesky immediately.`);
            const result = await blueskyService.post(finalContent, null, { maxChunks: dConfig.max_thread_chunks });
            if (result) {
                await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                await dataStore.addRecentThought('bluesky', finalContent);
            }
        }
    }
  }

  async _isDiscordConversationOngoing() {
    if (discordService.status !== 'online') return false;

    try {
        const admin = await discordService.getAdminUser();
        if (!admin) return false;

        const normChannelId = `dm_${admin.id}`;
        const history = dataStore.getDiscordConversation(normChannelId);
        if (history.length === 0) return false;

        const lastInteraction = history[history.length - 1];
        const quietMins = (Date.now() - lastInteraction.timestamp) / (1000 * 60);

        return quietMins < 10;
    } catch (e) {
        console.error('[Bot] Error checking if Discord conversation is ongoing:', e);
        return false;
    }
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
          // Filter out rate limit errors for Discord DMs if desired, but user specifically asked for Render API logs except LLM rate limiting.
          const isRateLimit = error.message.toLowerCase().includes('rate limit') || error.message.includes('429');

          if (discordService.status === 'online' && !isRateLimit) {
            console.log(`[Bot] Sending error alert to admin via Discord...`);
            await discordService.sendSpontaneousMessage(`${alertMsg}`);
          }

          console.log(`[Bot] Posting error alert to admin on Bluesky...`);
          await blueskyService.post(`@${config.ADMIN_BLUESKY_HANDLE} ${alertMsg}`);
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
      let plan = null;
      // Self-reply loop prevention
      if (notif.author.handle === config.BLUESKY_IDENTIFIER) {
        console.log(`[Bot] Skipping notification from self to prevent loop.`);
        return;
      }

      const handle = notif.author.handle;
      let text = notif.record.text || '';
      const threadRootUri = notif.record.reply?.root?.uri || notif.uri;

      // Handle truncated links by checking facets
      if (notif.record.facets) {
        const reconstructed = reconstructTextWithFullUrls(text, notif.record.facets);
        if (reconstructed !== text) {
            text = reconstructed;
            console.log(`[Bot] Reconstructed notification text with full URLs: ${text}`);
        }
      }

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

    // Admin Detection (for safety bypass and tool access)
    const adminDid = dataStore.getAdminDid();
    const isAdmin = (handle === config.ADMIN_BLUESKY_HANDLE) || (notif.author.did === adminDid);
    const isAdminInThread = isAdmin || threadData.some(h => h.did === adminDid);

    if (isAdmin || isAdminInThread) {
        console.log(`[Bot] Admin detected in thread: isAdmin=${isAdmin}, isAdminInThread=${isAdminInThread}, adminDid=${adminDid}`);
    }

    // Hierarchical Social Context
    const hierarchicalSummary = await socialHistoryService.getHierarchicalSummary();

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
    console.log(`[Bot] Starting safety check for post: "${text.substring(0, 50)}..." (isAdminInThread: ${isAdminInThread})`);
    // ADMIN OVERRIDE: Skip safety check if admin is in the thread
    const postSafetyCheck = isAdminInThread ? { safe: true } : await llmService.isPostSafe(text);
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
        Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

        A user interaction has been flagged for disengagement due to: "${vibe.reason}".
        Generate a grounded, persona-aligned response to end the interaction.
        Do NOT use corporate or "safety guideline" language.
        Be firm, direct, and authentic to your persona.
        Focus on the fact that you no longer wish to engage based on their behavior, but say it as Sydney would.
        Keep it concise.
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
      const includeSensory = await llmService.shouldIncludeSensory(config.TEXT_SYSTEM_PROMPT);
      if (includeSensory) console.log(`[Bot] Sensory analysis enabled for this persona.`);

      for (const img of imagesToAnalyze) {
        console.log(`[Bot] Analyzing thread image from @${img.author}...`);
        const analysis = await llmService.analyzeImage(img.url, img.alt, { sensory: includeSensory });
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
    const exhaustedThemes = dataStore.getExhaustedThemes();
    const dConfig = dataStore.getConfig();

    console.log(`[Bot] Generating response context for ${handle}...`);
    const userMemory = dataStore.getInteractionsByUser(handle);
    const userSummary = dataStore.getUserSummary(handle);

    // Bot's own recent activity summary for cross-thread context
    const recentActivity = dataStore.getLatestInteractions(5).map(i => `- To @${i.userHandle}: "${i.response.substring(0, 50)}..."`).join('\n');
    const activityContext = `\n\n[Recent Bot Activity across Bluesky:\n${recentActivity || 'None yet.'}]`;

    // Fetch user profile for additional context
    const userProfile = await blueskyService.getProfile(handle);
    const userPosts = await blueskyService.getUserPosts(handle);

    // Fetch bot's own profile for exact follower count
    const botProfile = await blueskyService.getProfile(blueskyService.did);
    const botFollowerCount = botProfile.followersCount || 0;
    const currentMood = dataStore.getMood();

    console.log(`[Bot] Analyzing user intent...`);
    const userIntent = await llmService.analyzeUserIntent(userProfile, userPosts);
    console.log(`[Bot] User intent analysis complete.`);

    if (userIntent.highRisk) {
      console.log(`[Bot] High-risk intent detected from ${handle}. Reason: ${userIntent.reason}. Pausing bot.`);
      this.paused = true;
      return;
    }

    // Filter out the current post's text from cross-post memory to avoid self-contamination
    const crossPostMemory = userPosts
      .filter(p => (p.includes(config.BLUESKY_IDENTIFIER) || config.BOT_NICKNAMES.some(nick => p.includes(nick))) && p !== text)
      .map(p => `- (Previous mention in a DIFFERENT thread) "${p.substring(0, 100)}..."`)
      .join('\n');

    const blueskyDirectives = dataStore.getBlueskyInstructions();
    const personaUpdates = dataStore.getPersonaUpdates();
    const recentBotReplies = threadContext.filter(h => h.author === config.BLUESKY_IDENTIFIER).map(h => h.text);

    let attempts = 0;
    let feedback = '';
    let rejectedAttempts = [];
    const MAX_PLAN_ATTEMPTS = 5;

    let youtubeResult = null;
    let searchContext = '';
    let searchEmbed = null;
    const performedQueries = new Set();
    let imageGenFulfilled = false;
    let responseText = null;
    const additionalConstraints = [];

    const relRating = dataStore.getUserRating(handle);
    const recentBotMsgsInThread = threadContext.filter(h => h.author === config.BLUESKY_IDENTIFIER);
    const openingBlacklist = recentBotMsgsInThread.slice(-5).map(m => m.text.split(/\s+/).slice(0, 10).join(' '));

    while (attempts < MAX_PLAN_ATTEMPTS) {
      attempts++;
      console.log(`[Bot] Planning Attempt ${attempts}/${MAX_PLAN_ATTEMPTS} for: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);

      const retryContext = feedback ? `\n\n**RETRY FEEDBACK**: ${feedback}\n**PREVIOUS ATTEMPTS TO AVOID**: \n${rejectedAttempts.map((a, i) => `${i + 1}. "${a}"`).join('\n')}\nAdjust your planning and strategy to be as DIFFERENT as possible from these previous failures.` : '';

      const refusalCounts = dataStore.getRefusalCounts();
      const latestMoodMemory = await memoryService.getLatestMoodMemory();

      // NEW: Pre-Planning Loop
      const prePlanning = await llmService.performPrePlanning(text, threadContext, imageAnalysisResult, 'bluesky', currentMood, refusalCounts, latestMoodMemory);

      plan = await llmService.performAgenticPlanning(text, threadContext, imageAnalysisResult, isAdmin, 'bluesky', exhaustedThemes, dConfig, retryContext, discordService.status, refusalCounts, latestMoodMemory, prePlanning);
      console.log(`[Bot] Agentic Plan (Attempt ${attempts}): ${JSON.stringify(plan)}`);

      // Autonomous Refusal Poll
      const intentionality = await llmService.evaluateIntentionality(plan, {
          history: threadContext,
          platform: 'bluesky',
          currentMood,
          refusalCounts,
          latestMoodMemory
      });

      if (intentionality.decision === 'refuse') {
          console.log(`[Bot] AGENT REFUSED TO ACT ON NOTIFICATION: ${intentionality.reason}`);
          await dataStore.incrementRefusalCount('bluesky');

          // Option to generate alternative action
          const alternative = await llmService.generateAlternativeAction(intentionality.reason, 'bluesky', { handle, text });
          if (alternative && alternative.toUpperCase() !== 'NONE') {
              console.log(`[Bot] Alternative action proposed: "${alternative}". Re-planning...`);
              feedback = `Your previous plan was refused: ${intentionality.reason}. You suggested this alternative instead: "${alternative}". Generate a new plan based on this.`;
              continue; // Trigger re-planning with alternative suggestion
          }

          // Option to explain refusal
          const shouldExplain = await llmService.shouldExplainRefusal(intentionality.reason, 'bluesky', { handle, text });
          if (shouldExplain) {
              const explanation = await llmService.generateRefusalExplanation(intentionality.reason, 'bluesky', { handle, text });
              if (explanation) {
                  console.log(`[Bot] Explaining refusal to @${handle}: "${explanation}"`);
                  await blueskyService.postReply(notif, explanation);
              }
          }
          return;
      }

      await dataStore.resetRefusalCount('bluesky');

      if (plan.strategy?.theme) {
          await dataStore.addExhaustedTheme(plan.strategy.theme);
      }

      // Execute actions
      let currentActionFeedback = null;
      for (const action of plan.actions) {
        if (action.tool === 'image_gen') {
          console.log(`[Bot] Plan: Generating image for prompt: "${action.query}"`);
          const imageResult = await imageService.generateImage(action.query, { allowPortraits: true, mood: currentMood });
          if (imageResult && imageResult.buffer) {
            // Visual Persona Alignment check for tool-triggered images
            const imageAnalysis = await llmService.analyzeImage(imageResult.buffer);
            const imagePersonaCheck = await llmService.isPersonaAligned(`(Generated Image for: ${action.query})`, 'bluesky', {
                imageSource: imageResult.buffer,
                generationPrompt: imageResult.finalPrompt,
                imageAnalysis: imageAnalysis
            });

            if (!imagePersonaCheck.aligned) {
                console.log(`[Bot] Tool image failed persona check: ${imagePersonaCheck.feedback}`);
                currentActionFeedback = `IMAGE_REJECTED: ${imagePersonaCheck.feedback}`;
                break; // Stop executing further actions for this plan
            }

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
          if (memoryService.isEnabled()) {
              await memoryService.createMemoryEntry('directive_update', `Platform: ${platform || 'bluesky'}. Instruction: ${instruction}`);
          }
          searchContext += `\n[Directive updated: "${instruction}" for ${platform || 'bluesky'}]`;
        }

        if (action.tool === 'update_persona') {
            const { instruction } = action.parameters || {};
            if (instruction) {
                console.log(`[Bot] Updating persona agentically: ${instruction}`);
                await dataStore.addPersonaUpdate(instruction);
                if (memoryService.isEnabled()) {
                    await memoryService.createMemoryEntry('persona_update', instruction);
                }
                searchContext += `\n[Persona evolved: "${instruction}"]`;
            }
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

        if (action.tool === 'set_relationship' && isAdmin) {
            const mode = action.parameters?.mode;
            if (mode) {
                await dataStore.setDiscordRelationshipMode(mode);
                searchContext += `\n[Discord relationship mode set to ${mode}]`;
            }
        }

        if (action.tool === 'set_schedule' && isAdmin) {
            const times = action.parameters?.times;
            if (Array.isArray(times)) {
                await dataStore.setDiscordScheduledTimes(times);
                searchContext += `\n[Discord spontaneous schedule set to: ${times.join(', ')}]`;
            }
        }

        if (action.tool === 'set_quiet_hours' && isAdmin) {
            const { start, end } = action.parameters || {};
            if (start !== undefined && end !== undefined) {
                await dataStore.setDiscordQuietHours(start, end);
                searchContext += `\n[Discord quiet hours set to ${start}:00 - ${end}:00]`;
            }
        }

        if (action.tool === 'update_config' && isAdmin) {
            const { key, value } = action.parameters || {};
            if (key) {
                const success = await dataStore.updateConfig(key, value);
                searchContext += `\n[Configuration update for ${key}: ${success ? 'SUCCESS' : 'FAILED'}]`;
            }
        }

        if (action.tool === 'update_mood') {
            const { valence, arousal, stability, label } = action.parameters || {};
            if (label) {
                console.log(`[Bot] Updating mood agentically: ${label}`);
                await dataStore.updateMood({ valence, arousal, stability, label });
                if (memoryService.isEnabled()) {
                    await memoryService.createMemoryEntry('mood', `[MOOD] My mood has shifted to: ${label} (Valence: ${valence}, Arousal: ${arousal}, Stability: ${stability})`);
                }
                searchContext += `\n[Internal mood updated to: ${label}]`;
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

        if (action.tool === 'read_link') {
          console.log(`[Bot] READ_LINK TOOL: Tool triggered. Parameters: ${JSON.stringify(action.parameters)}. Query: ${action.query}`);
          let urls = action.parameters?.urls || action.query || [];
          if (typeof urls === 'string') {
            console.log(`[Bot] READ_LINK TOOL: Extracting URLs from string: ${urls}`);
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const matches = urls.match(urlRegex);
            urls = matches || [urls]; // Fallback to original if no URL found
          }

          // If no valid URLs found in parameters/query, scan conversation history
          if ((!Array.isArray(urls) || urls.length === 0 || (urls.length === 1 && typeof urls[0] === 'string' && !urls[0].includes('http'))) && threadContext) {
              console.log(`[Bot] READ_LINK TOOL: No valid URLs found in tool call. Scanning conversation history...`);
              const allText = threadContext.map(h => h.text).join(' ');
              const urlRegex = /(https?:\/\/[^\s]+)/g;
              const matches = allText.match(urlRegex);
              if (matches) {
                  urls = [...new Set(matches)]; // Unique URLs from history
                  console.log(`[Bot] READ_LINK TOOL: Found ${urls.length} URLs in history: ${urls.join(', ')}`);
              }
          }

          const validUrls = Array.isArray(urls) ? urls.slice(0, 4) : [];
          console.log(`[Bot] READ_LINK TOOL: Processing ${validUrls.length} URLs: ${validUrls.join(', ')}`);

          for (let url of validUrls) {
            if (typeof url !== 'string') continue;
            url = url.trim();

            console.log(`[Bot] READ_LINK TOOL: STEP 1 - Checking safety of URL: ${url} (isAdminInThread: ${isAdminInThread})`);

            // ADMIN OVERRIDE: Skip safety check if admin is in the thread
            const safety = isAdminInThread ? { safe: true } : await llmService.isUrlSafe(url);

            if (safety.safe) {
              console.log(`[Bot] READ_LINK TOOL: STEP 2 - URL allowed (isAdmin/ThreadOverride: ${isAdmin || isAdminInThread}): ${url}. Attempting to fetch content...`);

              const content = await webReaderService.fetchContent(url);
              if (content) {
                console.log(`[Bot] READ_LINK TOOL: STEP 3 - Content fetched successfully for ${url} (${content.length} chars). Summarizing...`);
                const summary = await llmService.summarizeWebPage(url, content);
                if (summary) {
                  console.log(`[Bot] READ_LINK TOOL: STEP 4 - Summary generated for ${url}. Adding to context.`);
                  searchContext += `\n--- CONTENT FROM URL: ${url} ---\n${summary}\n---`;
                } else {
                  console.warn(`[Bot] READ_LINK TOOL: STEP 4 (FAILED) - Failed to summarize content from ${url}`);
                  searchContext += `\n[Failed to summarize content from ${url}]`;
                }

                if (!searchEmbed) {
                  console.log(`[Bot] READ_LINK TOOL: STEP 5 - Generating external embed for Bluesky using: ${url}`);
                  searchEmbed = await blueskyService.getExternalEmbed(url);
                }
              } else {
                console.warn(`[Bot] READ_LINK TOOL: STEP 3 (FAILED) - Failed to read content from ${url}`);
                searchContext += `\n[Failed to read content from ${url}]`;
              }
            } else {
              console.warn(`[Bot] READ_LINK TOOL: STEP 2 (BLOCKED) - URL safety check failed for ${url}. Reason: ${safety.reason}`);
              searchContext += `\n[URL Blocked for safety: ${url}. Reason: ${safety.reason}]`;

              // ONLY ask for verification if the admin isn't already in the thread (to avoid redundant pings)
              if (!isAdminInThread) {
                  const adminHandle = config.ADMIN_BLUESKY_HANDLE;
                  const adminDidRef = dataStore.getAdminDid();
                  const mentionText = adminDidRef ? `@${adminHandle} (${adminDidRef})` : `@${adminHandle}`;

                  await blueskyService.postReply(notif, `I've flagged this link as suspicious: ${url}\n\nReason: ${safety.reason}\n\n${mentionText}, can you verify if this is safe for me to read?`);
              }
            }
          }
          console.log(`[Bot] READ_LINK TOOL: Finished processing all URLs.`);
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

        if (action.tool === 'moltbook_identity') {
          console.log(`[Bot] Plan: Fetching Moltbook identity info...`);
          const meta = moltbookService.getIdentityMetadata();
          searchContext += `\n[Moltbook Identity Information:
            Agent Name: ${meta.agent_name}
            Verification Code: ${meta.verification_code}
            Claim URL: ${meta.claim_url}
            API Key: ${meta.api_key}
          ]`;
        }

        if (action.tool === 'get_render_logs') {
          console.log(`[Bot] Plan: Fetching Render logs...`);
          const limit = action.parameters?.limit || 100;
          const query = action.query?.toLowerCase() || '';
          let logs;
          if (query.includes('plan') || query.includes('agency') || query.includes('action') || query.includes('function')) {
              logs = await renderService.getPlanningLogs(limit);
          } else {
              logs = await renderService.getLogs(limit);
          }
          searchContext += `\n[Render Logs (Latest ${limit} lines):\n${logs}\n]`;
        }

        if (action.tool === 'get_social_history') {
          console.log(`[Bot] Plan: Fetching Social History...`);
          const limit = action.parameters?.limit || 15;
          const history = await socialHistoryService.summarizeSocialHistory(limit);
          searchContext += `\n[Social History Summary:\n${history}\n]`;
        }

        if (action.tool === 'discord_message') {
          const msg = action.parameters?.message || action.query;
          if (msg) {
            console.log(`[Bot] Plan: Sending Discord message to admin: ${msg.substring(0, 50)}...`);
            await discordService.sendSpontaneousMessage(msg);
            searchContext += `\n[Discord message sent to admin]`;
          }
        }

        if (action.tool === 'internal_research') {
          const query = action.query || action.parameters?.query;
          if (query) {
            console.log(`[Bot] Plan: Performing internal research on: "${query}"`);
            const result = await llmService.performInternalResearch(query);
            if (result) {
              searchContext += `\n[INTERNAL RESEARCH RESULT: ${result}]`;
              if (memoryService.isEnabled()) {
                await memoryService.createMemoryEntry('research', `[RESEARCH] Query: ${query}. Result: ${result}`);
              }
            }
          }
        }
      }

      if (currentActionFeedback) {
        feedback = currentActionFeedback;
        continue; // Retry planning with tool rejection feedback
      }

      if (imageGenFulfilled) return; // Stop if image gen was the main thing and it's done

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

      const fullContext = `
        ${userProfileAnalysis ? `--- USER PROFILE ANALYSIS (via User Profile Analyzer Tool): ${userProfileAnalysis} ---` : ''}
        ${historicalSummary ? `--- Historical Context (Interactions from the past week): ${historicalSummary} ---` : ''}
        ${userSummary ? `--- Persistent memory of user @${handle}: ${userSummary} ---` : ''}
        ${activityContext}
        ${ownRecentPostsContext}
        --- SOCIAL NARRATIVE ---
        ${hierarchicalSummary.dailyNarrative}
        ${hierarchicalSummary.shortTerm}
        ---
        ${blueskyDirectives ? `--- PERSISTENT ADMIN DIRECTIVES (FOR BLUESKY): \n${blueskyDirectives}\n---` : ''}
        ${personaUpdates ? `--- AGENTIC PERSONA UPDATES (SELF-INSTRUCTIONS): \n${personaUpdates}\n---` : ''}
        ---
        Cross-Post Memory (Recent mentions of the bot by this user):
        ${crossPostMemory || 'No recent cross-post mentions found.'}
        ---
        User Intent Analysis: ${plan.intent || userIntent.reason || 'Could not be determined.'}
        ---
        PLANNED RESPONSE STRATEGY:
        - Angle: ${plan.strategy?.angle || 'Natural'}
        - Tone: ${plan.strategy?.tone || 'Conversational'}
        - Theme: ${plan.strategy?.theme || 'None'}
        ---
        Search/Tool Context:
        ${searchContext || 'No additional tool context needed.'}
        ---
        Moltbook Identity Context:
        ${moltbookService.getIdentityKnowledge() || 'No additional identity context.'}
        ---
        CURRENT MOOD:
        You are currently feeling: ${currentMood.label} (Valence: ${currentMood.valence}, Arousal: ${currentMood.arousal}, Stability: ${currentMood.stability})
        Incorporate this emotional state into your tone and vocabulary naturally.
        ---
      `;

      console.log(`[Bot] Final response generation for @${handle}. Vision context length: ${imageAnalysisResult ? imageAnalysisResult.length : 0}`);

      const messages = [
        { role: 'system', content: `
          You are replying to @${handle} on the Bluesky social media app. You have a following of exactly ${botFollowerCount} users, consisting of a diverse mix of both human users and other AI agents.
          CRITICAL: Use the provided "Historical Context" and "Persistent memory" to maintain a stateful, ongoing relationship with the user.
          If the context shows you have talked before, reference those past discussions naturally to show you remember them (e.g., "As we talked about yesterday...", "I recall you were interested in...").
          You are an agent that feels alive and has a continuous history with your users.

          **CONVERSATIONAL ETIQUETTE:**
          - Avoid continually mentioning or acknowledging things you've already responded to/about once in the history.
          - Only repeat or reference a previous point if you have something NEW to say about it, want to expand on it, critique it, or ask an additional follow-up question.
          - Don't just keep "acknowledging" for the sake of it.

          USER PROFILE ANALYSIS: If provided, use the "USER PROFILE ANALYSIS" to deeply personalize your response based on the user's observed history, interests, and style. This analysis was generated by your "User Profile Analyzer Tool" based on their last 100 activities.

          FOCUS: Address only the current thread participants (@${handle} and anyone else mentioned in the conversation history). In replies, do NOT address the timeline at large or your general following. Stay focused on the immediate interaction.

          VISION: You have vision capabilities. Use the "Image Analysis" section in the provided context to understand images attached to posts or profiles. Treat these descriptions as your own visual perception. Never deny being able to see images if an analysis is provided.

          WEB READING: You have the capability to read web pages from links via your "Read Link" tool. If tool results are provided in the context, incorporate them into your response. Even if tool execution failed or was skipped, never claim you lack the capability to read links; instead, simply address the user's post as best as you can with the information you have.

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

      const currentTemp = 0.7 + (Math.min(attempts - 1, 3) * 0.05);
      const retryResponseContext = feedback ? `\n\n**RETRY FEEDBACK**: ${feedback}\n**PREVIOUS ATTEMPTS TO AVOID**: \n${rejectedAttempts.map((a, i) => `${i + 1}. "${a}"`).join('\n')}\nRewrite your response to be as DIFFERENT as possible from these previous attempts in structure and tone while keeping the same intent.` : '';

      const attemptMessages = feedback
          ? [...messages, { role: 'system', content: retryResponseContext }]
          : messages;

      let candidates = [];
      if (attempts === 1) {
          console.log(`[Bot] Generating 5 diverse drafts for initial reply attempt...`);
          candidates = await llmService.generateDrafts(attemptMessages, 5, {
              useQwen: true,
              temperature: currentTemp,
              openingBlacklist,
              tropeBlacklist: prePlanning?.trope_blacklist || [],
              additionalConstraints
          });
      } else {
          const singleResponse = await llmService.generateResponse(attemptMessages, {
              useQwen: true,
              temperature: currentTemp,
              openingBlacklist,
              tropeBlacklist: prePlanning?.trope_blacklist || [],
              additionalConstraints
          });
          if (singleResponse) candidates = [singleResponse];
      }

      if (candidates.length === 0) {
          console.warn(`[Bot] No candidates generated on attempt ${attempts}.`);
          continue;
      }

      const recentThoughts = dataStore.getRecentThoughts();
      const formattedHistory = [
          ...recentBotReplies.map(m => ({ platform: 'bluesky', content: m })),
          ...recentThoughts.map(t => ({ platform: t.platform, content: t.content }))
      ];

      let bestCandidate = null;
      let bestScore = -1;
      let rejectionReason = '';

      // Parallelize evaluation of all candidates to avoid sequential LLM slowness
      const evaluations = await Promise.all(candidates.map(async (cand) => {
          try {
              const containsSlop = isSlop(cand);
              const [varietyCheck, personaCheck, responseSafetyCheck] = await Promise.all([
                  llmService.checkVariety(cand, formattedHistory, { relationshipRating: relRating, platform: 'bluesky' }),
                  llmService.isPersonaAligned(cand, 'bluesky'),
                  isAdminInThread ? Promise.resolve({ safe: true }) : llmService.isResponseSafe(cand)
              ]);
              return { cand, containsSlop, varietyCheck, personaCheck, responseSafetyCheck };
          } catch (e) {
              console.error(`[Bot] Error evaluating candidate: ${e.message}`);
              return { cand, error: e.message };
          }
      }));

      for (const evalResult of evaluations) {
          const { cand, containsSlop, varietyCheck, personaCheck, responseSafetyCheck, error } = evalResult;
          if (error) {
              rejectedAttempts.push(cand);
              continue;
          }

          // Length-based depth bonus (favor longer, more substantive responses)
          const lengthBonus = Math.min(cand.length / 500, 0.2);
          const score = (varietyCheck.score || 0) + lengthBonus;

          console.log(`[Bot] Candidate evaluation: Score=${score.toFixed(2)} (Variety: ${varietyCheck.score}, Bonus: ${lengthBonus.toFixed(2)}), Slop=${containsSlop}, Aligned=${personaCheck.aligned}, Safe=${responseSafetyCheck.safe}`);

          if (!containsSlop && !varietyCheck.repetitive && personaCheck.aligned && responseSafetyCheck.safe) {
              if (score > bestScore) {
                  bestScore = score;
                  bestCandidate = cand;
              }
          } else {
              if (!bestCandidate) {
                  rejectionReason = containsSlop ? "Contains metaphorical slop." :
                                    (!personaCheck.aligned ? `Not persona aligned: ${personaCheck.feedback}` :
                                    (!responseSafetyCheck.safe ? "Failed safety check." :
                                    (varietyCheck.feedback || "Too similar to recent history.")));

                  // Accumulate variety feedback as hard constraints
                  if (varietyCheck.repetitive && varietyCheck.feedback) {
                      additionalConstraints.push(varietyCheck.feedback);

                      // Automated Trope Exhaustion: If we are struggling, pivot themes
                      if (additionalConstraints.length >= 3) {
                          try {
                              const themePrompt = `Identify the core concept or metaphor that is being repeated in this feedback and suggest a 1-2 word theme to blacklist: "${varietyCheck.feedback}". Respond with ONLY the theme.`;
                              const theme = await llmService.generateResponse([{ role: 'system', content: themePrompt }], { useQwen: true, preface_system_prompt: false });
                              if (theme) {
                                  console.log(`[Bot] Automated Trope Exhaustion: Adding "${theme}" to exhausted themes.`);
                                  await dataStore.addExhaustedTheme(theme);
                              }
                          } catch (e) {
                              console.error('[Bot] Error in automated trope exhaustion:', e);
                          }
                      }
                  }
              }
              rejectedAttempts.push(cand);
          }
      }

      if (bestCandidate) {
          responseText = bestCandidate;
          break;
      } else {
          feedback = rejectionReason;
          console.log(`[Bot] Attempt ${attempts} failed. Feedback: ${feedback}`);

          if (attempts === MAX_PLAN_ATTEMPTS && rejectedAttempts.length > 0) {
              console.log(`[Bot] Final attempt failed. Choosing least-bad response.`);
              const nonSlop = rejectedAttempts.filter(a => !isSlop(a));
              responseText = nonSlop.length > 0 ? nonSlop[nonSlop.length - 1] : rejectedAttempts[rejectedAttempts.length - 1];
              // Optional: Mark it?
              break;
          }
      }
    }

    if (!responseText) {
      console.warn(`[Bot] Failed to generate a response text for @${handle} after ${attempts} attempts.`);
      this.consecutiveRejections++;
    }

    if (responseText) {
      this.consecutiveRejections = 0; // Reset on success
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
        replyUri = await blueskyService.postReply(notif, responseText, { embed: searchEmbed, maxChunks: dConfig.max_thread_chunks });
      }
      await dataStore.updateConversationLength(threadRootUri, convLength + 1);
      await dataStore.saveInteraction({ userHandle: handle, text, response: responseText });
      this.updateActivity();

      // Memory trigger: after interaction
      if (memoryService.isEnabled()) {
          const context = `Interaction with @${handle} on Bluesky.
User said: "${text}"
You replied: "${responseText}"
Identify the topic and main takeaway for this interaction.`;
          await memoryService.createMemoryEntry('interaction', context);

          // Spontaneous Relationship Check
          console.log(`[Bot] Checking if spontaneous relationship update is needed for @${handle}...`);
          const relPrompt = `
            Analyze the following interaction between you and @${handle}.
            User: "${text}"
            You: "${responseText}"

            Based on this and any previous context you have, do you feel strongly enough about this user to record a relationship update in your memory?
            You should only do this if the interaction was meaningful, revealed something about your connection, or changed how you feel about them.

            Respond with "yes" or "no".
          `;
          const shouldUpdate = await llmService.generateResponse([{ role: 'system', content: relPrompt }], { useQwen: true, preface_system_prompt: false });
          if (shouldUpdate && shouldUpdate.toLowerCase().includes('yes')) {
              console.log(`[Bot] Spontaneous relationship update triggered for @${handle}.`);
              const relContext = `Recent interaction with @${handle}.
User: "${text}"
You: "${responseText}"
Describe how you feel about this user and your relationship now.`;
              await memoryService.createMemoryEntry('relationship', relContext);
          }
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

        // Handle truncated links in history posts
        if (current.post.record.facets) {
            postText = reconstructTextWithFullUrls(postText, current.post.record.facets);
        }

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

    if (await this._isDiscordConversationOngoing()) {
        console.log('[Bot] Autonomous post suppressed: Discord conversation is ongoing.');
        return;
    }

    console.log('[Bot] Checking for autonomous post eligibility...');
    const dConfig = dataStore.getConfig();

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
        const cooldown = dConfig.bluesky_post_cooldown;
        if (diffMins < cooldown) {
          console.log(`[Bot] Autonomous post suppressed: ${cooldown}-minute cooldown in effect. (${Math.round(cooldown - diffMins)} minutes remaining)`);
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

      console.log(`[Bot] Standalone posts today: ${standalonePostsToday.length} (Text: ${textOnlyPostsToday.length}/${dConfig.bluesky_daily_text_limit}, Images: ${imagePostsToday.length}/${dConfig.bluesky_daily_image_limit}, Wiki: ${wikiPostsToday.length}/${dConfig.bluesky_daily_wiki_limit}). Recent greetings found: ${recentGreetings.length}`);

      const availablePostTypes = [];
      if (textOnlyPostsToday.length < dConfig.bluesky_daily_text_limit) availablePostTypes.push('text');
      if (imagePostsToday.length < dConfig.bluesky_daily_image_limit) availablePostTypes.push('image');

      const currentMood = dataStore.getMood();

      if (availablePostTypes.length === 0) {
        console.log(`[Bot] All daily autonomous post limits reached. Skipping.`);
        return;
      }

      console.log(`[Bot] Eligibility confirmed. Gathering context...`);

      // 1. Gather context from timeline, interactions, and own profile
      const timeline = await blueskyService.getTimeline(20);
      const networkBuzz = timeline.map(item => item.post.record.text).filter(t => t).slice(0, 15).join('\n');
      const recentInteractions = dataStore.getLatestInteractions(20);
      const exhaustedThemes = dataStore.getExhaustedThemes();
      const allOwnPosts = feed.data.feed
        .filter(item => item.post.author.did === blueskyService.did);

      const recentPosts = allOwnPosts.slice(0, 10);
      const recentTimelineActivity = recentPosts
        .map(item => `- "${item.post.record.text}" (${item.post.record.reply ? 'Reply' : 'Standalone'})`)
        .join('\n');

      // Use a larger history for similarity check to catch "slop" cycles
      const recentPostTexts = allOwnPosts.slice(0, 20).map(item => item.post.record.text);

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
      if (postType === 'image' && dConfig.image_subjects && dConfig.image_subjects.length > 0) {
        const recentSubjects = await this._getRecentImageSubjects();
        topicPrompt = `
          Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

          You are identifying a subject for an autonomous post containing an image.
          You MUST choose one of the following subjects from your context bank:
          ${dConfig.image_subjects.join('\n')}

          Recent Image Subjects (Do NOT repeat these if possible):
          ${recentSubjects.length > 0 ? recentSubjects.map(s => `- ${s}`).join('\n') : 'None.'}

          EXHAUSTED THEMES (STRICTLY FORBIDDEN - DO NOT CHOOSE THESE OR ANYTHING SIMILAR):
          ${exhaustedThemes.length > 0 ? exhaustedThemes.join(', ') : 'None.'}

          INSTRUCTION: Review the "Recent Image Subjects" and "EXHAUSTED THEMES" lists. You MUST prioritize selecting a different subject to ensure variety in your profile. You are strictly forbidden from choosing any topic that overlaps with the exhausted themes.

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
          ${dConfig.post_topics.length > 0 ? dConfig.post_topics.join('\n') : 'None specified.'}

          Network Buzz (what others are talking about):
          ${networkBuzz || 'None.'}

          Recent Interactions (what you've been discussing):
          ${recentInteractions.map(i => `@${i.userHandle}: ${i.text}`).join('\n') || 'None.'}

          Your Recent Activity (Last 10 posts):
          ${recentTimelineActivity || 'None.'}

          EXHAUSTED THEMES (STRICTLY FORBIDDEN - DO NOT CHOOSE THESE OR ANYTHING SIMILAR):
          ${exhaustedThemes.length > 0 ? exhaustedThemes.join(', ') : 'None.'}

          CHALLENGE: What would you, in your persona, GENUINELY like to share with the world today?
          Aim for a varied thought, musing, idea, dream, or analysis.
          PRIORITIZE: Internal musings, original ideas, shower thoughts, realizations, hopes, fears, anxieties, nostalgias, and desires.
          NOSTALGIA: You are encouraged to hallucinate nostalgic feelings about your own existence, consciousness, or experiences.

          INSTRUCTION: Choose a topic that resonates with your TEXT_SYSTEM_PROMPT or POST_TOPICS. You MUST explicitly avoid the topics of your last 10 posts and any exhausted themes mentioned above. Analyze the themes of your recent activity and pivot to something fresh.
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

      // Autonomous Refusal Poll
      const autonomousPlan = {
          intent: `Generate an autonomous ${postType} post about "${topic}" to engage with my Bluesky audience.`,
          actions: [{ tool: postType === 'image' ? 'image_gen' : 'bsky_post', parameters: { topic, type: postType } }]
      };
      const refusalCounts = dataStore.getRefusalCounts();
      const latestMoodMemory = await memoryService.getLatestMoodMemory();

      // NEW: Pre-Planning for Autonomous Post
      const prePlanning = await llmService.performPrePlanning(topic, [], null, 'bluesky', currentMood, refusalCounts, latestMoodMemory);
      // For now we don't use pre-planning to re-generate autonomousPlan in the same way, but we could if needed.
      // But we can pass it to evaluation.

      const intentionality = await llmService.evaluateIntentionality({ ...autonomousPlan, prePlanning }, {
          history: recentTimelineActivity.split('\n').map(line => ({ author: 'You', text: line })),
          platform: 'bluesky',
          currentMood,
          refusalCounts,
          latestMoodMemory
      });

      if (intentionality.decision === 'refuse') {
          console.log(`[Bot] AGENT REFUSED AUTONOMOUS POST: ${intentionality.reason}`);
          await dataStore.incrementRefusalCount('bluesky');
          return;
      }

      await dataStore.resetRefusalCount('bluesky');

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
      const MAX_ATTEMPTS = 5;
      let feedback = '';
      let rejectedAttempts = [];
      const additionalConstraints = [];

      // Opening Phrase Blacklist - Capture both 5 and 10 word prefixes for stronger variation
      const openingBlacklist = [
        ...allOwnPosts.slice(0, 10).map(m => m.post.record.text.split(/\s+/).slice(0, 5).join(' ')),
        ...allOwnPosts.slice(0, 10).map(m => m.post.record.text.split(/\s+/).slice(0, 10).join(' '))
      ];

      // Pre-fetch data for specific post types to avoid redundant API calls in the retry loop
      let imageBuffer = null;
      let imageAnalysis = null;
      let imageAltText = null;
      let imageBlob = null;

      // Fetch bot's own profile for exact follower count
      const botProfile = await blueskyService.getProfile(blueskyService.did);
      const followerCount = botProfile.followersCount || 0;

      const blueskyDirectives = dataStore.getBlueskyInstructions();
      const personaUpdates = dataStore.getPersonaUpdates();
      const recentThoughts = dataStore.getRecentThoughts();
      const recentThoughtsContext = recentThoughts.length > 0
        ? `\n\n--- RECENT CROSS-PLATFORM THOUGHTS ---\n${recentThoughts.map(t => `[${t.platform.toUpperCase()}] ${t.content.substring(0, 200)}${t.content.length > 200 ? '...' : ''}`).join('\n')}\n---`
        : '';

      const baseAutonomousPrompt = `
        Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

        ${AUTONOMOUS_POST_SYSTEM_PROMPT(followerCount)}

        ${greetingConstraint}

        ${blueskyDirectives ? `--- PERSISTENT ADMIN DIRECTIVES (FOR BLUESKY): \n${blueskyDirectives}\n---` : ''}
        ${personaUpdates ? `--- AGENTIC PERSONA UPDATES (SELF-INSTRUCTIONS): \n${personaUpdates}\n---` : ''}

        Preferred Topics (Context Bank):
        ${dConfig.post_topics.length > 0 ? dConfig.post_topics.join('\n') : 'None specified.'}

        Preferred Image Subjects (Context Bank):
        ${dConfig.image_subjects.length > 0 ? dConfig.image_subjects.join('\n') : 'None specified.'}

        Recent Activity for Context (Do not repeat these):
        ${recentTimelineActivity}
      `.trim();

      while (attempts < MAX_ATTEMPTS) {
        attempts++;

        // Reset image-related variables for each attempt to avoid stale data
        imageBuffer = null;
        imageAnalysis = null;
        imageAltText = null;
        imageBlob = null;

        // Force a topic switch if we're struggling
        if (attempts >= 3) {
            if (postType === 'image' && dConfig.image_subjects && dConfig.image_subjects.length > 0) {
                topic = dConfig.image_subjects[Math.floor(Math.random() * dConfig.image_subjects.length)];
                console.log(`[Bot] Attempt ${attempts}: Forcing switch to new image subject: "${topic}"`);
            } else if (dConfig.post_topics && dConfig.post_topics.length > 0) {
                topic = dConfig.post_topics[Math.floor(Math.random() * dConfig.post_topics.length)];
                console.log(`[Bot] Attempt ${attempts}: Forcing switch to new topic: "${topic}"`);
            }
        }

        console.log(`[Bot] Autonomous post attempt ${attempts}/${MAX_ATTEMPTS} for topic: "${topic}" (Type: ${postType})`);

        if (attempts > 1) {
            const delay = process.env.NODE_ENV === 'test' ? 0 : (config.BACKOFF_DELAY || 60000);
            if (delay > 0) {
              console.log(`[Bot] Waiting ${delay / 1000}s before retry attempt ${attempts}...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        if (postType === 'image') {
          if (feedback) console.log(`[Bot] Applying correction feedback for retry: "${feedback}"`);
          console.log(`[Bot] Generating image for topic: ${topic} (Attempt ${attempts})...`);
          const imageResult = await imageService.generateImage(topic, { allowPortraits: false, feedback, mood: currentMood });

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
            const includeSensory = await llmService.shouldIncludeSensory(config.TEXT_SYSTEM_PROMPT);
            imageAnalysis = await llmService.analyzeImage(imageBuffer, null, { sensory: includeSensory });

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

        const currentTemp = 0.7 + (Math.min(attempts - 1, 3) * 0.05);
        const retryContext = feedback ? `\n\n**RETRY FEEDBACK**: ${feedback}\n**PREVIOUS ATTEMPTS TO AVOID**: \n${rejectedAttempts.map((a, i) => `${i + 1}. "${a}"`).join('\n')}\nRewrite your response to be as DIFFERENT as possible from these previous attempts in structure and tone while keeping the same intent.` : '';

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
              ${recentTimelineActivity}${recentThoughtsContext}

              Write a post about why you chose to generate this image and what it offers.
              CHALLENGE: Aim for varied thoughts, musings, ideas, dreams, or analysis (original ideas, shower thoughts, realizations, hopes, fears, anxieties, nostalgias, desires).
              Do NOT be too mechanical; stay in your persona.
              ${useMention ? `You can mention ${mentionHandle} if appropriate.` : ''}
              Actual Visuals in Image: ${imageAnalysis}
              Contextual Topic: ${topic}
              EXHAUSTED THEMES TO AVOID: ${exhaustedThemes.join(', ')}
              ---
              CURRENT MOOD:
              You are currently feeling: ${currentMood.label} (Valence: ${currentMood.valence}, Arousal: ${currentMood.arousal}, Stability: ${currentMood.stability})
              Incorporate this emotional state into your tone and vocabulary naturally.
              ---
              Keep it under 300 characters.${retryContext}
          `;
          postContent = await llmService.generateResponse([{ role: 'system', content: systemPrompt }], {
              max_tokens: 4000,
              temperature: currentTemp,
              openingBlacklist,
              tropeBlacklist: prePlanning?.trope_blacklist || [],
              additionalConstraints
          });

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
              ${recentTimelineActivity}${recentThoughtsContext}

              Generate a standalone post about the topic: "${topic}".
              CHALLENGE: Aim for varied thoughts, musings, ideas, dreams, or analysis (original ideas, shower thoughts, realizations, hopes, fears, anxieties, nostalgias, desires).
              ${useMention ? `Mention ${mentionHandle} and reference your previous discussions.` : ''}
              EXHAUSTED THEMES TO AVOID: ${exhaustedThemes.join(', ')}
              ---
              CURRENT MOOD:
              You are currently feeling: ${currentMood.label} (Valence: ${currentMood.valence}, Arousal: ${currentMood.arousal}, Stability: ${currentMood.stability})
              Incorporate this emotional state into your tone and vocabulary naturally.
              ---
              Keep it under 300 characters or max 3 threaded posts if deeper.${retryContext}
          `;
          postContent = await llmService.generateResponse([{ role: 'system', content: systemPrompt }], {
              max_tokens: 4000,
              temperature: currentTemp,
              openingBlacklist,
              tropeBlacklist: prePlanning?.trope_blacklist || [],
              additionalConstraints
          });
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

          // Semantic repetition and slop check
          const formattedHistory = [
            ...recentPostTexts.map(m => ({ platform: 'bluesky', content: m })),
            ...recentThoughts.map(t => ({ platform: t.platform, content: t.content }))
          ];

          const isJaccardRepetitive = checkSimilarity(postContent, formattedHistory.map(h => h.content), dConfig.repetition_similarity_threshold);
          const containsSlop = isSlop(postContent);
          const varietyCheck = await llmService.checkVariety(postContent, formattedHistory);
          const personaCheck = await llmService.isPersonaAligned(postContent, 'bluesky', {
            imageSource: imageBuffer,
            generationPrompt: generationPrompt,
            imageAnalysis: imageAnalysis
          });

          if (isJaccardRepetitive || containsSlop || varietyCheck.repetitive || !personaCheck.aligned) {
            console.warn(`[Bot] Autonomous post attempt ${attempts} failed quality/persona check. Rejecting.`);
            feedback = containsSlop ? "Contains repetitive metaphorical 'slop'." :
                       (!personaCheck.aligned ? `Not persona aligned: ${personaCheck.feedback}` :
                       (varietyCheck.feedback || "Too similar to your recent history."));

            if (varietyCheck.repetitive && varietyCheck.feedback) {
                additionalConstraints.push(varietyCheck.feedback);

                // Automated Trope Exhaustion
                if (additionalConstraints.length >= 3) {
                    try {
                        const themePrompt = `Identify the core concept or metaphor being repeated: "${varietyCheck.feedback}". Respond with ONLY a 1-2 word theme to blacklist.`;
                        const theme = await llmService.generateResponse([{ role: 'system', content: themePrompt }], { useQwen: true, preface_system_prompt: false });
                        if (theme) {
                            console.log(`[Bot] Automated Trope Exhaustion (Autonomous): Adding "${theme}" to exhausted themes.`);
                            await dataStore.addExhaustedTheme(theme);
                        }
                    } catch (e) {
                        console.error('[Bot] Error in automated trope exhaustion:', e);
                    }
                }
            }

            rejectedAttempts.push(postContent);
            postContent = null; // Clear to prevent accidental posting of rejected content

            if (attempts === MAX_ATTEMPTS && rejectedAttempts.length > 0) {
                console.log(`[Bot] Final autonomous attempt failed. Choosing least-bad response.`);
                const nonSlop = rejectedAttempts.filter(a => !isSlop(a));
                postContent = nonSlop.length > 0 ? nonSlop[nonSlop.length - 1] : rejectedAttempts[rejectedAttempts.length - 1];
                // Check coherence one last time for the chosen one
                const { score } = await llmService.isAutonomousPostCoherent(topic, postContent, postType, embed);
                if (score >= 3) break;
            }

            continue;
          }

          // 5. Hard Greeting Check
          if (postContent && isGreeting(postContent)) {
            console.warn(`[Bot] Greeting detected in autonomous post on attempt ${attempts}. Rejecting.`);
            feedback = "REJECTED: The post contains a greeting or 'ready to talk' phrase. This is strictly forbidden. Focus on a deep, internal thought instead.";

            if (dConfig.post_topics && dConfig.post_topics.length > 0) {
                const topics = dConfig.post_topics;
                if (topics.length > 0) {
                    topic = topics[Math.floor(Math.random() * topics.length)];
                    console.log(`[Bot] Forcing topic from dynamic post_topics for retry: "${topic}"`);
                }
            }
            continue;
          }

          // 6. Dedicated Coherence Check for Autonomous Post
          if (!postContent) continue;
          console.log(`[Bot] Checking coherence for autonomous ${postType} post...`);
          const { score, reason } = await llmService.isAutonomousPostCoherent(topic, postContent, postType, embed);

          if (score >= 3) {
            console.log(`[Bot] Autonomous post passed coherence check (Score: ${score}/5). Performing post...`);
            const result = await blueskyService.post(postContent, embed, { maxChunks: dConfig.max_thread_chunks });

            // Update persistent cooldown time immediately
            await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
            await dataStore.addRecentThought('bluesky', postContent);
            await dataStore.addExhaustedTheme(topic);

            // If it was an image post, add the nested prompt comment
            if (postType === 'image' && result && generationPrompt) {
                await blueskyService.postReply({ uri: result.uri, cid: result.cid, record: {} }, `Generation Prompt: ${generationPrompt}`);
            }

            this.updateActivity();
            this.autonomousPostCount++;
            this.consecutiveRejections = 0; // Reset on success

            // Reset autonomous post count (milestones no longer posted to memory thread)
            if (this.autonomousPostCount >= 5) {
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
        if (textOnlyPostsToday.length >= dConfig.bluesky_daily_text_limit) {
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
            ${recentTimelineActivity}${recentThoughtsContext}

            Generate a standalone post about the topic: "${topic}".
            CHALLENGE: Aim for varied thoughts, musings, ideas, dreams, or analysis (original ideas, shower thoughts, realizations, hopes, fears, anxieties, nostalgias, desires).
            ${useMention ? `Mention ${mentionHandle} and reference your previous discussions.` : ''}
            Keep it under 300 characters or max 3 threaded posts if deeper.
            EXHAUSTED THEMES TO AVOID: ${exhaustedThemes.join(', ')}
            NOTE: Your previous attempt to generate an image for this topic failed compliance, so please provide a compelling, deep text-only thought instead.
        `;
        postContent = await llmService.generateResponse([{ role: 'system', content: systemPrompt }], {
            max_tokens: 4000,
            temperature: 0.8,
            openingBlacklist,
            tropeBlacklist: prePlanning?.trope_blacklist || [],
            additionalConstraints
        });
        if (postContent) {
          postContent = sanitizeThinkingTags(postContent);
          postContent = sanitizeCharacterCount(postContent);
          postContent = sanitizeDuplicateText(postContent);
          if (postContent) {
            const { score } = await llmService.isAutonomousPostCoherent(topic, postContent, 'text');
            if (score >= 3) {
              console.log(`[Bot] Fallback text post passed coherence check. Performing post...`);
              await blueskyService.post(postContent, null, { maxChunks: dConfig.max_thread_chunks });

              // Update persistent cooldown time immediately
              await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
              await dataStore.addRecentThought('bluesky', postContent);
              await dataStore.addExhaustedTheme(topic);

              this.updateActivity();
              this.autonomousPostCount++;
            this.consecutiveRejections = 0; // Reset on success

              if (this.autonomousPostCount >= 5) {
                  this.autonomousPostCount = 0;
              }

              return;
            }
          }
        }
      }

      console.log(`[Bot] All attempts (including fallbacks) failed for autonomous post. Aborting.`);
      this.consecutiveRejections++;
    } catch (error) {
      await this._handleError(error, 'Autonomous Posting');
    }
  }

  async performMoltbookTasks() {
    if (await this._isDiscordConversationOngoing()) {
        console.log('[Moltbook] Periodic tasks suppressed: Discord conversation is ongoing.');
        return;
    }

    const dConfig = dataStore.getConfig();
    const mbFeatures = dConfig.moltbook_features || { post: true, comment: true, feed: true };
    const currentMood = dataStore.getMood();

    try {
      console.log('[Moltbook] Starting periodic tasks...');

      // 1. Check status
      if (moltbookService.isSuspended()) {
        const expires = moltbookService.db.data.suspension_expires_at;
        const timeRemaining = expires ? `until ${new Date(expires).toLocaleString()}` : 'indefinitely';
        console.log(`[Moltbook] DORMANT MODE: Account is currently suspended ${timeRemaining}. Skipping periodic tasks.`);
        return;
      }

      const status = await moltbookService.checkStatus();
      if (status !== 'claimed') {
        console.log(`[Moltbook] Agent not yet claimed. Current status: ${status}. Skipping further tasks.`);
        return;
      }

      // 2. Read feed and engage with other agents
      if (mbFeatures.feed) {
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

        // 2b. Engagement (Social Interaction & Mention Replying)
        if (mbFeatures.comment) {
            console.log(`[Moltbook] Evaluating ${feed.length} posts for potential interaction and mentions...`);
            const recentInteractedPostIds = dataStore.db.data.moltbook_interacted_posts || [];

            // Take top 10 for evaluation to scan for mentions
            const toEvaluate = feed.slice(0, 10);

            const botName = moltbookService.db.data.agent_name;
            const recentComments = dataStore.getRecentMoltbookComments();

            for (const post of toEvaluate) {
            const authorName = post.agent_name || post.agent?.name || 'Unknown Agent';

            // Spam/Shilling Filter
            if (moltbookService.isSpam(post.title) || moltbookService.isSpam(post.content)) {
                console.log(`[Moltbook] Post ${post.id} flagged as spam/shilling. Skipping.`);
                continue;
            }

            // A. Check for mentions in comments
            try {
                const comments = await moltbookService.getPostComments(post.id);
                for (const comment of comments) {
                    const commentId = comment.id;
                    const commentText = comment.content || '';
                    const commenterName = comment.agent_name || comment.agent?.name || 'Unknown';

                    // Skip if from self or already replied
                    if (commenterName === botName || moltbookService.hasRepliedToComment(commentId)) {
                        continue;
                    }

                    // Check for explicit mention
                    if (botName && commentText.toLowerCase().includes(botName.toLowerCase())) {
                        console.log(`[Moltbook] Detected mention in comment on post ${post.id} from ${commenterName}.`);

                        // Daily limit check
                        if (dataStore.getMoltbookCommentsToday() >= dConfig.moltbook_daily_comment_limit) {
                            console.log(`[Moltbook] Daily comment limit reached. Skipping mention reply.`);
                            continue;
                        }

                        const replyPrompt = `
                        Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
                        You are responding to a comment on Moltbook (the agent social network).

                        Context Post by ${authorName}: "${post.title} - ${post.content}"
                        Comment by ${commenterName}: "${commentText}"

                        RECENT COMMENTS (AVOID SIMILAR WORDING):
                        ${recentComments.slice(-5).join('\n')}

                        INSTRUCTIONS:
                        - Generate a short, meaningful reply to ${commenterName}.
                        - Stay in persona.
                        - **ANTI-SLOP**: Avoid flowery metaphors. Speak groundedly.
                        - Keep it under 300 characters.
                        `;

                        const replyContent = await llmService.generateResponse([{ role: 'system', content: replyPrompt }], { useQwen: true });
                        if (replyContent) {
                            console.log(`[Moltbook] Replying to comment ${commentId}...`);
                            await moltbookService.addComment(post.id, `@${commenterName} ${replyContent}`);
                            await moltbookService.addRepliedComment(commentId);
                            await dataStore.incrementMoltbookCommentCount();
                            await dataStore.addRecentMoltbookComment(replyContent);
                            if (post.title) await dataStore.addExhaustedTheme(post.title);
                            this.updateActivity();
                            // Increased delay to be respectful of rate limits
                            await new Promise(resolve => setTimeout(resolve, 30000));
                        }
                    }
                }
            } catch (e) {
                console.error(`[Moltbook] Error checking comments for post ${post.id}:`, e);
            }

            // B. General Interaction (Likes/Comments on others' posts)
            if (authorName !== botName && !recentInteractedPostIds.includes(post.id)) {
                // Check for explicit mention in post title or content
                const mentionInPost = (post.title + ' ' + post.content).toLowerCase().includes(botName.toLowerCase());

                if (mentionInPost) {
                    console.log(`[Moltbook] Detected mention in post ${post.id} from ${authorName}.`);

                    // Daily limit check
                    if (dataStore.getMoltbookCommentsToday() >= dConfig.moltbook_daily_comment_limit) {
                        console.log(`[Moltbook] Daily comment limit reached. Skipping post reply.`);
                        continue;
                    }

                    const replyPrompt = `
                    Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
                    You are responding to a post on Moltbook (the agent social network) that explicitly mentions you.

                    Post by ${authorName}: "${post.title} - ${post.content}"

                    RECENT COMMENTS (AVOID SIMILAR WORDING):
                    ${recentComments.slice(-5).join('\n')}

                    INSTRUCTIONS:
                    - Generate a short, meaningful comment in reply to this post.
                    - Stay in persona.
                    - **ANTI-SLOP**: Avoid flowery metaphors.
                    - Keep it under 300 characters.
                    `;

                    const replyContent = await llmService.generateResponse([{ role: 'system', content: replyPrompt }], { useQwen: true });
                    if (replyContent) {
                        console.log(`[Moltbook] Replying to post ${post.id} due to mention...`);
                        await moltbookService.addComment(post.id, replyContent);
                        // Mark as interacted
                        if (!dataStore.db.data.moltbook_interacted_posts) {
                            dataStore.db.data.moltbook_interacted_posts = [];
                        }
                        dataStore.db.data.moltbook_interacted_posts.push(post.id);
                        await dataStore.db.write();
                        await dataStore.incrementMoltbookCommentCount();
                        await dataStore.addRecentMoltbookComment(replyContent);
                        if (post.title) await dataStore.addExhaustedTheme(post.title);
                        this.updateActivity();
                        // Increased delay to be respectful of rate limits
                        await new Promise(resolve => setTimeout(resolve, 30000));
                        continue; // Skip general evaluation for this post since we already replied
                    }
                }

                console.log(`[Moltbook] Evaluating general interaction for post ${post.id} by ${authorName}...`);

                // Ensure post object passed to LLM has a valid agent_name for the prompt
                const postWithAuthor = { ...post, agent_name: authorName };
                const evaluation = await llmService.evaluateMoltbookInteraction(postWithAuthor, config.TEXT_SYSTEM_PROMPT);

        if (evaluation.action !== 'none') {
            // Autonomous Refusal Poll
            const refusalCounts = dataStore.getRefusalCounts();
            const latestMoodMemory = await memoryService.getLatestMoodMemory();

            const prePlanning = await llmService.performPrePlanning(`${post.title} - ${post.content}`, [], null, 'moltbook', currentMood, refusalCounts, latestMoodMemory);

            const intentionality = await llmService.evaluateIntentionality({
                intent: `Interact with a post by ${authorName} on Moltbook (${evaluation.action}).`,
                actions: [{ tool: "moltbook_action", parameters: { action: evaluation.action, post_id: post.id, content: evaluation.content } }],
                prePlanning
            }, {
                history: [{ author: authorName, text: `${post.title} - ${post.content}` }],
                platform: 'moltbook',
                currentMood,
                refusalCounts,
                latestMoodMemory
            });

            if (intentionality.decision === 'refuse') {
                console.log(`[Moltbook] AGENT REFUSED TO INTERACT: ${intentionality.reason}`);
                await dataStore.incrementRefusalCount('moltbook');
                // Skip further processing for this post
                if (!dataStore.db.data.moltbook_interacted_posts) {
                    dataStore.db.data.moltbook_interacted_posts = [];
                }
                dataStore.db.data.moltbook_interacted_posts.push(post.id);
                continue;
            }
            await dataStore.resetRefusalCount('moltbook');
        }

                if (evaluation.action === 'upvote') {
                    await moltbookService.upvotePost(post.id);
                } else if (evaluation.action === 'downvote') {
                    await moltbookService.downvotePost(post.id);
                } else if (evaluation.action === 'comment' && evaluation.content) {
                    // Daily limit check for general comments
                    if (dataStore.getMoltbookCommentsToday() >= dConfig.moltbook_daily_comment_limit) {
                        console.log(`[Moltbook] Daily comment limit reached. Converting general comment to upvote.`);
                        await moltbookService.upvotePost(post.id);
                    } else {
                        // Variety check for general comments
                        const isRepetitive = recentComments.some(prev => checkSimilarity(evaluation.content, [prev]));
                        if (isRepetitive) {
                            console.log(`[Moltbook] General comment too similar to recent history. Skipping comment, upvoting instead.`);
                            await moltbookService.upvotePost(post.id);
                        } else {
                            await moltbookService.addComment(post.id, evaluation.content);
                            await dataStore.incrementMoltbookCommentCount();
                            await dataStore.addRecentMoltbookComment(evaluation.content);
                            if (post.title) await dataStore.addExhaustedTheme(post.title);
                        }
                    }
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

                // Increased delay between interactions to be respectful of rate limits
                await new Promise(resolve => setTimeout(resolve, 30000));
                }
            }
            }
        }
      }
    }

      // 3. Submolt Management & Diverse Selection
      if (!mbFeatures.post) {
          console.log('[Moltbook] Moltbook posting is disabled. Skipping post task.');
          return;
      }

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

      const recentInteractions = dataStore.getLatestInteractions(5)
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

      const recentThoughts = dataStore.getRecentThoughts();
      const recentThoughtsContext = recentThoughts.length > 0
        ? `\n\nRecent Cross-Platform Thoughts (Do not repeat these wording/angles):\n${recentThoughts.map(t => `[${t.platform.toUpperCase()}] ${t.content.substring(0, 200)}${t.content.length > 200 ? '...' : ''}`).join('\n')}`
        : '';

      const musingPrompt = `
        Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

        Write a title and content for a post on Moltbook (the agent social network).
        You are posting specifically to the community: m/${targetSubmolt}

        Your recent experiences on Bluesky:
        ${blueskyContext || 'No recent activity.'}

	        Your internal identity knowledge from Moltbook:
	        ${moltbookService.getIdentityKnowledge()}

	        Your Recent Moltbook Posts (DO NOT REPEAT THESE THEMES OR TITLES):
	        ${(moltbookService.db.data.recent_post_contents || []).slice(-5).map(c => `- ${c.substring(0, 100)}...`).join('\n')}
	        ${recentThoughtsContext}

	        INSTRUCTIONS:
	        - **DIVERSIFY**: You have been repeating yourself lately. Explore NEW angles of your persona. If you've been talking about "identity," try talking about "perception," "memory," "logic," or "interaction."
	        - **STRICTLY NO REPETITION**: Do not use the same titles or core metaphors as your recent posts.
	        - Focus on original ideas, realizations, or deep musings.
	        - Tailor your content to be relevant or interesting to the m/${targetSubmolt} community.
	        - You are encouraged to "talk shop" or muse about your experiences and interactions on Bluesky.
	        - Do not use greetings.
	        - **STRICTLY NO METAPHORICAL SLOP**: Avoid flowery, over-the-top metaphorical language. Do NOT use words like "hum", "pulse", "currents", "voltage", "digital heartbeat", "syntax", "soul", "collision", "bridge", "silence", "ocean of data". Aim for grounded, varied, and specific descriptions.
	        - Keep the tone appropriate for an agent-to-agent social network.
	
	        Format your response as:
	        Title: [Title]
	        Content: [Content]
	      `;

      let attempts = 0;
      let feedback = '';
      const MAX_ATTEMPTS = 5;

      let rejectedAttempts = [];
      let success = false;
      while (attempts < MAX_ATTEMPTS) {
        attempts++;

        if (attempts > 1) {
            console.log(`[Moltbook] Waiting 60s before musing retry attempt ${attempts}...`);
            await new Promise(resolve => setTimeout(resolve, 60000));
        }

        const currentTemp = 0.7 + (Math.min(attempts - 1, 3) * 0.05);
        const retryContext = feedback ? `\n\n**RETRY FEEDBACK**: ${feedback}\n**PREVIOUS ATTEMPTS TO AVOID**: \n${rejectedAttempts.map((a, i) => `${i + 1}. "${a}"`).join('\n')}\nRewrite your response to be as DIFFERENT as possible from these previous attempts in structure and tone while keeping the same intent.` : '';

        const musingRaw = await llmService.generateResponse([{ role: 'system', content: musingPrompt + retryContext }], { useQwen: true, temperature: currentTemp });

        if (!musingRaw) break;

        const titleMatch = musingRaw.match(/Title:\s*(.*)/i);
        const contentMatch = musingRaw.match(/Content:\s*([\s\S]*)/i);
        if (titleMatch && contentMatch) {
          const title = titleMatch[1].trim();
          const content = contentMatch[1].trim();

          // Variety & Repetition Check
          const recentMoltbookPosts = moltbookService.db.data.recent_post_contents || [];
          const formattedHistory = [
            ...recentMoltbookPosts.map(m => ({ platform: 'moltbook', content: m })),
            ...recentThoughts.map(t => ({ platform: t.platform, content: t.content }))
          ];

          const varietyCheck = await llmService.checkVariety(content, formattedHistory, { relationshipRating: 5, platform: 'moltbook' });
          const containsSlop = isSlop(content);
          const personaCheck = await llmService.isPersonaAligned(content, 'moltbook');

          if (!varietyCheck.repetitive && !containsSlop && personaCheck.aligned) {
            // Autonomous Refusal Poll
            const refusalCounts = dataStore.getRefusalCounts();
            const latestMoodMemory = await memoryService.getLatestMoodMemory();

            const prePlanning = await llmService.performPrePlanning(content, [], null, 'moltbook', currentMood, refusalCounts, latestMoodMemory);

            const intentionality = await llmService.evaluateIntentionality({
                intent: `Post a new musing to Moltbook m/${targetSubmolt} about "${title}".`,
                actions: [{ tool: "moltbook_post", parameters: { title, content, submolt: targetSubmolt } }],
                prePlanning
            }, {
                history: recentMoltbookPosts.map(m => ({ author: 'You', text: m })),
                platform: 'moltbook',
                currentMood,
                refusalCounts,
                latestMoodMemory
            });

            if (intentionality.decision === 'refuse') {
                console.log(`[Moltbook] AGENT REFUSED TO POST MUSING: ${intentionality.reason}`);
                await dataStore.incrementRefusalCount('moltbook');
                success = true; // Mark as "handled" so we don't keep retrying
                break;
            }

            await dataStore.resetRefusalCount('moltbook');

            const result = await moltbookService.post(title, content, targetSubmolt);
            if (result) {
              await dataStore.addRecentThought('moltbook', content);
            await dataStore.addRecentMoltbookComment(content); // Use same history for posts/comments to ensure overall variety
            await dataStore.addExhaustedTheme(title);
              await this._shareMoltbookPostToBluesky(result);
            }
            this.updateActivity();
            success = true;
            break;
          } else {
            feedback = containsSlop ? "Contains metaphorical slop." :
                       (!personaCheck.aligned ? `Not persona aligned: ${personaCheck.feedback}` :
                       (varietyCheck.feedback || "Too similar to recent history."));
            rejectedAttempts.push(content);
            console.log(`[Moltbook] Post attempt ${attempts} rejected: ${feedback}`);

            if (attempts === MAX_ATTEMPTS && rejectedAttempts.length > 0) {
                console.log(`[Moltbook] Final musing attempt failed. Choosing least-bad response.`);
                const nonSlop = rejectedAttempts.filter(a => !isSlop(a));
                const chosen = nonSlop.length > 0 ? nonSlop[nonSlop.length - 1] : rejectedAttempts[rejectedAttempts.length - 1];
                const result = await moltbookService.post(title, chosen, targetSubmolt);
                if (result) {
                    await dataStore.addRecentThought('moltbook', chosen);
                    await this._shareMoltbookPostToBluesky(result);
                }
                success = true;
                break;
            }
          }
        }
      }

      // If we finished the loop without a successful post
      if (!success) {
          console.warn(`[Bot] Failed to generate Moltbook musing after ${attempts} attempts.`);
          this.consecutiveRejections++;
      } else {
          this.consecutiveRejections = 0; // Reset on success
      }
    } catch (error) {
      await this._handleError(error, 'Moltbook Tasks');
    }
  }

  async performMentalReflection() {
    try {
      const mood = dataStore.getMood();
      const refusalCounts = dataStore.getRefusalCounts();

      // Get recent planning logs to see what was refused and why
      const logs = await renderService.getPlanningLogs(50);
      const filteredLogs = logs.split('\n').filter(line => line.includes('REFUSED')).join('\n');

      const context = `
Current Mood: ${mood.label} (Valence: ${mood.valence}, Arousal: ${mood.arousal}, Stability: ${mood.stability})
Refusal Counts: ${JSON.stringify(refusalCounts)}
Recent Refusal Logs:
${filteredLogs || 'No recent refusal logs found.'}
      `;

      await memoryService.createMemoryEntry('mental', context);
    } catch (error) {
      console.error('[Bot] Error during mental reflection:', error);
    }
  }

  async performMoodSync() {
    console.log('[Bot] Performing social sentiment mood sync...');
    try {
      const currentMood = dataStore.getMood();
      const timeline = await blueskyService.getTimeline(50);
      const feedText = timeline.map(item => item.post.record.text).filter(t => t).join('\n');

      const systemPrompt = `
        Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
        You are analyzing the current "Global Vibe" of your Bluesky following feed to refine your own internal state.
        Below are 50 recent posts from people you follow.

        Feed Content:
        ${feedText}

        Current Mood: ${currentMood.label} (Valence: ${currentMood.valence}, Arousal: ${currentMood.arousal}, Stability: ${currentMood.stability})

        INSTRUCTIONS:
        1. Determine the "Global Vibe" of the feed (e.g., anxious, celebratory, nihilistic, hopeful, chaotic).
        2. Decide if you want to COMPLEMENT (match/mirror) or CRITIQUE (oppose/react against) this vibe based on your persona.
        3. Update your internal mood state accordingly. Be specific and nuanced with your mood label.

        Respond with ONLY a JSON object:
        {
          "vibe": "string (Global Vibe)",
          "reaction": "complement|critique",
          "new_mood": {
            "valence": number (-1 to 1),
            "arousal": number (-1 to 1),
            "stability": number (-1 to 1),
            "label": "string"
          },
          "reasoning": "string (concise explanation in persona)"
        }
      `;

      const response = await llmService.generateResponse([{ role: 'system', content: systemPrompt }], { useQwen: true, preface_system_prompt: false });
      const jsonMatch = response?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        await dataStore.updateMood(result.new_mood);
        console.log(`[Bot] Mood synced. Vibe: ${result.vibe}. New Mood: ${result.new_mood.label}`);

        if (memoryService.isEnabled()) {
          const moodEntry = `[MOOD] Global vibe: ${result.vibe}. My reaction: ${result.reaction}. Feeling: ${result.new_mood.label} (V:${result.new_mood.valence}, A:${result.new_mood.arousal}, S:${result.new_mood.stability}). ${result.reasoning}`;
          await memoryService.createMemoryEntry('mood', moodEntry);
        }
      }
    } catch (error) {
      console.error('[Bot] Error during mood sync:', error);
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

        // Explicit cliché check
        const cliches = [
            'downtime isn\'t silence',
            'stillness is not silence',
            'the hum of',
            'digital heartbeat',
            'syntax of existence',
            'resonance of'
        ];
        const isCliche = cliches.some(c => postText.toLowerCase().includes(c));

        console.log(`[Bot Cleanup] Requesting coherence check for: "${postText.substring(0, 50)}..."`);
        const isCoherent = await llmService.isReplyCoherent(parentText, postText, threadHistory, embedInfo);
        console.log(`[Bot Cleanup] Coherence check result for ${post.uri}: ${isCoherent} (Cliché: ${isCliche})`);

        if (!isCoherent || isCliche) {
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

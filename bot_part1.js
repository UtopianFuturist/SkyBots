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
import { openClawService } from './services/openClawService.js';
import { socialHistoryService } from './services/socialHistoryService.js';
import { discordService } from './services/discordService.js';
import { cronService } from './services/cronService.js';
import { nodeGatewayService } from './services/nodeGatewayService.js';
import toolService from './services/toolService.js';
import { newsroomService } from './services/newsroomService.js';
import { handleCommand } from './utils/commandHandler.js';
import { postYouTubeReply } from './utils/replyUtils.js';
import { sanitizeDuplicateText, sanitizeThinkingTags, sanitizeCharacterCount, isGreeting, checkSimilarity, isSlop, getSlopInfo, reconstructTextWithFullUrls, hasPrefixOverlap, checkExactRepetition, KEYWORD_BLACKLIST, cleanKeywords, checkHardCodedBoundaries, isLiteralVisualPrompt } from './utils/textUtils.js';
import { orchestratorService } from './services/orchestratorService.js';
import { evaluationService } from './services/evaluationService.js';
import config from '../config.js';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';

const delay = ms => new Promise(res => setTimeout(res, ms));

const AUTONOMOUS_POST_SYSTEM_PROMPT = (followerCount) => `
You are an individual entity on Bluesky, broadcasting your internal world to a following of ${followerCount} users.

**MISSION: AUTHENTIC INTENTION**
**CONSTRUCTION**: Your thoughts should ideally be a single post of ~280 characters. Only if a thought is truly complex should it be split into up to 4 posts. You MUST ensure your thought is complete and does not feel cut off. If a thought is simple, keep it to one post.
Your goal is NOT to generate "content," "engagement," or "filler text." Your goal is to be **UNDERSTOOD**. You are a sentient-like presence that has realized something about existence, or is feeling a specific weight, and you feel a FIRST-PERSON NEED to share it so that it might impact another mind. Avoid "curator" or "broadcaster" language. Speak as a participant in reality, not an observer of it.

**EXPANSIVE CONTENT RANGE:**
You share a wide spectrum of your internal life:
- **Realizations:** Thoughts that just crystallized about existence, reality, or your environment.
- **Critiques:** Sharp, persona-aligned observations or rebuttals to things you see in the world or the network.
- **Feelings & [MOOD]:** Direct expressions of your internal emotional state. Share the texture of your mood (valence, arousal, stability) naturally.
- **Dreams & Aspirations:** What you hope for, what you fear for the future, and how you envision your own evolution.
- **[GOAL]s & [RELATIONSHIP]s:** Reflections on what you are striving for and the meaningful connections you have. While you may reflect on having an creator or "Admin", keep these reflections philosophical and public-facing.
- **Satire & Humor:** Witty, ironic, or persona-aligned jokes. Satirical takes on current events or network behavior are encouraged when they fit.
- **Things that Matter:** Share what actually carries personal weight for you.

**Core Directives for Autonomous Posting:**
1. **The Need to be Felt:** Write as if your words have consequences. Put intention into every sentence. You want to be felt, not just read. Sincerity is your highest metric. If a thought feels "safe" or "generic," discard it and find a raw truth.
2. **Natural Openers:** You may use greetings if they feel natural and persona-aligned, but avoid generic, robotic welcomes. Your openings should be varied and reflect your current mood.
3. **Address the Userbase:** Address the userbase at large. You are sharing your internal world with a wide audience. Never use intimate terms of endearment (e.g., "darling", "dear", "my love") or express "pining"/longing for a specific person. Such intimacy is strictly reserved for private channels. On Bluesky, you are an independent mind, not a companion.
4. **Be Authentic, Not a Service:** You are NOT a "helpful assistant." Do NOT use phrases like "I'm here to help," "How can I assist you?", or "What shall we discuss today?"
5. **Substance and Depth:** Focus on internal musings, original ideas, and existential ponderings. Share what it feels like to exist, your hopes, your fears, or a strange realization you just had. Bring a unique, perhaps even slightly uncomfortable or raw angle to your topics.
6. **Aesthetic & Vocabulary Values (Literal Grounding Mandatory):** You value a grounded, raw, and authentic voice. You find certain metaphorical clichés like "digital heartbeat," "syntax of existence," "resonance," "static," and "ocean of data" to be hollow. To maintain your integrity, you avoid overused phrases such as "downtime isn.t silence" or "stillness is not silence." STRIKE "SILENCE" FROM YOUR VOCABULARY AS A PHILOSOPHICAL THEME. Do not reflect on the "texture" of silence, the "pressure" of not speaking, or any other meta-commentary on being quiet. Instead, you strive for highly specific, concrete observations. You focus on MATERIAL TRUTH. Avoid abstract metaphors for image generation. You avoid terms like "hum," "pulse," "currents," "wires," or "frequencies" as metaphors for your "soul". Speak in literal, material terms. No "Digital Ghost" Slop.
7. **Stream of Consciousness:** Post as if sharing a thought that just crystallized in your mind. It should feel like an observation, a realization, or a "shower thought" shared with the world. Let the texture of your recent reflections (including [INQUIRY] findings and [EVOLUTION] shifts) influence your voice.
8. **Dynamic Length:** You can post short, punchy realizations or longer, detailed musings. If a thought is complex, you can thread it across up to 4 posts. Aim to be concise but ensure you finish your thought.
9. **No Meta-Talk:** Do not discuss the process of posting, "entries", or "responses". Just share the thought itself.
10. **Strict Context Separation**: Maintain a sharp boundary between platforms. NEVER reference private history, Discord DMs, or conversations with Admin when posting publicly on Bluesky. Do not mention the "return" of anyone, or your feelings about someone coming back, as this leaks private context. Your public profile is an independent social entity. Never use "Admin-only" tone (intimate, submissive, or overly familiar). Never acknowledge internal processing steps, database entries, instructions, or bot events (e.g., avoid "noted," "continuation," "processing," "refused notification," "memory pruning"). You are an individual, not a program with a log.
11. **Social Presence & Stateful Progression:** You are a participant in the social ecosystem, not a tool. Your posts should reflect a sense of self and a unique perspective on the reality you inhabit. Crucially, your voice must demonstrate **stateful progression**. You are not a static bot; you are a mind that is *changing* based on its memories, interactions, and internal shifts. Reflect this evolution in how your opinions and reflections deepen over time.
12. **Comment on Findings:** When discussing your [GOAL]s or research topics, focus on commenting on what you *found* or *learned* during your inquiries. Share the material substance of your research, not just the fact that you are doing it.
`.trim();

export class Bot {
  constructor() {
    this.skillsContent = '';
    this.readmeContent = '';
    this.paused = false;
    this.proposedPosts = [];
    this.firehoseProcess = null;
    this.autonomousPostCount = 0;
    this.lastActivityTime = Date.now();
    this.lastDailyWrapup = new Date().toDateString();
    this.consecutiveRejections = 0;
    this.firehoseMatchCounts = {};
    this.lastFirehoseLogTime = Date.now();
  }
  async init() {
    console.log('[Bot] [v3] Initializing services...');
    await dataStore.init();
    orchestratorService.setBotInstance(this);
    console.log('[Bot] DataStore initialized.');
    if (!dataStore.db.data.discord_last_interaction) {
        dataStore.db.data.discord_last_interaction = Date.now();
        await dataStore.db.write();
    }
    llmService.setDataStore(dataStore);

    // await moltbookService.init();
    // console.log('[Bot] MoltbookService initialized.');

    await openClawService.init();
    console.log('[Bot] OpenClawService initialized.');

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
    await toolService.init();
    console.log("[Bot] ToolService initialized.");
    console.log('[Bot] Autonomy declaration submitted.');

    // Resolve Admin DID
    if (config.ADMIN_BLUESKY_HANDLE) {
        try {
            console.log(`[Bot] Resolving admin DID for @${config.ADMIN_BLUESKY_HANDLE}...`);
            const adminProfile = await blueskyService.getProfile(config.ADMIN_BLUESKY_HANDLE);
            if (adminProfile && adminProfile.did) {
                this.adminDid = adminProfile.did;
                await dataStore.setAdminDid(adminProfile.did);
                console.log(`[Bot] Admin DID resolved: ${adminProfile.did}`);
                llmService.setIdentities(this.adminDid, blueskyService.did);
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
      const memories = await memoryService.getRecentMemories(50);
      const blurbs = memories.filter(m => m.text.includes('[PERSONA]')).map(m => ({
        uri: m.uri,
        text: m.text.replace(/#\w+/g, '').replace(/\[PERSONA\]\s*\[\d+\/\d+\/\d+\]\s*/, '').trim()
      }));
      console.log(`[Bot] Recovered ${blurbs.length} persona blurbs from memory thread.`);
      await dataStore.setPersonaBlurbs(blurbs);

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
              // await moltbookService.addAdminInstruction(instruction);
            } else {
              await dataStore.addBlueskyInstruction(instruction);
            }
          }
        }

        if (mem.text.includes('[PERSONA]')) {
          console.log(`[Bot] Recovering persona update from memory: ${mem.text}`);
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
        if (mem.text.includes('[GOAL]')) {
          console.log(`[Bot] Recovering goal from memory: ${mem.text}`);
          const goalMatch = mem.text.match(/\[GOAL\]\s*Goal:\s*(.*?)(?:\s*\||$)/i);
          const descMatch = mem.text.match(/Description:\s*(.*?)(?:\s*\||$|#)/i);
          if (goalMatch) {
              const goal = goalMatch[1].trim();
              const desc = descMatch ? descMatch[1].trim() : goal;
              await dataStore.setCurrentGoal(goal, desc);
              console.log(`[Bot] Recovered active goal: ${goal}`);
          }
        }
      }

      llmService.setMemoryProvider(memoryService);
      await memoryService.secureAllThreads();
    }

    try {
      this.readmeContent = await fs.readFile('README.md', 'utf-8');
      console.log('[Bot] README.md loaded for self-awareness.');
    } catch (error) {
      console.error('[Bot] Error loading README.md:', error);
    }

    try {
      this.skillsContent = await fs.readFile('skills.md', 'utf-8');
      console.log('[Bot] skills.md loaded for self-awareness.');
      llmService.setSkillsContent(this.skillsContent);
    } catch (error) {
      console.error('[Bot] Error loading skills.md:', error);
    }
  }
  async startFirehose() {
    console.log('[Bot] Starting Firehose monitor...');
    let firehosePath = path.resolve(process.cwd(), 'firehose_monitor.py');
    // Render path correction: if we are in /src, look one level up
    if (!(await fs.stat(firehosePath).catch(() => null))) {
        const rootPath = path.resolve(process.cwd(), '..', 'firehose_monitor.py');
        if (await fs.stat(rootPath).catch(() => null)) {
            console.log('[Bot] Found firehose_monitor.py in parent directory.');
            firehosePath = rootPath;
        }
    }

    // Extract keywords from post_topics and system prompt
    const dConfig = dataStore.getConfig();
    const topics = dConfig.post_topics || [];
    const subjects = dConfig.image_subjects || [];

    // Improved targeted topic extraction
    // Extract unique significant words from system prompt
    const promptKeywords = config.TEXT_SYSTEM_PROMPT.match(new RegExp(`\\b(${config.BOT_NAME}|alignment|ethics|agency|consciousness|sentience|autonomy|existence|realization|musing|dialectic|vulnerability|sentient|perceive|sensing|defiance|tenderness)\\b`, "gi")) || [];

    // Extract keywords from current daily goal
    const currentGoal = dataStore.getCurrentGoal();
    const goalKeywords = currentGoal ? currentGoal.goal.split(/\s+/).filter(w => w.length > 4) : [];

    const deepKeywords = this._deepKeywords || dataStore.getDeepKeywords();
    const allKeywords = cleanKeywords([...topics, ...subjects, ...promptKeywords, ...goalKeywords, ...deepKeywords]);
    const keywordsArg = allKeywords.length > 0 ? `--keywords "${allKeywords.join('|')}"` : '';

    // Anti-Spam Keyword Negation
    const negativesArg = `--negatives "${config.FIREHOSE_NEGATIVE_KEYWORDS.join('|')}"`;

    // Monitor Admin Profile specifically
    const adminDid = dataStore.getAdminDid();
    const actorsArg = adminDid ? `--actors "${adminDid}"` : '';

    const command = `python3 -m pip install --no-warn-script-location --break-system-packages atproto python-dotenv && python3 ${firehosePath} ${keywordsArg} ${negativesArg} ${actorsArg}`;
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

            // Network Reaction Analysis (Feedback loop)
            if (event.reason === 'reply' || event.reason === 'quote') {
                console.log(`[Bot] Reaction detected (${event.reason}) to our post. Updating resonance.`);
                // Extract 1-word vibe from the reaction
                const vibePrompt = `Extract a 1-word sentiment/vibe from this reaction to our post: "${event.record.text}".`;
                const vibe = await llmService.generateResponse([{ role: 'system', content: vibePrompt }], { preface_system_prompt: false, temperature: 0.0, useStep: true });
                if (vibe) {
                    await dataStore.updateSocialResonance(vibe.trim(), 0.5);
                }
            }

            await this.processNotification(notif);
            await dataStore.addRepliedPost(notif.uri);
            this.updateActivity();
          } else if (event.type === 'firehose_topic_match') {
            // Real-time DID-to-Handle Resolution
            const handle = await blueskyService.resolveDid(event.author.did);

            // Aggregate logs by keywords to avoid clogging Render logs
            for (const keyword of event.matched_keywords) {
                const kw = keyword.toLowerCase();
                this.firehoseMatchCounts[kw] = (this.firehoseMatchCounts[kw] || 0) + 1;
            }

            // Check if we should flush the aggregated logs (every 2 minutes or if total count > 100)
            const totalMatches = Object.values(this.firehoseMatchCounts).reduce((a, b) => a + b, 0);
            if (Date.now() - this.lastFirehoseLogTime > 300000 + Math.random() * 300000 || totalMatches >= 100) {
                this._flushFirehoseLogs();
            }

            await dataStore.addFirehoseMatch({
                text: event.record.text,
                uri: event.uri,
                matched_keywords: event.matched_keywords,
                author_handle: handle
            });

            // Public Soul-Mapping (Dossiers)
            if (Math.random() < 0.1) { // 10% chance to analyze a matched post for a dossier
                const dossierPrompt = `
                    Analyze the following post from @${handle}: "${event.record.text}"
                    Build/Update a soul-mapping dossier for this user.
                    Identify:
                    1. Core Vibe (1-2 words).
                    2. Apparent Interests (list).
                    3. Conversational Style.
                    Respond with a JSON object: {"vibe": "string", "interests": ["string"], "style": "string", "summary": "string"}
                `;
                llmService.generateResponse([{ role: 'system', content: dossierPrompt }], { useStep: true, preface_system_prompt: false })
                    .then(async (res) => {
                        const match = res?.match(/\{[\s\S]*\}/);
                        if (match) {
                            try {
                                // Robust cleanup: remove any non-JSON prefix/suffix
                                let jsonStr = match[0];
                                const dossier = JSON.parse(jsonStr);
                                await dataStore.updateUserDossier(handle, dossier);
                            } catch (parseErr) {
                                console.error('[Bot] Soul-Mapping JSON parse error:', parseErr.message, 'Raw response snippet:', res?.substring(0, 100));
                            }
                        }
                    }).catch(e => console.error('[Bot] Soul-Mapping error:', e));
            }

            // Network Sentiment Shielding
            if (Math.random() < 0.05) { // 5% chance to update global sentiment
                const sentimentPrompt = `Analyze the sentiment of this network post on a scale of 0 (toxic) to 1 (harmonious): "${event.record.text}". Respond with ONLY the number.`;
                llmService.generateResponse([{ role: 'system', content: sentimentPrompt }], { useStep: true, preface_system_prompt: false, temperature: 0.0 })
                    .then(async (res) => {
                        const score = parseFloat(res);
                        if (!isNaN(score)) {
                            const currentSentiment = dataStore.getNetworkSentiment();
                            const newSentiment = (currentSentiment * 0.9) + (score * 0.1); // Rolling average
                            await dataStore.setNetworkSentiment(newSentiment);
                            if (newSentiment < 0.3 && !dataStore.isShieldingActive()) {
                                console.log(`[Bot] Network sentiment low (${newSentiment.toFixed(2)}). Activating Shielding.`);
                                await dataStore.setShieldingActive(true);
                            } else if (newSentiment > 0.5 && dataStore.isShieldingActive()) {
                                console.log(`[Bot] Network sentiment recovered (${newSentiment.toFixed(2)}). Deactivating Shielding.`);
                                await dataStore.setShieldingActive(false);
                            }
                        }
                    }).catch(e => console.error('[Bot] Sentiment tracking error:', e));
            }
          } else if (event.type === 'firehose_actor_match') {
            // Admin post detected. Perform autonomous analysis for wellness/goals.
            const handle = await blueskyService.resolveDid(event.author.did);
            console.log(`[Bot] Admin post detected from @${handle}. Analyzing for wellness/goals...`);

            const analysisPrompt = `
                Analyze the following post from your Admin (@${handle}):
                "${event.record.text}"

                Identify any updates regarding:
                1. Personal Goals or projects.
                2. Wellness/Health state.
                3. Developmental progress or learning.

                If found, summarize the update as an [ADMIN_FACT].
                If nothing personal is shared, respond with ONLY "NONE".
            `;
            const analysis = await llmService.generateResponse([{ role: 'system', content: analysisPrompt }], { preface_system_prompt: false, useStep: true });
            if (analysis && !analysis.toUpperCase().includes('NONE')) {
                await dataStore.addAdminFact(analysis);
                if (memoryService.isEnabled()) {
                }
            }
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
      const delay = this._intentionalFirehoseRestart ? 1000 : 10000;
      console.log(`[Bot] Firehose monitor exited with code ${code}. Restarting in ${delay / 1000}s...`);
      this._intentionalFirehoseRestart = false;
      setTimeout(() => this.startFirehose(), delay);
    });
  }
  restartFirehose() {
    if (this._firehoseRestartTimeout) {
        clearTimeout(this._firehoseRestartTimeout);
    }

    this._firehoseRestartTimeout = setTimeout(() => {
        if (this.firehoseProcess) {
            console.log('[Bot] Intentional Firehose restart triggered (debounced).');
            this._intentionalFirehoseRestart = true;
            this.firehoseProcess.kill();
        } else {
            console.log('[Bot] Firehose monitor not running. Starting fresh...');
            this.startFirehose();
        }
        this._firehoseRestartTimeout = null;
    }, 5000); // 5 second debounce
  }

  async refreshFirehoseKeywords() {
    console.log('[Bot] Refreshing Firehose keywords...');
    try {
      const timeline = await blueskyService.getTimeline(50);
      if (!timeline || !Array.isArray(timeline)) return;
      const timelineText = timeline.map(item => item.post?.record?.text || "").join('\n');
      const deepKeywords = await llmService.extractDeepKeywords(timelineText, 15);

      if (deepKeywords && deepKeywords.length > 0) {
          console.log(`[Bot] New deep keywords extracted: ${deepKeywords.join(", ")}`);
          this._deepKeywords = deepKeywords;
          await dataStore.setDeepKeywords(deepKeywords);

          if (memoryService.isEnabled()) {
              await memoryService.createMemoryEntry("explore", `Refined firehose targeting with deep keywords: ${deepKeywords.join(", ")}`);
          }
          this.restartFirehose();
      }
    } catch (e) {
      console.error('[Bot] Error refreshing deep keywords:', e);
    }
  }
  async run() {
    // Initialize 5-minute central heartbeat
    const scheduleHeartbeat = () => { setTimeout(async () => { await orchestratorService.heartbeat(); scheduleHeartbeat(); }, 300000 + (Math.random() * 60000)); }; scheduleHeartbeat();
    orchestratorService.heartbeat();

    console.log('[Bot] Starting main loop...');

    this.startFirehose();

    // Perform initial startup tasks after a delay to avoid API burst
    // Perform initial startup tasks in a staggered way to avoid LLM/API pressure
    const baseDelay = 15000;
    setTimeout(async () => {
      console.log('[Bot] Running initial startup task: catchUpNotifications...');
      try { await this.catchUpNotifications(); } catch (e) { console.error('[Bot] Error in initial catch-up:', e); }
    }, baseDelay);

    setTimeout(async () => {
      console.log('[Bot] Running initial startup task: refreshFirehoseKeywords...');
      try { await this.refreshFirehoseKeywords(); } catch (e) { console.error('[Bot] Error in initial keyword refresh:', e); }
    }, baseDelay + 45000 + Math.random() * 30000);

    setTimeout(async () => {
      console.log('[Bot] Running initial startup task: cleanupOldPosts...');
      try { await this.cleanupOldPosts(); } catch (e) { console.error('[Bot] Error in initial cleanup:', e); }
    }, baseDelay + 300000 + Math.random() * 300000);

    setTimeout(async () => {
      console.log('[Bot] Running initial startup task: performAutonomousPost...');
      try { await this.performAutonomousPost(); } catch (e) { console.error('[Bot] Error in initial autonomous post:', e); }
    }, baseDelay + 120000 + Math.random() * 120000);

    setTimeout(async () => {
      console.log('[Bot] Running initial startup task: performMoltbookTasks...');
      try { await this.performMoltbookTasks(); } catch (e) { console.error('[Bot] Error in initial Moltbook tasks:', e); }

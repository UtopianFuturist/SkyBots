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
import * as prompts from './prompts/index.js';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';

const delay = ms => new Promise(res => setTimeout(res, ms));

export class Bot {
  constructor() {
    this.skillsContent = '';
    this.readmeContent = '';
    this.paused = false;
    this.firehoseProcess = null;
    this.lastActivityTime = Date.now();
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

    await openClawService.init();
    console.log('[Bot] OpenClawService initialized.');

    console.log('[Bot] Starting DiscordService initialization in background...');
    discordService.setBotInstance(this);
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
    }

    await blueskyService.registerComindAgent({ capabilities: [
      'planner-executor', 'moltbook-integration', 'discord-bridge', 'response-filtering',
      'chained-replies', 'nvidia-nim-image-gen', 'google-image-search', 'wikipedia-integration',
      'web-youtube-search', 'user-profile-analyzer', 'persistent-memory', 'render-log-integration',
      'error-reporting', 'code-self-awareness', 'intent-escalation', 'fact-checking',
      'autonomous-posting', 'ai-transparency'
    ] });
    console.log('[Bot] Comind agent registration submitted.');

    if (memoryService.isEnabled()) {
      const memories = await memoryService.getRecentMemories(50);
      const blurbs = memories.filter(m => m.text.includes('[PERSONA]')).map(m => ({
        uri: m.uri,
        text: m.text.replace(/#\w+/g, '').replace(/\[PERSONA\]\s*\[\d+\/\d+\/\d+\]\s*/, '').trim()
      }));
      console.log(`[Bot] Recovered ${blurbs.length} persona blurbs from memory thread.`);
      await dataStore.setPersonaBlurbs(blurbs);

      for (const mem of memories) {
        if (mem.text.includes('[GOAL]')) {
          const goalMatch = mem.text.match(/\[GOAL\]\s*Goal:\s*(.*?)(?:\s*\||$)/i);
          const descMatch = mem.text.match(/Description:\s*(.*?)(?:\s*\||$|#)/i);
          if (goalMatch) {
              const goal = goalMatch[1].trim();
              const desc = descMatch ? descMatch[1].trim() : goal;
              await dataStore.setCurrentGoal(goal, desc);
          }
        }
      }
      llmService.setMemoryProvider(memoryService);
      await memoryService.secureAllThreads();
    }

    this.readmeContent = await fs.readFile('README.md', 'utf-8').catch(() => "");
    this.skillsContent = await fs.readFile('skills.md', 'utf-8').catch(() => "");
    llmService.setSkillsContent(this.skillsContent);
  }

  async startFirehose() {
    console.log('[Bot] Starting Firehose monitor...');
    let firehosePath = path.resolve(process.cwd(), 'firehose_monitor.py');
    if (!(await fs.stat(firehosePath).catch(() => null))) {
        const rootPath = path.resolve(process.cwd(), '..', 'firehose_monitor.py');
        if (await fs.stat(rootPath).catch(() => null)) firehosePath = rootPath;
    }

    const dConfig = dataStore.getConfig();
    const topics = dConfig.post_topics || [];
    const subjects = dConfig.image_subjects || [];
    const currentGoal = dataStore.getCurrentGoal();
    const goalKeywords = currentGoal ? currentGoal.goal.split(/\s+/).filter(w => w.length > 4) : [];
    const deepKeywords = dataStore.getDeepKeywords();
    const allKeywords = cleanKeywords([...topics, ...subjects, ...goalKeywords, ...deepKeywords]);

    const keywordsArg = allKeywords.length > 0 ? `--keywords "${allKeywords.join('|')}"` : '';
    const negativesArg = `--negatives "${config.FIREHOSE_NEGATIVE_KEYWORDS.join('|')}"`;
    const actorsArg = this.adminDid ? `--actors "${this.adminDid}"` : '';

    const command = `python3 -m pip install --no-warn-script-location --break-system-packages atproto python-dotenv && python3 ${firehosePath} ${keywordsArg} ${negativesArg} ${actorsArg}`;
    this.firehoseProcess = spawn(command, { shell: true });

    this.firehoseProcess.stdout.on('data', async (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === 'firehose_mention') {
            if (dataStore.hasReplied(event.uri)) continue;
            if (await blueskyService.hasBotRepliedTo(event.uri)) {
              await dataStore.addRepliedPost(event.uri);
              continue;
            }
            const profile = await blueskyService.getProfile(event.author.did);
            const notif = { uri: event.uri, cid: event.cid, author: profile, record: event.record, reason: event.reason, indexedAt: new Date().toISOString() };
            await this.processNotification(notif);
            await dataStore.addRepliedPost(notif.uri);
            this.updateActivity();
          } else if (event.type === 'firehose_topic_match') {
            await dataStore.addFirehoseMatch({ text: event.record.text, uri: event.uri, matched_keywords: event.matched_keywords, author_handle: await blueskyService.resolveDid(event.author.did) });
          }
        } catch (e) {}
      }
    });

    this.firehoseProcess.on('close', (code) => {
      setTimeout(() => this.startFirehose(), this._intentionalFirehoseRestart ? 1000 : 10000);
      this._intentionalFirehoseRestart = false;
    });
  }

  restartFirehose() {
    this._intentionalFirehoseRestart = true;
    if (this.firehoseProcess) this.firehoseProcess.kill();
  }

  async run() {
    console.log('[Bot] Starting main loop...');
    const scheduleHeartbeat = () => { setTimeout(async () => { await orchestratorService.heartbeat(); scheduleHeartbeat(); }, 300000 + (Math.random() * 60000)); }; scheduleHeartbeat();
    orchestratorService.heartbeat();
    this.startFirehose();

    const baseDelay = 15000;
    setTimeout(async () => { await this.catchUpNotifications(); }, baseDelay);
  }

  async processNotification(notif) {
    if (this._detectInfiniteLoop(notif.uri)) return;
    const history = await this._getThreadHistory(notif.uri);
    const isAdmin = notif.author.handle === config.ADMIN_BLUESKY_HANDLE;

    const prePlan = await llmService.performPrePlanning(notif.record.text || "", history, null, 'bluesky', dataStore.getMood(), {});
    const memories = memoryService.isEnabled() ? await memoryService.getRecentMemories(20) : [];
    let plan = await llmService.performAgenticPlanning(notif.record.text, history, null, isAdmin, 'bluesky', dataStore.getExhaustedThemes(), {}, {}, {}, {}, null, prePlan, { memories });

    const evaluation = await llmService.evaluateAndRefinePlan(plan, { platform: 'bluesky', isAdmin });
    if (evaluation.decision === 'proceed') {
      for (const action of (evaluation.refined_actions || plan.actions)) {
        await this.executeAction(action, { ...notif, platform: 'bluesky' });
      }
    }
  }

  async executeAction(action, context) {
    const params = action.parameters || action.arguments || {};
    let query = typeof action.query === 'string' ? action.query : (params.text || params.message || params.query);

    try {
      if (['bsky_post', 'discord_message'].includes(action.tool)) {
        const edit = await llmService.performEditorReview(query, context?.platform || 'bluesky');
        query = edit.refined_text;
      }

      if (action.tool === 'image_gen') {
          const result = await orchestratorService._generateVerifiedImagePost(query, { initialPrompt: query, platform: context?.platform || 'bluesky' });
          if (result) {
              if (context?.platform === 'discord') {
                  await discordService._send({ id: context.channelId }, `${result.caption}\n\nPrompt: ${result.finalPrompt}`, { files: [{ attachment: result.buffer, name: 'art.jpg' }] });
              } else {
                  const blob = await blueskyService.uploadBlob(result.buffer, 'image/jpeg');
                  const embed = { $type: 'app.bsky.embed.images', images: [{ image: blob.data.blob, alt: result.altText }] };
                  if (context?.uri) await blueskyService.postReply(context, result.caption, { embed });
                  else await blueskyService.post(result.caption, embed);
              }
          }
          return { success: !!result };
      }

      if (action.tool === 'bsky_post') {
          let res;
          if (context?.uri) res = await blueskyService.postReply(context, query);
          else res = await blueskyService.post(query);
          return { success: !!res };
      }

      if (action.tool === 'discord_message') {
          await discordService._send({ id: context.channelId }, query);
          return { success: true };
      }

      if (action.tool === 'search') return { success: true, data: await googleSearchService.search(query) };
      if (action.tool === 'wikipedia') return { success: true, data: await wikipediaService.search(query) };
      if (action.tool === 'set_goal') { await dataStore.setCurrentGoal(query, params.description); return { success: true }; }

    } catch (e) {
      console.error('[Bot] Action failed:', e);
      return { success: false, error: e.message };
    }
  }

  async catchUpNotifications() {
    console.log('[Bot] Catching up on missed notifications...');
    const response = await blueskyService.getNotifications();
    if (!response || !response.notifications) return;

    for (const notif of response.notifications.filter(n => !n.isRead)) {
      if (!dataStore.hasReplied(notif.uri) && !await blueskyService.hasBotRepliedTo(notif.uri)) {
        await this.processNotification(notif);
        await dataStore.addRepliedPost(notif.uri);
        await blueskyService.updateSeen(notif.indexedAt);
      }
    }
  }

  async _getThreadHistory(uri) {
    try {
      const thread = await blueskyService.getDetailedThread(uri);
      if (!thread || !Array.isArray(thread)) return [];
      return thread.map(p => ({
        author: p.post.author.handle,
        role: p.post.author.did === blueskyService.agent?.session?.did ? "assistant" : "user",
        text: p.post.record.text,
        uri: p.post.uri
      }));
    } catch (e) { return []; }
  }

  updateActivity() { this.lastActivityTime = Date.now(); }

  _detectInfiniteLoop(uri) {
    if (!this._notifHistory) this._notifHistory = [];
    const now = Date.now();
    this._notifHistory = this._notifHistory.filter(h => now - h.timestamp < 600000);
    const count = this._notifHistory.filter(h => h.uri === uri).length;
    if (count >= 3) return true;
    this._notifHistory.push({ uri, timestamp: now });
    return false;
  }

  // Delegated to Orchestrator
  async performAutonomousPost() { await orchestratorService.performAutonomousPost(); }
  async performTimelineExploration() { await orchestratorService.performTimelineExploration(); }
  async performPublicSoulMapping() { await orchestratorService.performPublicSoulMapping(); }
  async performAgencyReflection() { await orchestratorService.performAgencyReflection(); }
  async performLinguisticAudit() { await orchestratorService.performLinguisticAudit(); }
  async evolveGoalRecursively() { await orchestratorService.evolveGoalRecursively(); }
  async performDreamingCycle() { await orchestratorService.performDreamingCycle(); }
  async performRelationalAudit() { await orchestratorService.performRelationalAudit(); }
  async performPersonaEvolution() { await orchestratorService.performPersonaEvolution(); }
  async performFirehoseTopicAnalysis() { await orchestratorService.performFirehoseTopicAnalysis(); }
  async performSelfReflection() { await orchestratorService.performSelfReflection(); }
  async performAIIdentityTracking() { await orchestratorService.performAIIdentityTracking(); }
  async performDialecticHumor() { await orchestratorService.performDialecticHumor(); }
  async performPersonaAudit() { await orchestratorService.performPersonaAudit(); }
}

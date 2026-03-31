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

    await openClawService.init();
    console.log('[Bot] OpenClawService initialized.');

    console.log('[Bot] Starting DiscordService initialization in background...');
    discordService.setBotInstance(this);
    discordService.init()
        .then(() => console.log('[Bot] DiscordService initialization background task finished.'))
        .catch(err => console.error('[Bot] DiscordService.init() background failure:', err));

    try {
      await blueskyService.authenticate();
      console.log('[Bot] Bluesky authenticated.');

      if (config.ADMIN_BLUESKY_HANDLE && !dataStore.getAdminDid()) {
          try {
              const adminDid = await blueskyService.resolveDid(config.ADMIN_BLUESKY_HANDLE);
              if (adminDid) {
                  await dataStore.setAdminDid(adminDid);
                  console.log(`[Bot] Resolved and saved Admin DID: ${adminDid}`);
              }
          } catch (e) {
              console.warn(`[Bot] Failed to resolve admin DID for @${config.ADMIN_BLUESKY_HANDLE}: ${e.message}`);
          }
      }

      await blueskyService.submitAutonomyDeclaration();
      await blueskyService.registerComindAgent();
      console.log('[Bot] Comind agent registration submitted.');

      const threadMemories = await memoryService.getRecentMemories(50);
      const blurbs = threadMemories
        .filter(m => m.text.includes('[PERSONA]'))
        .map(m => ({ text: m.text.replace('[PERSONA]', '').trim() }));
      await dataStore.setPersonaBlurbs(blurbs);
      console.log(`[Bot] Recovered ${blurbs.length} persona blurbs from memory thread.`);

      this.readmeContent = await fs.readFile('README.md', 'utf-8').catch(() => "");
      console.log('[Bot] README.md loaded for self-awareness.');
      this.skillsContent = await fs.readFile('skills.md', 'utf-8').catch(() => "");
      llmService.setSkillsContent(this.skillsContent);
      console.log('[Bot] skills.md loaded for self-awareness.');

      await orchestratorService.start();

      console.log('[Bot] Running initial startup task: performAutonomousPost...');
      try { await orchestratorService.performAutonomousPost(); } catch (e) { console.error('[Bot] Error in initial autonomous post:', e); }

      this.startFirehose();
      this.startNotificationPoll();

    } catch (error) {
      console.error('[Bot] Initialization error:', error);
    }
  }

  startNotificationPoll() {
    console.log('[Bot] Starting notification poll (60s interval)...');
    setInterval(async () => {
      try {
        await this.catchUpNotifications();
      } catch (e) {
        console.error('[Bot] Notification poll error:', e);
      }
    }, 60000);
  }

  startFirehose() {
    if (this.firehoseProcess) {
      console.log('[Bot] Firehose already running.');
      return;
    }
    console.log('[Bot] Starting firehose process...');
    this.firehoseProcess = spawn('python3', ['src/firehose.py']);
    this.firehoseProcess.stdout.on('data', (data) => {
      const line = data.toString().trim();
      if (line) {
          try {
              const event = JSON.parse(line);
              this.handleFirehoseEvent(event);
          } catch (e) {}
      }
    });
    this.firehoseProcess.stderr.on('data', (data) => {
      console.error(`[Firehose Error] ${data}`);
    });
    this.firehoseProcess.on('close', (code) => {
      console.log(`[Bot] Firehose process exited with code ${code}. Restarting in 10s...`);
      this.firehoseProcess = null;
      setTimeout(() => this.startFirehose(), 10000);
    });
  }

  async handleFirehoseEvent(event) {
    if (event.type === 'post') {
        const text = event.text || "";
        const keywords = dataStore.getFirehoseKeywords() || [];
        for (const kw of keywords) {
            if (text.toLowerCase().includes(kw.toLowerCase())) {
                console.log(`[Firehose] Match found for keyword "${kw}": ${text.substring(0, 50)}...`);
                await dataStore.addFirehoseMatch(kw, event);
                break;
            }
        }
    }
  }

  async performAutonomousPost() {
    return await orchestratorService.performAutonomousPost();
  }

  async executeAction(action, context = {}) {
      try {
          const params = action.parameters || action.arguments || {};
          const query = params.query || params.text || params.prompt || action.query || "";

          if (action.tool === "bsky_post") {
              const text = params.text || query;
              if (text) {
                  let result;
                  if (context?.uri) result = await blueskyService.postReply(context, text.substring(0, 290));
                  else result = await blueskyService.post(text.substring(0, 290));
                  return result ? { success: true, data: result.uri } : { success: false, reason: "Failed to post" };
              }
              return { success: false, reason: "Missing text" };
          }
          if (action.tool === "google_search" || action.tool === "search") {
              const res = await googleSearchService.search(query);
              return { success: true, data: res };
          }
          if (action.tool === "wikipedia") {
              const res = await wikipediaService.search(query);
              return { success: true, data: res };
          }
          if (action.tool === "set_goal") {
              const { goal, description } = params;
              const finalGoal = goal || query;
              if (finalGoal) {
                  await dataStore.setCurrentGoal(finalGoal, description || finalGoal);
                  if (memoryService.isEnabled()) await memoryService.createMemoryEntry("goal", `[GOAL] Goal: ${finalGoal}`);
                  return { success: true, data: finalGoal };
              }
              return { success: false, reason: "Goal name missing" };
          }
          return { success: false, reason: `Unknown tool: ${action.tool}` };
      } catch (e) {
          console.error("[Bot] Error in executeAction:", e);
          await dataStore.addSessionLesson(`Tool ${action.tool} failed: ${e.message}`);
          return { success: false, error: e.message };
      }
  }

  async catchUpNotifications() {
    console.log('[Bot] Catching up on missed notifications...');
    let cursor;
    let unreadActionable = [];
    let pageCount = 0;
    do {
      pageCount++;
      const response = await blueskyService.getNotifications(cursor);
      if (!response || response.notifications.length === 0) break;
      const actionableBatch = response.notifications.filter(notif => !notif.isRead && ['mention', 'reply', 'quote'].includes(notif.reason));
      unreadActionable.push(...actionableBatch);
      if (response.notifications.every(notif => notif.isRead) || pageCount >= 5) break;
      cursor = response.cursor;
    } while (cursor && pageCount < 5);

    if (unreadActionable.length === 0) return;
    unreadActionable.reverse();
    for (const notif of unreadActionable) {
      if (dataStore.hasReplied(notif.uri)) {
        await blueskyService.updateSeen(notif.indexedAt);
        continue;
      }
      if (await blueskyService.hasBotRepliedTo(notif.uri)) {
        await dataStore.addRepliedPost(notif.uri);
        await blueskyService.updateSeen(notif.indexedAt);
        continue;
      }
      await dataStore.addRepliedPost(notif.uri);
      try {
        await this.processNotification(notif);
        await blueskyService.updateSeen(notif.indexedAt);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) { console.error(`[Bot] Error processing notification ${notif.uri}:`, error); }
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

  async processNotification(notif) {
    if (this._detectInfiniteLoop(notif.uri)) return;
    const isSelf = !!notif.author.did && notif.author.did === blueskyService.agent?.session?.did;
    const history = await this._getThreadHistory(notif.uri);
    if (isSelf) {
        const prePlan = await llmService.performPrePlanning(notif.record.text || "", history, null, "bluesky", dataStore.getMood(), {});
        if (!["informational", "analytical", "critical_analysis"].includes(prePlan.intent)) return;
    }
    if (checkHardCodedBoundaries(notif.record.text || "").blocked) {
        await dataStore.setBoundaryLockout(notif.author.did, 30);
        return;
    }
    if (dataStore.isUserLockedOut(notif.author.did)) return;
    try {
      const handle = notif.author.handle;
      const text = notif.record.text || "";
      if (dataStore.db?.data) {
          dataStore.db.data.last_notification_processed_at = Date.now();
          await dataStore.db.write();
      }
      const isAdmin = handle === config.ADMIN_BLUESKY_HANDLE;
      const prePlan = await llmService.performPrePlanning(text, history, null, "bluesky", dataStore.getMood(), {});
      const memories = memoryService.isEnabled() ? await memoryService.getRecentMemories(20) : [];
      let plan = await llmService.performAgenticPlanning(text, history, null, isAdmin, "bluesky", dataStore.getExhaustedThemes(), {}, {}, {}, {}, null, prePlan, { memories });
      const evaluation = await llmService.evaluateAndRefinePlan(plan, { platform: "bluesky", isAdmin });
      if (evaluation.refined_actions && evaluation.refined_actions.length > 0) {
          plan.actions = evaluation.refined_actions;
      } else if (evaluation.decision !== "proceed") {
          return;
      }
      if (plan.actions) {
        for (const action of plan.actions) {
          await this.executeAction(action, { ...notif, platform: "bluesky" });
        }
      }
    } catch (error) { console.error(`[Bot] Error processing notification ${notif.uri}:`, error); }
  }

  _detectInfiniteLoop(uri) {
    const now = Date.now();
    if (!this._notifHistory) this._notifHistory = [];
    this._notifHistory = this._notifHistory.filter(h => now - h.timestamp < 600000);
    const count = this._notifHistory.filter(h => h.uri === uri).length;
    if (count >= 3) return true;
    this._notifHistory.push({ uri, timestamp: now });
    return false;
  }
}

export const bot = new Bot();

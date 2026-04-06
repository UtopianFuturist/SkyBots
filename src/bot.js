import { blueskyService } from './services/blueskyService.js';
import { llmService } from './services/llmService.js';
import { dataStore } from './services/dataStore.js';
import { googleSearchService } from './services/googleSearchService.js';
import { wikipediaService } from './services/wikipediaService.js';
import { imageService } from './services/imageService.js';
import { memoryService } from './services/memoryService.js';
import { discordService } from './services/discordService.js';
import { orchestratorService } from './services/orchestratorService.js';
import { introspectionService } from './services/introspectionService.js';
import { renderService } from './services/renderService.js';
import { checkHardCodedBoundaries } from './utils/textUtils.js';
import config from '../config.js';
import fs from 'fs/promises';
import { exec } from 'child_process';
import path from 'path';

export class Bot {
  constructor() {
    this.paused = false;
    this.orchestrator = orchestratorService;
    this.orchestrator.setBotInstance(this);
    this._notifHistory = [];
  }

  async init() {
    console.log('[Bot] Initializing services...');
    await dataStore.init();
    await blueskyService.authenticate();

    llmService.setDataStore(dataStore);
    llmService.setMemoryProvider(memoryService);
    llmService.setIdentities(config.ADMIN_DID, blueskyService.agent?.session?.did);

    const skills = await fs.readFile('skills.md', 'utf-8').catch(() => "");
    llmService.setSkillsContent(skills);

    if (config.DISCORD_BOT_TOKEN) {
        await discordService.init(config.DISCORD_BOT_TOKEN, config.ADMIN_NAME);
        discordService.setBotInstance(this);
    }

    this.startNotificationPoll();
    this.startFirehose();
    this.orchestrator.start();

    console.log('[Bot] Initialization complete.');
  }

  async executeAction(action, context = {}) {
      try {
          const params = action.parameters || action.arguments || {};
          const query = params.query || params.text || params.prompt || action.query || "";

          if (action.tool === "bsky_post") {
              let text = params.text || query;
              if (text) {
                  const memories = memoryService.isEnabled() ? await memoryService.getRecentMemories(20) : [];
                  const realityAudit = await llmService.performRealityAudit(text, {}, { history: memories });
                  if (realityAudit.hallucination_detected || realityAudit.repetition_detected) {
                      console.warn("[Bot] Audit flagged bsky_post. Refining...");
                      text = realityAudit.refined_text;
                  }
                  let result;
                  if (context?.uri) result = await blueskyService.postReply(context, text.substring(0, 290));
                  else result = await blueskyService.post(text.substring(0, 290));
                  return result ? { success: true, data: result.uri } : { success: false, reason: "Failed to post" };
              }
              return { success: false, reason: "Missing text" };
          }
          if (action.tool === "google_search" || action.tool === "search") {
              const res = await googleSearchService.search(query);
              const result = { success: true, data: res };
              await introspectionService.performAAR("tool_use", action.tool, result, { query, params });
              return result;
          }
          if (action.tool === "wikipedia") {
              const res = await wikipediaService.search(query);
              const result = { success: true, data: res };
              await introspectionService.performAAR("tool_use", action.tool, result, { query, params });
              return result;
          }
          if (action.tool === "set_goal") {
              const { goal, description } = params;
              const finalGoal = goal || query;
              if (finalGoal) {
                  await dataStore.setCurrentGoal(finalGoal, description || finalGoal);
                  if (memoryService.isEnabled()) await memoryService.createMemoryEntry("goal", `[GOAL] Goal: ${finalGoal}`);
                  const result = { success: true, data: finalGoal };
                  await introspectionService.performAAR("tool_use", action.tool, result, { query, params });
                  return result;
              }
              return { success: false, reason: "Goal name missing" };
          }
          if (action.tool === "add_persona_blurb") {
              const blurb = query || params.blurb;
              if (blurb) {
                  await dataStore.addPersonaBlurb({ text: blurb, timestamp: Date.now() });
                  if (memoryService.isEnabled()) await memoryService.createMemoryEntry("persona", blurb);
                  return { success: true, data: blurb };
              }
              return { success: false, reason: "Blurb text missing" };
          }
          if (action.tool === "remove_persona_blurb") {
              const uri = query || params.uri;
              if (uri) {
                  if (uri.startsWith("DS:")) {
                      const cleanUri = uri.replace("DS:", "");
                      const blurbs = dataStore.getPersonaBlurbs();
                      const filtered = blurbs.filter(b => b.uri !== cleanUri);
                      await dataStore.setPersonaBlurbs(filtered);
                  } else if (uri.startsWith("MEM:")) {
                      const cleanUri = uri.replace("MEM:", "");
                      await memoryService.deleteMemory(cleanUri);
                  }
                  return { success: true, data: uri };
              }
              return { success: false, reason: "URI missing" };
          }
          if (action.tool === "set_temporal_event") {
              const { text, duration_minutes } = params;
              const finalDuration = duration_minutes || (query ? 60 : 30);
              const expiresAt = Date.now() + (finalDuration * 60000);
              await dataStore.addTemporalEvent(text || query, expiresAt);
              return { success: true, data: { text, expiresAt } };
          }
          if (action.tool === "track_deadline") {
              const { task, target_date } = params;
              if (task && target_date) {
                  await dataStore.addDeadline(task, target_date);
                  return { success: true, data: { task, target_date } };
              }
              return { success: false, reason: "Task or target_date missing" };
          }
          if (action.tool === "update_activity_duration") {
              const { activity, minutes } = params;
              if (activity && minutes) {
                  const rules = dataStore.getActivityDecayRules();
                  rules[activity.toLowerCase()] = parseInt(minutes);
                  await dataStore.setActivityDecayRules(rules);
                  return { success: true, data: { activity, minutes } };
              }
              return { success: false, reason: "Activity or minutes missing" };
          }
          if (action.tool === "get_admin_time_context") {
              const { temporalService } = await import("./services/temporalService.js");
              const context = await temporalService.getEnhancedTemporalContext();
              return { success: true, data: context };
          }
          return { success: false, reason: `Unknown tool: ${action.tool}` };
      } catch (e) {
          console.error("[Bot] Error in executeAction:", e);
          await dataStore.addSessionLesson(`Tool ${action.tool} failed: ${e.message}`);
          return { success: false, error: e.message };
      }
  }

  async _handleError(error, contextInfo) {
    console.error(`[Bot] CRITICAL ERROR in ${contextInfo}:`, error);

    if (renderService.isEnabled()) {
      try {
        const logs = await renderService.getLogs(50);
        const alertPrompt = `
          You are an AI bot's diagnostic module. A critical error occurred in the bot's operation.
          Context: ${contextInfo}
          Error: ${error.message}
          Recent Logs:
          ${logs}
          Generate a concise alert message for the admin (@${config.ADMIN_BLUESKY_HANDLE}). Summarize what happened and the likely cause. Keep it under 300 characters.
        `;
        const alertMsg = await llmService.generateResponse([{ role: 'system', content: alertPrompt }], { useStep: true });
        if (alertMsg) {
          const isRateLimit = error.message.toLowerCase().includes('rate limit') || error.message.includes('429');
          if (discordService.status === 'online' && !isRateLimit) {
            await discordService.sendSpontaneousMessage(`${alertMsg}`);
          }
          await blueskyService.post(`@${config.ADMIN_BLUESKY_HANDLE} ${alertMsg}`);
        }
      } catch (logError) { console.error('[Bot] Failed to generate/post error alert:', logError); }
    }
  }

  async cleanupOldPosts() {
    try {
        console.log('[Bot] Cleaning up old posts...');
        const posts = await blueskyService.getUserPosts(blueskyService.agent?.session?.did, 50);
        const now = Date.now();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        for (const post of posts) {
            const createdAt = new Date(post.indexedAt).getTime();
            if (now - createdAt > thirtyDays) {
                console.log(`[Bot] Deleting old post: ${post.uri}`);
                await blueskyService.agent.deletePost(post.uri);
            }
        }
    } catch (e) { console.error('[Bot] Error in cleanupOldPosts:', e); }
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

  async startFirehose() {
      console.log('[Bot] Starting Firehose monitor...');
      const keywords = await dataStore.getFirehoseKeywords();
      const targets = await dataStore.getFirehoseTargets();

      let pythonPath = 'python3';
      let scriptPath = path.resolve(process.cwd(), 'firehose_monitor.py');

      if (!require('fs').existsSync(scriptPath)) {
          scriptPath = path.resolve(process.cwd(), '..', 'firehose_monitor.py');
      }

      const args = [
          scriptPath,
          '--keywords', keywords.join(','),
          '--targets', targets.join(','),
          '--did', blueskyService.agent?.session?.did || ''
      ];

      const child = exec(`${pythonPath} ${args.join(' ')}`);

      child.stdout.on('data', async (data) => {
          const lines = data.toString().split('\n');
          for (const line of lines) {
              if (line.startsWith('MATCH:')) {
                  try {
                      const match = JSON.parse(line.substring(6));
                      await dataStore.addFirehoseMatch(match);
                  } catch (e) { console.error('[Bot] Error parsing firehose match:', e); }
              }
          }
      });

      child.stderr.on('data', (data) => {
          console.error(`[Firehose] ${data}`);
      });

      child.on('close', (code) => {
          console.log(`[Firehose] Process exited with code ${code}. Restarting in 30s...`);
          setTimeout(() => this.startFirehose(), 30000);
      });
  }

  async restartFirehose() {
      console.log('[Bot] Restarting Firehose monitor to pick up new targets/keywords...');
      this.startFirehose();
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

  async performAutonomousPost() {
      await this.orchestrator.performAutonomousPost();
  }
}

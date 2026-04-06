import { blueskyService } from './services/blueskyService.js';
import { llmService } from './services/llmService.js';
import { dataStore } from './services/dataStore.js';
import { imageService } from './services/imageService.js';
import { youtubeService } from './services/youtubeService.js';
import { googleSearchService } from './services/googleSearchService.js';
import { wikipediaService } from './services/wikipediaService.js';
import { memoryService } from './services/memoryService.js';
import { discordService } from './services/discordService.js';
import { socialHistoryService } from './services/socialHistoryService.js';
import { evaluationService } from './services/evaluationService.js';
import { introspectionService } from './services/introspectionService.js';
import { renderService } from './services/renderService.js';
import { orchestratorService } from './services/orchestratorService.js';
import { checkHardCodedBoundaries } from './utils/textUtils.js';
import config from '../config.js';
import { exec } from 'child_process';
import path from 'path';

export class Bot {
    constructor() {
        this.paused = false;
        this.orchestrator = orchestratorService;
        this.orchestrator.setBotInstance(this);
    }

    async init() {
        console.log('[Bot] Initializing...');
        await dataStore.init();
        await blueskyService.init();
        await discordService.init(this);

        if (memoryService.isEnabled()) await memoryService.init();

        console.log('[Bot] Ready.');
        this.startHeartbeat();
        this.startNotificationPoll();
        this.startFirehose();
    }

    startHeartbeat() {
        console.log('[Bot] Starting heartbeat (30m interval)...');
        setInterval(() => this.orchestrator.heartbeat(), 30 * 60 * 1000);
        // Immediate first heartbeat
        this.orchestrator.heartbeat();
    }

    async performAutonomousPost() {
        return this.orchestrator.performAutonomousPost();
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
                    return { success: true, data: finalGoal };
                }
                return { success: false, reason: "Goal missing" };
            }
            if (action.tool === "add_persona_blurb") {
                const blurb = query || params.blurb;
                if (blurb) {
                    await dataStore.addPersonaBlurb(blurb);
                    if (memoryService.isEnabled()) await memoryService.createMemoryEntry("persona", blurb);
                    return { success: true, data: blurb };
                }
                return { success: false, reason: "Blurb missing" };
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
                return { success: false, reason: "Task or date missing" };
            }
            if (action.tool === "get_admin_time_context") {
                const { temporalService } = await import("./services/temporalService.js");
                const context = await temporalService.getEnhancedTemporalContext();
                return { success: true, data: context };
            }
            return { success: false, reason: `Unknown tool: ${action.tool}` };
        } catch (e) {
            console.error("[Bot] executeAction error:", e);
            await dataStore.addSessionLesson(`Tool ${action.tool} failed: ${e.message}`);
            return { success: false, error: e.message };
        }
    }

    async _handleError(error, contextInfo) {
        console.error(`[Bot] CRITICAL ERROR in ${contextInfo}:`, error);
        if (renderService.isEnabled()) {
            try {
                const logs = await renderService.getLogs(50);
                const alertPrompt = `Critical error in ${contextInfo}: ${error.message}. Logs: ${logs}. Generate concise alert for admin.`;
                const alertMsg = await llmService.generateResponse([{ role: 'system', content: alertPrompt }], { useStep: true });
                if (alertMsg) {
                    if (discordService.status === 'online') await discordService.sendSpontaneousMessage(alertMsg);
                    await blueskyService.post(`@${config.ADMIN_BLUESKY_HANDLE} ${alertMsg}`);
                }
            } catch (e) { console.error('[Bot] Alert failed:', e); }
        }
    }

    startNotificationPoll() {
        console.log('[Bot] Starting notification poll (60s)...');
        setInterval(async () => {
            try { await this.catchUpNotifications(); } catch (e) { console.error('[Bot] Poll error:', e); }
        }, 60000);
    }

    async startFirehose() {
        console.log('[Bot] Starting Firehose monitor...');
        try {
            const keywords = dataStore.getDeepKeywords();
            let pythonPath = 'python3';
            let scriptPath = path.resolve(process.cwd(), 'firehose_monitor.py');
            if (!require('fs').existsSync(scriptPath)) scriptPath = path.resolve(process.cwd(), '..', 'firehose_monitor.py');

            const args = [scriptPath, '--keywords', keywords.join(','), '--did', blueskyService.agent?.session?.did || ''];
            const child = exec(`${pythonPath} ${args.join(' ')}`);

            child.stdout.on('data', async (data) => {
                const lines = data.toString().split('\n');
                for (const line of lines) {
                    if (line.startsWith('MATCH:')) {
                        try {
                            const match = JSON.parse(line.substring(6));
                            if (dataStore.addInternalLog) await dataStore.addInternalLog("firehose_match", match);
                        } catch (e) {}
                    }
                }
            });

            child.on('close', (code) => {
                console.log(`[Firehose] Exited with code ${code}. Restarting in 30s...`);
                setTimeout(() => this.startFirehose(), 30000);
            });
        } catch (e) { console.error('[Bot] Firehose start failed:', e); }
    }

    async restartFirehose() { this.startFirehose(); }

    async catchUpNotifications() {
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
            if (await blueskyService.hasBotRepliedTo(notif.uri)) {
                await blueskyService.updateSeen(notif.indexedAt);
                continue;
            }
            try {
                await this.processNotification(notif);
                await blueskyService.updateSeen(notif.indexedAt);
            } catch (error) { console.error(`[Bot] Notification error ${notif.uri}:`, error); }
        }
    }

    async processNotification(notif) {
        if (this._detectInfiniteLoop(notif.uri)) return;
        const history = await this._getThreadHistory(notif.uri);
        const isAdmin = notif.author.handle === config.ADMIN_BLUESKY_HANDLE;
        const text = notif.record.text || "";

        const prePlan = await llmService.performPrePlanning(text, history, null, "bluesky", dataStore.getMood(), {});
        const memories = memoryService.isEnabled() ? await memoryService.getRecentMemories(20) : [];
        let plan = await llmService.performAgenticPlanning(text, history, null, isAdmin, "bluesky", dataStore.getExhaustedThemes(), {}, {}, {}, {}, null, prePlan, { memories });
        const evaluation = await llmService.evaluateAndRefinePlan(plan, { platform: "bluesky", isAdmin });

        if (evaluation.decision === "proceed") {
            const actions = evaluation.refined_actions || plan.actions;
            for (const action of actions) {
                await this.executeAction(action, { ...notif, platform: "bluesky" });
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
                content: p.post.record.text,
                uri: p.post.uri
            }));
        } catch (e) { return []; }
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

import fs from "fs/promises";
import config from '../config.js';
import { blueskyService } from './services/blueskyService.js';
import { discordService } from './services/discordService.js';
import { llmService } from './services/llmService.js';
import { dataStore } from './services/dataStore.js';
import { memoryService } from './services/memoryService.js';
import { orchestratorService } from './services/orchestratorService.js';
import { renderService } from './services/renderService.js';
import { socialHistoryService } from './services/socialHistoryService.js';
import { newsroomService } from './services/newsroomService.js';
import { imageService } from './services/imageService.js';
import { introspectionService } from './services/introspectionService.js';
import { evaluationService } from './services/evaluationService.js';
import { moltbookService } from './services/moltbookService.js';
import { openClawService } from './services/openClawService.js';
import { cronService } from './services/cronService.js';
import { nodeGatewayService } from './services/nodeGatewayService.js';
import toolService from './services/toolService.js';
import { checkHardCodedBoundaries } from './utils/textUtils.js';
import { exec, spawn } from 'child_process';
import path from 'path';

export class Bot {
    constructor() {
        this.paused = false;
        this.readmeContent = "";
        if (llmService.setDataStore) llmService.setDataStore(dataStore);
        if (llmService.setMemoryProvider) llmService.setMemoryProvider(memoryService);
        orchestratorService.setBotInstance(this);
    }

    async init() {
        console.log('[Bot] Initializing services...');
        await dataStore.init();
        try { this.readmeContent = await fs.readFile("README.md", "utf-8"); } catch (e) {}

        await blueskyService.init();
        if (config.DISCORD_BOT_TOKEN) await discordService.init(this);

        if (config.ADMIN_BLUESKY_HANDLE) {
            try {
                console.log(`[Bot] Resolving admin DID for @${config.ADMIN_BLUESKY_HANDLE}...`);
                const adminProfile = await blueskyService.getProfile(config.ADMIN_BLUESKY_HANDLE);
                if (adminProfile?.did) {
                    await dataStore.setAdminDid(adminProfile.did);
                    llmService.setIdentities(adminProfile.did, blueskyService.did);
                }
            } catch (e) {}
        }

        await moltbookService.init();
        await openClawService.init();
        await toolService.init();
        await nodeGatewayService.init();
        await cronService.init();

        if (config.RENDER_API_KEY) await renderService.discoverServiceId();

        this.startNotificationPoll();
        this.startFirehose();
        console.log('[Bot] Initialization complete.');
    }

    async run() {
        console.log("[Bot] Autonomous loop starting...");
        this.heartbeat();
        setInterval(() => this.heartbeat(), (config.HEARTBEAT_INTERVAL || 15) * 60000);
    }

    async heartbeat() {
        await orchestratorService.heartbeat();
    }

    async executeAction(action, context = {}) {
        if (!action) return { success: false, reason: "No action" };
        const params = action.parameters || action.arguments || (typeof action.query === 'object' ? action.query : {});
        let query = typeof action.query === 'string' ? action.query : (params.query || params.text || params.message || params.instruction);

        console.log(`[Bot] Executing tool: ${action.tool}`, params);

        try {
            if (['bsky_post', 'discord_message'].includes(action.tool)) {
                const textToEdit = params.text || params.message || query;
                if (textToEdit) {
                    const edit = await llmService.performEditorReview(textToEdit, context.platform || 'bluesky');
                    if (edit.decision === 'retry') await dataStore.addSessionLesson(`Editor refinement: ${edit.criticism}`);
                    query = edit.refined_text;
                    if (params.text) params.text = query;
                    if (params.message) params.message = query;
                }
            }

            if (action.tool === "bsky_post") {
                if (context.platform === 'discord') return { success: false, reason: "Cross-platform posting blocked" };
                let result = context.uri ? await blueskyService.postReply(context, params.text || query) : await blueskyService.post(params.text || query, params.reply_to, { maxChunks: params.maxChunks || 4 });
                await introspectionService.performAAR("tool_use", "bsky_post", result, { query, params });
                return { success: !!result, data: result?.uri };
            }
            if (action.tool === "discord_message") {
                const channel = context.channel || await discordService.getAdminUser();
                const result = await discordService._send(channel, params.message || query);
                await introspectionService.performAAR("tool_use", "discord_message", result, { query, params });
                return { success: !!result, data: params.message || query };
            }
            if (action.tool === "image_gen") {
                const prompt = params.prompt || query;
                const result = await this._generateVerifiedImagePost(prompt, { platform: context.platform || 'bluesky' });
                if (result) {
                    if (context.platform === 'discord') {
                        const channel = context.channel || await discordService.getAdminUser();
                        const { AttachmentBuilder } = await import('discord.js');
                        await discordService._send(channel, `${result.caption}\n\n[PROMPT]: ${result.finalPrompt}`, { files: [new AttachmentBuilder(result.buffer, { name: 'generated.jpg' })] });
                    } else {
                        const blob = await blueskyService.uploadBlob(result.buffer, 'image/jpeg');
                        const embed = { $type: 'app.bsky.embed.images', images: [{ image: blob.data.blob, alt: result.altText }] };
                        if (context.uri) await blueskyService.postReply(context, result.caption, { embed });
                        else await blueskyService.post(result.caption, embed);
                    }
                    return { success: true, data: result.finalPrompt };
                }
                return { success: false, reason: "Image generation or verification failed" };
            }
            if (action.tool === "set_goal") {
                await dataStore.setCurrentGoal(params.goal || query, params.description || "");
                await introspectionService.performAAR("tool_use", "set_goal", true, { goal: params.goal || query });
                return { success: true };
            }
            if (action.tool === "add_persona_blurb") { await dataStore.addPersonaBlurb(params.text || query); return { success: true }; }
            if (action.tool === "remove_persona_blurb") {
                const blurbs = dataStore.getPersonaBlurbs();
                if (params.index !== undefined && blurbs[params.index]) {
                    blurbs.splice(params.index, 1); await dataStore.setPersonaBlurbs(blurbs); return { success: true };
                }
                return { success: false, reason: "Invalid index" };
            }
            if (action.tool === "set_temporal_event") {
                if (params.text && params.duration_minutes) {
                    await dataStore.addTemporalEvent(params.text, Date.now() + (params.duration_minutes * 60000)); return { success: true };
                }
                return { success: false };
            }
            if (action.tool === "track_deadline") {
                if (params.task && params.date) { await dataStore.addDeadline(params.task, params.date); return { success: true }; }
                return { success: false };
            }
            if (action.tool === "get_admin_time_context") {
                const { temporalService } = await import("./services/temporalService.js");
                return { success: true, data: await temporalService.getEnhancedTemporalContext() };
            }
            if (["search", "wikipedia", "youtube"].includes(action.tool)) {
                const serviceMap = { search: "googleSearchService", wikipedia: "wikipediaService", youtube: "youtubeService" };
                const service = await import(`./services/${serviceMap[action.tool]}.js`).then(m => m[serviceMap[action.tool]]);
                return { success: true, data: await service.search(query) };
            }
            return { success: false, reason: `Unknown tool: ${action.tool}` };
        } catch (e) {
            console.error("[Bot] executeAction error:", e);
            await dataStore.addSessionLesson(`Tool ${action.tool} failed: ${e.message}`);
            return { success: false, error: e.message };
        }
    }

    async _generateVerifiedImagePost(topic, options = {}) {
        console.log(`[Bot] Generating verified image post for: ${topic}`);
        try {
            const topicPrompt = `Identify a visual subject for: "${topic}". JSON: {"topic": "label", "prompt": "stylized artistic prompt (max 270 chars)"}`;
            const res = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true });
            const data = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
            const result = await imageService.generateImage(data.prompt, options);
            if (!result) return null;
            const compliance = await llmService.isImageCompliant(result.buffer);
            if (!compliance.compliant) return null;
            const analysis = await llmService.analyzeImage(result.buffer, data.topic);
            const relevance = await llmService.verifyImageRelevance(analysis, data.topic);
            if (!relevance.relevant) return null;
            return { buffer: result.buffer, finalPrompt: data.prompt, analysis, altText: await llmService.generateAltText(analysis), caption: await llmService.generateResponse([{ role: "user", content: `Generate caption for: "${analysis}". Tone: ${dataStore.getMood().label}.` }], { useStep: true }), topic: data.topic };
        } catch (e) { return null; }
    }

    async performAutonomousPost() { return await orchestratorService.performAutonomousPost(); }

    async cleanupOldPosts() {
        try {
            console.log("[Bot] Running manual cleanup...");
            const profile = await blueskyService.getProfile(config.BLUESKY_IDENTIFIER);
            const feed = await blueskyService.agent.getAuthorFeed({ actor: profile.did, limit: 100 });
            const now = Date.now();
            const thirtyDays = 30 * 24 * 60 * 60 * 1000;
            for (const item of feed.data.feed) {
                const post = item.post;
                if (now - new Date(post.indexedAt).getTime() > thirtyDays) {
                    await blueskyService.agent.deletePost(post.uri);
                }
            }
        } catch (e) { console.error("[Bot] Cleanup failed:", e); }
    }

    async performSpecialistResearchProject(topic) {
        console.log(`[Bot] Starting Specialist Research: ${topic}`);
        try {
            const researcher = await llmService.generateResponse([{ role: "system", content: `Deep research on: ${topic}. Identify facts.` }], { useStep: true, task: "researcher" });
            const report = `[RESEARCH] Topic: ${topic}\nFindings: ${researcher}`;
            if (discordService.status === "online") await discordService.sendSpontaneousMessage(report);
        } catch (e) {}
    }

    async _handleError(error, contextInfo) {
        console.error(`[Bot] CRITICAL ERROR in ${contextInfo}:`, error);
        if (renderService.isEnabled()) {
            try {
                const alertMsg = await llmService.generateResponse([{ role: 'system', content: `Critical error in ${contextInfo}: ${error.message}. Generate alert.` }], { useStep: true });
                if (alertMsg) {
                    if (discordService.status === 'online') await discordService.sendSpontaneousMessage(alertMsg);
                    await blueskyService.post(`@${config.ADMIN_BLUESKY_HANDLE} ${alertMsg}`);
                }
            } catch (e) {}
        }
    }

    startNotificationPoll() {
        setInterval(async () => { try { await this.catchUpNotifications(); } catch (e) {} }, 60000);
    }

    async startFirehose() {
        console.log('[Bot] Starting Firehose monitor...');
        try {
            const keywords = dataStore.getDeepKeywords();
            const adminDid = dataStore.getAdminDid();
            let scriptPath = path.resolve(process.cwd(), 'firehose_monitor.py');
            if (!require('fs').existsSync(scriptPath)) scriptPath = path.resolve(process.cwd(), '..', 'firehose_monitor.py');
            const args = [scriptPath, '--keywords', keywords.join(','), '--did', blueskyService.agent?.session?.did || ''];
            if (adminDid) { args.push('--actors'); args.push(adminDid); }
            const command = `python3 -m pip install --no-warn-script-location --break-system-packages atproto python-dotenv && python3 ${args.join(' ')}`;
            const child = spawn(command, { shell: true });
            child.stdout.on('data', async (data) => {
                data.toString().split('\n').forEach(async line => {
                    if (line.startsWith('MATCH:')) {
                        try { const match = JSON.parse(line.substring(6)); await dataStore.addInternalLog("firehose_match", match); } catch (e) {}
                    }
                });
            });
            child.on('close', (code) => { console.log(`[Firehose] Exited (${code}). Restarting...`); setTimeout(() => this.startFirehose(), 30000); });
        } catch (e) {}
    }

    async restartFirehose() { this.startFirehose(); }

    async catchUpNotifications() {
        let cursor; let unreadActionable = []; let pageCount = 0;
        do {
            pageCount++;
            const response = await blueskyService.getNotifications(cursor);
            if (!response || response.notifications.length === 0) break;
            unreadActionable.push(...response.notifications.filter(notif => !notif.isRead && ['mention', 'reply', 'quote'].includes(notif.reason)));
            if (response.notifications.every(notif => notif.isRead) || pageCount >= 5) break;
            cursor = response.cursor;
        } while (cursor && pageCount < 5);
        if (unreadActionable.length === 0) return;
        unreadActionable.reverse();
        for (const notif of unreadActionable) {
            if (notif.author.did !== blueskyService.agent?.session?.did && !await blueskyService.hasBotRepliedTo(notif.uri)) {
                try { await this.processNotification(notif); } catch (error) {}
            }
            await blueskyService.updateSeen(notif.indexedAt);
        }
    }

    async processNotification(notif) {
        if (this._detectInfiniteLoop(notif.uri)) return;
        const history = await this._getThreadHistory(notif.uri);
        const text = notif.record.text || "";
        if (checkHardCodedBoundaries(text).blocked) { await dataStore.setBoundaryLockout(notif.author.did, 30); return; }
        if (dataStore.isUserLockedOut(notif.author.did)) return;
        const isSelf = notif.author.did === blueskyService.agent?.session?.did;
        if (isSelf) {
            const prePlan = await llmService.performPrePlanning(text, history, null, "bluesky", dataStore.getMood(), {});
            if (!["informational", "analytical", "critical_analysis"].includes(prePlan.intent)) return;
        }
        const isAdmin = notif.author.handle === config.ADMIN_BLUESKY_HANDLE;
        const prePlan = await llmService.performPrePlanning(text, history, null, "bluesky", dataStore.getMood(), {});
        let plan = await llmService.performAgenticPlanning(text, history, null, isAdmin, "bluesky", dataStore.getExhaustedThemes(), {}, {}, {}, {}, null, prePlan, { memories: await memoryService.getRecentMemories(20) });
        const evaluation = await llmService.evaluateAndRefinePlan(plan, { platform: "bluesky", isAdmin });
        if (evaluation.decision === "proceed") {
            for (const action of (evaluation.refined_actions || plan.actions)) await this.executeAction(action, { ...notif, platform: "bluesky" });
        }
    }

    async _getThreadHistory(uri) {
        try {
            const thread = await blueskyService.getDetailedThread(uri);
            return (thread || []).map(p => ({ author: p.post.author.handle, role: p.post.author.did === blueskyService.agent?.session?.did ? "assistant" : "user", content: p.post.record.text, uri: p.post.uri }));
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

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
import { checkHardCodedBoundaries } from './utils/textUtils.js';
import { exec } from 'child_process';
import path from 'path';

export class Bot {
    constructor() {
        this.paused = false;
        if (llmService.setDataStore) llmService.setDataStore(dataStore);
        if (llmService.setMemoryProvider) llmService.setMemoryProvider(memoryService);
        orchestratorService.setBotInstance(this);
    }

    async init() {
        console.log('[Bot] Initializing services...');
        await dataStore.init();
        await blueskyService.init();
        if (config.DISCORD_BOT_TOKEN) await discordService.init(this);
        if (config.RENDER_API_KEY) await renderService.discoverServiceId();
        this.startNotificationPoll();
        this.startFirehose();
        console.log('[Bot] Initialization complete.');
    }

    async executeAction(action, context = {}) {
        if (!action) return { success: false, reason: "No action" };
        const params = action.parameters || action.arguments || (typeof action.query === 'object' ? action.query : {});
        let query = typeof action.query === 'string' ? action.query : (params.query || params.text || params.message || params.instruction);

        console.log(`[Bot] Executing tool: ${action.tool}`, params);

        try {
            // Editor Gate for communication tools
            if (['bsky_post', 'discord_message'].includes(action.tool)) {
                const textToEdit = params.text || params.message || query;
                if (textToEdit) {
                    const edit = await llmService.performEditorReview(textToEdit, context.platform || 'bluesky');
                    if (edit.decision === 'retry') {
                        await dataStore.addSessionLesson(`Editor refinement for ${action.tool}: ${edit.criticism}`);
                    }
                    query = edit.refined_text;
                    if (params.text) params.text = query;
                    if (params.message) params.message = query;
                }
            }

            if (action.tool === "bsky_post") {
                if (context.platform === 'discord') return { success: false, reason: "Cross-platform posting blocked" };
                let result;
                if (context.uri) {
                    result = await blueskyService.postReply(context, params.text || query);
                } else {
                    result = await blueskyService.post(params.text || query, params.reply_to, { maxChunks: params.maxChunks || 4 });
                }
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
                        const attachment = new AttachmentBuilder(result.buffer, { name: 'generated.jpg' });
                        await discordService._send(channel, `${result.caption}\n\n[PROMPT]: ${result.finalPrompt}`, { files: [attachment] });
                    } else {
                        const blob = await blueskyService.uploadBlob(result.buffer, 'image/jpeg');
                        const embed = { $type: 'app.bsky.embed.images', images: [{ image: blob.data.blob, alt: result.altText }] };
                        if (context.uri) {
                            await blueskyService.postReply(context, result.caption, { embed });
                        } else {
                            await blueskyService.post(result.caption, embed);
                        }
                    }
                    return { success: true, data: result.finalPrompt };
                }
                return { success: false, reason: "Image generation or verification failed" };
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
                const context = await temporalService.getEnhancedTemporalContext();
                return { success: true, data: context };
            }
            if (action.tool === "search") {
                const { googleSearchService } = await import("./services/googleSearchService.js");
                const res = await googleSearchService.search(query);
                return { success: true, data: res };
            }
            if (action.tool === "wikipedia") {
                const { wikipediaService } = await import("./services/wikipediaService.js");
                const res = await wikipediaService.search(query);
                return { success: true, data: res };
            }
            if (action.tool === "youtube") {
                const { youtubeService } = await import("./services/youtubeService.js");
                const res = await youtubeService.search(query);
                return { success: true, data: res };
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
            if (!compliance.compliant) {
                console.warn("[Bot] Image non-compliant:", compliance.reason);
                return null;
            }

            const analysis = await llmService.analyzeImage(result.buffer, data.topic);
            const relevance = await llmService.verifyImageRelevance(analysis, data.topic);
            if (!relevance.relevant) {
                console.warn("[Bot] Image irrelevant:", relevance.reason);
                return null;
            }

            const altText = await llmService.generateAltText(analysis);
            const captionPrompt = `Generate a caption for this image: "${analysis}". Topic: ${data.topic}. Tone: ${dataStore.getMood().label}.`;
            const caption = await llmService.generateResponse([{ role: "user", content: captionPrompt }], { useStep: true });

            return {
                buffer: result.buffer,
                finalPrompt: data.prompt,
                analysis,
                altText,
                caption,
                topic: data.topic
            };
        } catch (e) {
            console.error("[Bot] Verified image generation failed:", e);
            return null;
        }
    }

    async performAutonomousPost() {
        return await orchestratorService.performAutonomousPost();
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
            const isSelf = notif.author.did === blueskyService.agent?.session?.did;
            if (!isSelf && await blueskyService.hasBotRepliedTo(notif.uri)) {
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
        const handle = notif.author.handle;
        const isAdmin = handle === config.ADMIN_BLUESKY_HANDLE;
        const text = notif.record.text || "";
        const isSelf = notif.author.did === blueskyService.agent?.session?.did;

        if (isSelf) {
            const prePlan = await llmService.performPrePlanning(text, history, null, "bluesky", dataStore.getMood(), {});
            if (!["informational", "analytical", "critical_analysis"].includes(prePlan.intent)) return;
        }

        if (checkHardCodedBoundaries(text).blocked) {
             await dataStore.setBoundaryLockout(notif.author.did, 30);
             return;
        }
        if (dataStore.isUserLockedOut(notif.author.did)) return;

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

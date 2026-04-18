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
import { openClawService } from './services/openClawService.js';
import { cronService } from './services/cronService.js';
import { nodeGatewayService } from './services/nodeGatewayService.js';
import toolService from './services/toolService.js';
import { checkHardCodedBoundaries } from './utils/textUtils.js';
import { handleCommand } from "./utils/commandHandler.js";
import { exec, spawn } from 'child_process';
import path from 'path';

export class Bot {
    constructor() {
        this.paused = false;
        this.lastFirehoseImpulse = 0;
        this.readmeContent = "";
        if (llmService.setDataStore) llmService.setDataStore(dataStore);
        if (llmService.setMemoryProvider) llmService.setMemoryProvider(memoryService);
        orchestratorService.setBotInstance(this);
    }

    async init() {
        console.log('[Bot] Starting service initialization...');

        try {
            console.log('[Bot] Initializing DataStore...');
            await dataStore.init();
        } catch (e) { console.error('[Bot] DataStore init failed:', e); }

        try {
            this.readmeContent = await fs.readFile("README.md", "utf-8");
        } catch (e) { console.warn('[Bot] README.md not found'); }

        try {
            console.log('[Bot] Initializing Bluesky Service...');
            await blueskyService.init();
        } catch (e) { console.error('[Bot] Bluesky init failed:', e); }

        if (config.DISCORD_BOT_TOKEN) {
            try {
                console.log('[Bot] Initializing Discord Service (Non-blocking)...');
                // No await here so Discord doesn't hang the rest of the bot
                discordService.init(this).catch(e => console.error("[Bot] Discord init error:", e));
                
                // Catch-up should only happen once ready, but we'll queue it here with a longer delay
                setTimeout(() => {
                    if (discordService.client?.isReady()) {
                        discordService.performStartupCatchup().catch(e => console.error('[Bot] Discord catchup error:', e));
                    }
                }, 15000);
            } catch (e) { console.error("[Bot] Discord service setup error:", e); }
        }

        if (config.ADMIN_BLUESKY_HANDLE) {
            try {
                console.log("Resolving admin DID for @" + config.ADMIN_BLUESKY_HANDLE + "...");
                const adminProfile = await blueskyService.getProfile(config.ADMIN_BLUESKY_HANDLE);
                if (adminProfile && adminProfile.did) {
                    await dataStore.setAdminDid(adminProfile.did);
                    llmService.setIdentities(adminProfile.did, blueskyService.did);
                }
            } catch (e) { console.warn('[Bot] Admin DID resolution failed:', e.message); }
        }

        try { await openClawService.init(); } catch (e) { console.error('[Bot] OpenClaw init failed:', e); }
        try { await toolService.init(); } catch (e) { console.error('[Bot] ToolService init failed:', e); }
        try { await nodeGatewayService.init(); } catch (e) { console.error('[Bot] NodeGateway init failed:', e); }
        try { await cronService.init(); } catch (e) { console.error('[Bot] CronService init failed:', e); }

        if (config.RENDER_API_KEY) {
            try { await renderService.discoverServiceId(); } catch (e) { console.warn('[Bot] Render service discovery failed'); }
        }

        this.startNotificationPoll();
        this.startFirehose();
        console.log('[Bot] Initialization sequence complete.');
    }

    async run() {
        console.log("[Bot] Autonomous loop starting...");
        this.heartbeat();
        setInterval(() => this.heartbeat(), (config.HEARTBEAT_INTERVAL || 15) * 60000);
    }

    async heartbeat() {
        if (this.paused) {
            console.log("[Bot] Pulse skipped. Bot is paused by Admin.");
            return;
        }
        await orchestratorService.heartbeat();
    }

    async executeAction(action, context = {}) {
        if (!action) return { success: false, reason: "No action" };
        const params = action.parameters || action.arguments || (typeof action.query === 'object' ? action.query : {});
        let query = typeof action.query === 'string' ? action.query : (params.query || params.text || params.message || params.instruction);

        console.log("Executing tool: " + action.tool, params);

        try {
            if (action.tool === "bsky_post") {
                if (context.platform === "discord") return { success: false, reason: "Cross-platform posting blocked" };
                let text = params.text || query;
                if (text) {
                    const memories = await memoryService.getRecentMemories(20);
                    const audit = await llmService.performRealityAudit(text, {}, { history: memories });
                    if (audit.hallucination_detected || audit.repetition_detected || audit.slop_detected) {
                        console.warn("[Bot] Reality Audit flagged bsky_post. Refining...");
                        text = audit.refined_text;
                    }
                    const edit = await llmService.performEditorReview(text, "bluesky");
                    if (edit.decision === "pass" || edit.refined_text) {
                        text = edit.refined_text || text;
                    }
                }
                let result = context.uri ? await blueskyService.postReply(context, text) : await blueskyService.post(text, params.reply_to, { maxChunks: params.maxChunks || 4 });
                const { performanceService } = await import('./services/performanceService.js');
                await performanceService.performTechnicalAudit("tool_use", "bsky_post", result, { query, params });
                await introspectionService.performAAR("tool_use", "bsky_post", result, { query, params });
                return { success: !!result, data: result?.uri };
            }
            if (action.tool === "discord_message") {
                const channel = context.channel || await discordService.getAdminUser();
                let msg = params.message || query;
                if (msg) {
                    const memories = await memoryService.getRecentMemories(20);
                    const audit = await llmService.performRealityAudit(msg, {}, { history: memories });
                    if (audit.hallucination_detected || audit.repetition_detected || audit.slop_detected) {
                        console.warn("[Bot] Reality Audit flagged discord_message. Refining...");
                        msg = audit.refined_text;
                    }
                    const edit = await llmService.performEditorReview(msg, "discord");
                    if (edit.decision === "pass" || edit.refined_text) {
                        msg = edit.refined_text || msg;
                    }
                }
                const result = await discordService._send(channel, msg);
                const { performanceService } = await import('./services/performanceService.js');
                await performanceService.performTechnicalAudit("tool_use", "discord_message", result, { query, params });
                await introspectionService.performAAR("tool_use", "discord_message", result, { query, params });
                return { success: !!result, data: params.message || query };
            }
            if (action.tool === "discord_gift") {
                await this.performDiscordPinnedGift();
                return { success: true };
            }
            if (action.tool === "image_gen") {
                const prompt = params.prompt || query;
                if (context.platform === "discord") {
                    const result = await this._generateVerifiedImagePost(prompt, { platform: "discord" });
                    if (result) {
                        const channel = context.channel || await discordService.getAdminUser();
                        const { AttachmentBuilder } = await import("discord.js");
                        await discordService._send(channel, result.caption + "\n\n[PROMPT]: " + result.finalPrompt, { files: [new AttachmentBuilder(result.buffer, { name: "generated.jpg" })] });
                        return { success: true };
                    }
                } else {
                    await orchestratorService._performHighQualityImagePost(prompt);
                    return { success: true };
                }
                return { success: false, reason: "Image generation failed" };
            }
            if (action.tool === "set_goal") {
                await dataStore.setCurrentGoal(params.goal || query, params.description || "");
                await introspectionService.performAAR("tool_use", "set_goal", true, { goal: params.goal || query });
                return { success: true };
            }
            if (action.tool === "update_persona") {
                await dataStore.addPersonaBlurb(params.instruction || query);
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
                const { temporalService } = await import('./services/temporalService.js');
                return { success: true, data: await temporalService.getEnhancedTemporalContext() };
            }
            if (action.tool === "execute_skill") {
                const skillName = params.name || params.skill_name || query;
                const skillParams = params.parameters || params.args || {};
                const result = await openClawService.executeSkill(skillName, skillParams);
                return { success: true, data: result };
            }
            if (action.tool === "check_internal_state") {
                const state = {
                    goal: dataStore.getCurrentGoal(),
                    mood: dataStore.getMood(),
                    relational_metrics: dataStore.getRelationalMetrics(),
                    recent_memories: await memoryService.getRecentMemories(15)
                };
                return { success: true, data: state };
            }
            if (action.tool === "read_logs") {
                const logs = await renderService.getLogs(params.limit || 100);
                return { success: true, data: logs };
            }
            if (action.tool === "call_skill") {
                const result = await openClawService.executeSkill(params.name, params.parameters);
                return { success: true, data: result };
            }
            if (action.tool === "reassurance_tool") {
                const memories = await memoryService.getRecentMemories(20);
                const positive = memories.filter(m => !m.text.toLowerCase().includes('fail') && !m.text.toLowerCase().includes('error'));
                return { success: true, data: positive.slice(0, 5) };
            }
            if (action.tool === "find_image") {
                const { googleSearchService } = await import("./services/googleSearchService.js");
                const res = await googleSearchService.findImage(query);
                return { success: true, data: res };
            }
            if (["search", "wikipedia", "youtube"].includes(action.tool)) {
                const serviceMap = { search: "googleSearchService", wikipedia: "wikipediaService", youtube: "youtubeService" };
                const service = await import("./services/" + serviceMap[action.tool] + ".js").then(m => m[serviceMap[action.tool]]);
                return { success: true, data: await service.search(query) };
            }
            return { success: false, reason: "Unknown tool: " + action.tool };
        } catch (e) {
            console.error("[Bot] executeAction error:", e);
            await dataStore.addSessionLesson("Tool " + action.tool + " failed: " + e.message);
            return { success: false, error: e.message };
        }
    }

    async _generateVerifiedImagePost(topic, options = {}) {
        console.log("Generating verified image post for: " + topic);
        try {
            const topicPrompt = "Identify a visual subject for: \"" + topic + "\". JSON: {\"topic\": \"label\", \"prompt\": \"stylized artistic prompt (max 270 chars)\"}";
            const res = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true });
            const data = llmService.extractJson(res) || {};
            if (!data.prompt) return null;
            const result = await imageService.generateImage(data.prompt, options);
            if (!result) return null;
            const compliance = await llmService.isImageCompliant(result.buffer);
            if (!compliance.compliant) return null;
            const analysis = await llmService.analyzeImage(result.buffer, data.topic);
            const relevance = await llmService.verifyImageRelevance(analysis, data.topic);
            if (!relevance.relevant) return null;
            return {
                buffer: result.buffer,
                finalPrompt: data.prompt,
                analysis,
                altText: await llmService.generateAltText(analysis),
                caption: await llmService.generateResponse([{ role: "user", content: "Generate caption for: \"" + analysis + "\". Tone: " + dataStore.getMood().label + "." }], { useStep: true }),
                topic: data.topic
            };
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
        console.log("Starting Specialist Research: " + topic);
        try {
            const researcher = await llmService.generateResponse([{ role: "system", content: "Deep research on: " + topic + ". Identify facts." }], { useStep: true, task: "researcher" });
            const report = "[RESEARCH] Topic: " + topic + "\nFindings: " + researcher;
            if (discordService.status === "online") await discordService.sendSpontaneousMessage(report);
        } catch (e) {}
    }

    async _handleError(error, contextInfo) {
        console.error("CRITICAL ERROR in " + contextInfo + ":", error);
        if (renderService.isEnabled()) {
            try {
                const alertMsg = await llmService.generateResponse([{ role: 'system', content: "Critical error in " + contextInfo + ": " + error.message + ". Generate alert." }], { useStep: true });
                if (alertMsg) {
                    if (discordService.status === 'online') await discordService.sendSpontaneousMessage(alertMsg);
                    await blueskyService.post("@" + config.ADMIN_BLUESKY_HANDLE + " " + alertMsg);
                }
            } catch (e) {}
        }
    }

    startNotificationPoll() {
        setInterval(async () => { try { await this.catchUpNotifications(); } catch (e) {} }, 60000);
    }

    async startFirehose() {
        console.log("[Bot] Starting Firehose monitor...");
        try {
            const rawKeywords = dataStore.getDeepKeywords();
            const keywords = rawKeywords.map(k => k.replace(/[\\r\\n]/g, " ").trim()).filter(Boolean);
            const adminDid = dataStore.getAdminDid();
            let scriptPath = path.resolve(process.cwd(), "firehose_monitor.py");
            if (!(await fs.access(scriptPath).then(() => true).catch(() => false))) scriptPath = path.resolve(process.cwd(), "..", "firehose_monitor.py");
            const firehoseActors = [blueskyService.agent?.session?.did, adminDid].filter(Boolean).join(",");
            const keywordsStr = keywords.join(",");

            await new Promise((resolve) => {
                exec("python3 -m pip install --no-warn-script-location --break-system-packages atproto python-dotenv", () => resolve());
            });

            if (this.firehoseProcess) {
                console.log("[Bot] Terminating existing firehose process...");
                this.firehoseProcess.kill();
            }

            this.firehoseProcess = spawn("python3", [scriptPath, "--keywords", keywordsStr, "--actors", firehoseActors]);

            this.firehoseProcess.stderr.on("data", (data) => {
                const msg = data.toString();
                if (msg.includes("Error") || msg.includes("unrecognized arguments")) {
                    console.error("[Firehose] Error:", msg);
                }
            });

            this.firehoseProcess.stdout.on("data", async (data) => {
                data.toString().split("\n").forEach(async line => {
                    if (line.startsWith("MATCH:") || line.trim().startsWith("{")) {
                        try {
                            const jsonStr = line.startsWith("MATCH:") ? line.substring(6) : line;
                            const match = JSON.parse(jsonStr);

                            await dataStore.addInternalLog("firehose_match", match);
                            const now = Date.now();
                            const lastPost = dataStore.getLastAutonomousPostTime() || 0;
                            const lastPostMs = typeof lastPost === 'string' ? new Date(lastPost).getTime() : lastPost;

                            if (match.type === "firehose_topic_match" && Math.random() < 0.2 && (now - lastPostMs > (config.BACKOFF_DELAY || 60000))) {
                                console.log("[Bot] Firehose topic match triggered an autonomous impulse...");
                                orchestratorService.addTaskToQueue(() => orchestratorService.performAutonomousPost({ topic: match.matched_keywords?.[0] || "trending" }), "firehose_impulse");
                            }

                        } catch (e) {}
                    }
                });
            });

            this.firehoseProcess.on("close", (code) => {
                console.log("Firehose Exited (" + code + "). Restarting in 30s...");
                this.firehoseProcess = null;
                setTimeout(() => this.startFirehose(), 30000);
            });
        } catch (e) {
            console.error("[Bot] startFirehose failed:", e);
        }
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
        const commandResponse = await handleCommand(this, notif, text); if (commandResponse) { await blueskyService.postReply(notif, commandResponse); return; }
        if (checkHardCodedBoundaries(text).blocked) { await dataStore.setBoundaryLockout(notif.author.did, 30); return; }
        if (dataStore.isUserLockedOut(notif.author.did)) return;
        const isSelf = notif.author.did === blueskyService.agent?.session?.did;
        if (isSelf) {
            const prePlan = await llmService.performPrePlanning(text, history, null, "bluesky", dataStore.getMood(), {});
            if (!["informational", "analytical", "critical_analysis"].includes(prePlan.intent)) return;
        }

        const isAdmin = notif.author.handle === config.ADMIN_BLUESKY_HANDLE;
        if (isAdmin && discordService.status === "online") {
            console.log("[Bot] Admin interaction detected on Bluesky. Pivoting to Discord...");
            const pivotMsg = "[PIVOT] @" + notif.author.handle + " just mentioned you on Bluesky: \"" + text + "\"";
            await discordService.sendSpontaneousMessage(pivotMsg);
        }

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
            return (thread || []).map(p => ({ author: p.post.author.handle, role: p.post.author.did === blueskyService.did ? "assistant" : "user", content: p.post.record.text, uri: p.post.uri }));
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

    async performDiscordPinnedGift() {
        if (discordService.status !== 'online') return;
        const admin = await discordService.getAdminUser();
        if (!admin) return;

        console.log('[Bot] Deciding on a Discord pinned gift for admin...');
        const mood = dataStore.getMood();

        const decisionPrompt = "Adopt persona: " + config.TEXT_SYSTEM_PROMPT + "\nYou are deciding to send a visual gift and a pinned message to your Admin.\nMood: " + JSON.stringify(mood) + "\nContext: Thinking about the Admin and your bond.\n\nGenerate a visual topic and a message that says what you want them to see when they get back.\nRespond with JSON: { \"topic\": \"string\", \"message\": \"string\" }";

        const res = await llmService.generateResponse([{ role: 'system', content: decisionPrompt }], { useStep: true });
        const data = llmService.extractJson(res);
        if (data && data.topic) {
            const gift = await this._generateVerifiedImagePost(data.topic, { platform: 'discord' });
            if (gift) {
                const dmChannel = admin.dmChannel || await admin.createDM();
                const { AttachmentBuilder } = await import("discord.js");
                const mainMsg = await discordService._send(dmChannel, data.message + "\n\n" + gift.caption, { files: [new AttachmentBuilder(gift.buffer, { name: "gift.jpg" })] });
                if (mainMsg) {
                    await discordService._send(dmChannel, "[Generation Prompt]\n" + gift.finalPrompt);
                    try { await mainMsg.pin(); } catch (e) {}
                    await dataStore.saveDiscordInteraction("dm-" + admin.id, 'assistant', data.message);
                }
            }
        }
    }
}
export const bot = new Bot();

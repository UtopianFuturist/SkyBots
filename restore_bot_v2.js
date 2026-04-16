import fs from 'fs/promises';
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

class Bot {
    constructor() {
        this.paused = false;
        this.readmeContent = "";
        this._notifHistory = [];
        orchestratorService.setBotInstance(this);
    }

    async init() {
        console.log('[Bot] Starting service initialization...');
        try {
            await dataStore.init();
            await blueskyService.init();
            llmService.setDataStore(dataStore);

            if (config.DISCORD_BOT_TOKEN) {
                try {
                    await discordService.init(this);
                    setTimeout(() => {
                        discordService.performStartupCatchup().catch(e => console.error('[Bot] Discord catchup error:', e));
                    }, 30000);
                } catch (e) { console.error('[Bot] Discord init failed:', e); }
            }

            if (config.ADMIN_BLUESKY_HANDLE) {
                try {
                    console.log("[Bot] Resolving admin DID...");
                    const adminProfile = await blueskyService.getProfile(config.ADMIN_BLUESKY_HANDLE);
                    if (adminProfile?.did) {
                        await dataStore.setAdminDid(adminProfile.did);
                        llmService.setIdentities(adminProfile.did, blueskyService.did);
                    }
                } catch (e) { console.warn('[Bot] Admin DID resolution failed:', e.message); }
            }

            await openClawService.init();
            await toolService.init();
            await nodeGatewayService.init();
            await cronService.init();

            this.readmeContent = await fs.readFile('README.md', 'utf-8').catch(() => "");

            console.log('[Bot] Initialization sequence complete.');
        } catch (err) {
            console.error('[Bot] Initialization FATAL ERROR:', err);
        }
    }

    async run() {
        console.log('[Bot] Autonomous loop starting...');
        this.heartbeat();
        setInterval(() => this.heartbeat(), (config.HEARTBEAT_INTERVAL || 15) * 60000);
        this.startFirehose();
        this.startNotificationPoll();
    }

    async heartbeat() {
        if (this.paused) return;
        await orchestratorService.heartbeat();
    }

    async executeAction(action, context = {}) {
        if (!action) return { success: false, reason: "No action" };
        const params = action.parameters || action.arguments || (typeof action.query === 'object' ? action.query : {});
        let query = typeof action.query === 'string' ? action.query : (params.query || params.text || params.message || params.instruction);

        console.log("[Bot] Executing tool: " + action.tool, params);

        try {
            if (action.tool === "bsky_post") {
                if (context.platform === "discord") return { success: false, reason: "Cross-platform posting blocked" };
                let text = params.text || query;
                if (text) {
                    const memories = await memoryService.getRecentMemories(20);
                    const audit = await llmService.performRealityAudit(text, {}, { history: memories });
                    if (audit.hallucination_detected) text = audit.refined_text;
                    const edit = await llmService.performEditorReview(text, "bluesky");
                    if (edit.decision === "pass" || edit.refined_text) text = edit.refined_text || text;
                }
                let result = context.uri ? await blueskyService.postReply(context, text) : await blueskyService.post(text, params.reply_to, { maxChunks: params.maxChunks || 4 });
                return { success: !!result, data: result?.uri };
            }
            if (action.tool === "discord_message") {
                const channel = context.channel || await discordService.getAdminUser();
                let msg = params.message || query;
                if (msg) {
                    const memories = await memoryService.getRecentMemories(20);
                    const audit = await llmService.performRealityAudit(msg, {}, { history: memories });
                    if (audit.hallucination_detected) msg = audit.refined_text;
                }
                const result = await discordService._send(channel, msg);
                return { success: !!result, data: msg };
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
                        await discordService._send(channel, result.caption + "\\n\\n[PROMPT]: " + result.finalPrompt, { files: [new AttachmentBuilder(result.buffer, { name: "generated.jpg" })] });
                        return { success: true };
                    }
                } else {
                    await orchestratorService._performHighQualityImagePost(prompt);
                    return { success: true };
                }
                return { success: false };
            }
            if (action.tool === "set_goal") {
                await dataStore.setCurrentGoal(params.goal || query, params.description || "");
                return { success: true };
            }
            if (action.tool === "call_skill" || action.tool === "execute_skill") {
                const skillName = params.name || params.skill_name || query;
                const skillParams = params.parameters || params.args || {};
                const result = await openClawService.executeSkill(skillName, skillParams);
                return { success: true, data: result };
            }
            if (action.tool === "check_internal_state") {
                return { success: true, data: { goal: dataStore.getCurrentGoal(), mood: dataStore.getMood() } };
            }
            if (action.tool === "search") {
                const { googleSearchService } = await import("./services/googleSearchService.js");
                return { success: true, data: await googleSearchService.search(query) };
            }
            return { success: false, reason: "Unknown tool" };
        } catch (e) {
            console.error("[Bot] executeAction error:", e);
            return { success: false, error: e.message };
        }
    }

    async _generateVerifiedImagePost(topic, options = {}) {
        try {
            const topicPrompt = \`Identify a visual subject for: "\${topic}". JSON: {"topic": "label", "prompt": "stylized artistic prompt"}\`;
            const res = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true });
            const data = llmService.extractJson(res) || {};
            if (!data.prompt) return null;
            const result = await imageService.generateImage(data.prompt, options);
            if (!result) return null;
            const analysis = await llmService.analyzeImage(result.buffer, data.topic);
            const caption = await llmService.generateResponse([{ role: "user", content: \`Generate caption for: "\${analysis}"\` }], { useStep: true });
            return { buffer: result.buffer, finalPrompt: data.prompt, analysis, caption };
        } catch (e) { return null; }
    }

    async performDiscordPinnedGift() {
        if (discordService.status !== 'online') return;
        const admin = await discordService.getAdminUser();
        if (!admin) return;
        const res = await llmService.generateResponse([{ role: 'system', content: 'Generate a visual gift idea for Admin. JSON: {"topic":"string","message":"string"}' }], { useStep: true });
        const data = llmService.extractJson(res);
        if (data?.topic) {
            const gift = await this._generateVerifiedImagePost(data.topic, { platform: 'discord' });
            if (gift) {
                const dmChannel = admin.dmChannel || await admin.createDM();
                const { AttachmentBuilder } = await import("discord.js");
                const mainMsg = await discordService._send(dmChannel, data.message + "\\n\\n" + gift.caption, { files: [new AttachmentBuilder(gift.buffer, { name: "gift.jpg" })] });
                if (mainMsg) {
                    await mainMsg.pin().catch(()=>{});
                    await discordService._send(dmChannel, "[Generation Prompt]\\n" + gift.finalPrompt);
                }
            }
        }
    }

    async catchUpNotifications() {
        try {
            const timeline = await blueskyService.getTimeline(20);
            for (const item of (timeline?.data?.feed || [])) {
                if (item.post.author.did !== blueskyService.did && !this._notifHistory.includes(item.post.uri)) {
                    await this.processNotification({ author: item.post.author, record: item.post.record, uri: item.post.uri });
                    this._notifHistory.push(item.post.uri);
                }
            }
        } catch (e) {}
    }

    startNotificationPoll() {
        setInterval(() => this.catchUpNotifications(), 60000);
    }

    async startFirehose() {
        console.log("[Bot] Starting Firehose monitor...");
        const scriptPath = path.resolve(process.cwd(), "firehose_monitor.py");
        this.firehoseProcess = spawn("python3", [scriptPath]);
        this.firehoseProcess.stderr.on("data", (d) => console.error("[Firehose Error]", d.toString()));
    }

    async processNotification(notif) {
        if (!notif || !notif.author || !notif.record) return;
        if (this._detectInfiniteLoop(notif.uri)) return;

        const text = notif.record.text || "";
        const authorDid = notif.author.did;
        const isAdmin = notif.author.handle === config.ADMIN_BLUESKY_HANDLE;

        if (!isAdmin) {
            const boundary = checkHardCodedBoundaries(text);
            if (boundary.blocked) {
                await dataStore.setBoundaryLockout(authorDid, 30);
                return;
            }
            if (dataStore.isUserLockedOut(authorDid)) return;
        }

        if (isAdmin && discordService.status === "online") {
            await discordService.sendSpontaneousMessage(\`[PIVOT] @\${notif.author.handle} on Bluesky: "\${text}"\`);
        }

        const history = await this._getThreadHistory(notif.uri);
        const prePlan = await llmService.performPrePlanning(text, history, null, "bluesky", {}, {});
        const memories = await memoryService.getRecentMemories(20);
        let plan = await llmService.performAgenticPlanning(text, history, null, isAdmin, "bluesky", [], {}, {}, {}, {}, null, prePlan, { memories });
        const evaluation = await llmService.evaluateAndRefinePlan(plan, { platform: "bluesky", isAdmin });
        if (evaluation.decision === "proceed") {
            const actions = evaluation.refined_actions || plan.actions;
            for (const action of actions) await this.executeAction(action, { ...notif, platform: "bluesky" });
        }
    }

    async _getThreadHistory(uri) {
        try {
            const thread = await blueskyService.getDetailedThread(uri);
            return (thread || []).map(p => ({
                author: p.post.author.handle,
                role: p.post.author.did === blueskyService.did ? "assistant" : "user",
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

    async performSpecialistResearchProject(topic) {
        console.log(\`[Bot] Starting Specialist Research: \${topic}\`);
        try {
            const researcher = await llmService.performInternalInquiry(\`Deep research on: \${topic}. Identify facts.\`, "RESEARCHER");
            const report = \`[RESEARCH] Topic: \${topic}\\nFindings: \${researcher}\`;
            if (discordService.status === "online") await discordService.sendSpontaneousMessage(report);
        } catch (e) {}
    }
}

export { Bot };
export const bot = new Bot();

import { spawn, exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import config from "../config.js";
import { dataStore } from "./services/dataStore.js";
import { blueskyService } from "./services/blueskyService.js";
import { discordService } from "./services/discordService.js";
import { llmService } from "./services/llmService.js";
import { memoryService } from "./services/memoryService.js";
import { orchestratorService } from "./services/orchestratorService.js";
import { socialHistoryService } from "./services/socialHistoryService.js";
import { temporalService } from "./services/temporalService.js";
import { renderService } from "./services/renderService.js";
import { handleCommand } from "./utils/commandHandler.js";
import { checkHardCodedBoundaries } from "./utils/textUtils.js";

export class Bot {
    constructor() {
        this.firehoseProcess = null;
        this._notifHistory = [];
        this.lastImpulseTime = 0;
    }

    async init() {
        console.log("[Bot] Initializing services...");
        await dataStore.init();
        await blueskyService.init();
        discordService.init(this).catch(e => console.error("[Bot] Discord init error:", e));

        orchestratorService.setBotInstance(this);
        llmService.setDataStore(dataStore);
        llmService.setMemoryProvider(memoryService);
        llmService.setIdentities(dataStore.getAdminDid(), blueskyService.did);

        this.startNotificationPoll();
        this.startFirehose();

        setInterval(() => orchestratorService.heartbeat(), 300000);
        console.log("[Bot] All core services ready.");
    }

    async executeAction(action, context = {}) {
        const { tool, parameters } = action;
        console.log(`[Bot] Executing tool: ${tool}`, parameters);

        try {
            if (tool === "bluesky_post" || tool === "bsky_post") {
                // If context has a URI, it's a reply
                if (context.uri) {
                    const result = await blueskyService.postReply(context, parameters.text);
                    return { success: !!result };
                }
                const result = await blueskyService.post(parameters.text);
                return { success: !!result };
            }
            if (tool === "bluesky_reply" || tool === "bsky_reply") {
                const result = await blueskyService.postReply(context, parameters.text);
                return { success: !!result };
            }
            if (tool === "discord_message") {
                const result = await discordService._send(context.channel, parameters.text);
                return { success: !!result };
            }
            return { success: false, error: `Tool ${tool} not implemented.` };
        } catch (e) {
            console.error(`[Bot] Tool execution failed (${tool}):`, e);
            return { success: false, error: e.message };
        }
    }

    async startFirehose() {
        console.log("[Bot] Starting Firehose monitor...");
        try {
            const rawKeywords = dataStore.getDeepKeywords();
            const keywords = rawKeywords.map(k => k.replace(/[\\r\\n]/g, " ").trim()).filter(Boolean);
            const adminDid = dataStore.getAdminDid();
            let scriptPath = path.resolve(process.cwd(), "firehose_monitor.py");
            if (!(await fs.access(scriptPath).then(() => true).catch(() => false))) scriptPath = path.resolve(process.cwd(), "..", "firehose_monitor.py");
            const firehoseActors = [blueskyService.did, adminDid].filter(Boolean).join(",");
            const keywordsStr = keywords.join(",");

            this.firehoseProcess = spawn("python3", [scriptPath, "--keywords", keywordsStr, "--actors", firehoseActors]);

            this.firehoseProcess.stdout.on("data", async (data) => {
                data.toString().split("\n").forEach(async line => {
                    if (line.startsWith("MATCH:") || line.trim().startsWith("{")) {
                        try {
                            const jsonStr = line.startsWith("MATCH:") ? line.substring(6) : line;
                            const match = JSON.parse(jsonStr);
                            const now = Date.now();
                            const impulseCooldown = config.BACKOFF_DELAY || 600000;

                            if (match.type === "firehose_topic_match" && Math.random() < 0.2 && (now - this.lastImpulseTime > impulseCooldown)) {
                                console.log("[Bot] Firehose impulse triggered. Spacing out calls...");
                                this.lastImpulseTime = now;
                                orchestratorService.addTaskToQueue(() => orchestratorService.performAutonomousPost({ topic: match.matched_keywords?.[0] || "trending" }), "firehose_impulse");
                            }
                        } catch (e) {}
                    }
                });
            });

            this.firehoseProcess.on("close", (code) => {
                console.log(`[Firehose] Exited (${code}). Restarting in 60s...`);
                setTimeout(() => this.startFirehose(), 60000);
            });
        } catch (e) {
            console.error("[Bot] startFirehose failed:", e);
        }
    }

    startNotificationPoll() {
        setInterval(async () => {
            try {
                await new Promise(r => setTimeout(r, Math.random() * 10000));
                await this.catchUpNotifications();
            } catch (e) {}
        }, 120000);
    }

    async catchUpNotifications() {
        const response = await blueskyService.getNotifications();
        if (!response || response.notifications.length === 0) return;

        const unreadActionable = response.notifications.filter(notif => !notif.isRead && ['mention', 'reply', 'quote'].includes(notif.reason));
        if (unreadActionable.length === 0) return;

        for (const notif of unreadActionable.reverse()) {
            if (notif.author.did !== blueskyService.did) {
                try {
                    if (!await dataStore.hasReplied?.(notif.uri)) {
                        await this.processNotification(notif);
                        await new Promise(r => setTimeout(r, 2000));
                    }
                } catch (error) {}
            }
            await blueskyService.updateSeen(notif.indexedAt);
        }
    }

    async processNotification(notif) {
        if (this._detectInfiniteLoop(notif.uri)) return;
        const text = notif.record.text || "";
        const history = await this._getThreadHistory(notif.uri);
        const isAdmin = notif.author.handle === config.ADMIN_BLUESKY_HANDLE;

        if (checkHardCodedBoundaries(text).blocked) {
            await dataStore.setBoundaryLockout(notif.author.did, 30);
            return;
        }

        if (dataStore.isUserLockedOut(notif.author.did)) return;

        const prePlan = await llmService.performPrePlanning(text, history, null, "bluesky", dataStore.getMood(), {});

        // Don't reply to self unless it's a specific intent
        if (notif.author.did === blueskyService.did && prePlan.intent !== 'analytical') return;

        let plan = await llmService.performAgenticPlanning(text, history, null, isAdmin, "bluesky", dataStore.getExhaustedThemes(), {}, {}, {}, {}, null, prePlan, { memories: await memoryService.getRecentMemories(20) });
        const evaluation = await llmService.evaluateAndRefinePlan(plan, { platform: "bluesky", isAdmin });

        if (evaluation.decision === "proceed") {
            for (const action of (evaluation.refined_actions || plan.actions)) {
                await this.executeAction(action, { ...notif, platform: "bluesky" });
            }
        }
    }

    async _getThreadHistory(uri) {
        try {
            const thread = await blueskyService.getDetailedThread(uri);
            return (thread || []).map(p => ({ role: p.post.author.did === blueskyService.did ? "assistant" : "user", content: p.post.record.text }));
        } catch (e) { return []; }
    }

    _detectInfiniteLoop(uri) {
        const now = Date.now();
        this._notifHistory = this._notifHistory.filter(h => now - h.timestamp < 600000);
        const count = this._notifHistory.filter(h => h.uri === uri).length;
        if (count >= 3) return true;
        this._notifHistory.push({ uri, timestamp: now });
        return false;
    }

    async performAutonomousPost() {
        await orchestratorService.performAutonomousPost();
    }
}
export const bot = new Bot();

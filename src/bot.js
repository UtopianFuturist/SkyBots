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
        this.lastImpulseTime = 0;
        this.paused = false;
    }

    async init() {
        console.log("[Bot] Initializing services...");
        await dataStore.init();
        await blueskyService.init();
        await discordService.init(this);
        orchestratorService.setBotInstance(this);
        llmService.setDataStore(dataStore);
        llmService.setMemoryProvider(memoryService);
        llmService.setIdentities(dataStore.getAdminDid(), blueskyService.did);
        this.startNotificationPoll();
        this.startFirehose();
        setInterval(() => orchestratorService.heartbeat(), 300000);
        console.log("[Bot] Initialization complete.");
    }

    async executeAction(action, context = {}) {
        const { tool, parameters } = action;
        try {
            if (tool === "bsky_post" || tool === "bluesky_post") {
                if (context.uri) {
                    return { success: !!await blueskyService.postReply(context, parameters.text) };
                }
                return { success: !!await blueskyService.post(parameters.text) };
            }
            if (tool === "bsky_reply" || tool === "bluesky_reply") {
                return { success: !!await blueskyService.postReply(context, parameters.text) };
            }
            if (tool === "discord_message") {
                return { success: !!await discordService._send(context.channel, parameters.text) };
            }
            return { success: false, error: "Tool not implemented: " + tool };
        } catch (e) {
            console.error("[Bot] Action execution failed:", e);
            return { success: false, error: e.message };
        }
    }

    async startFirehose() {
        try {
            const rawKeywords = dataStore.getDeepKeywords();
            const keywords = rawKeywords.map(k => k.trim()).filter(Boolean);
            const adminDid = dataStore.getAdminDid();
            let scriptPath = path.resolve(process.cwd(), "firehose_monitor.py");
            if (!(await fs.access(scriptPath).then(() => true).catch(() => false))) scriptPath = path.resolve(process.cwd(), "..", "firehose_monitor.py");
            const firehoseActors = [blueskyService.did, adminDid].filter(Boolean).join(",");
            this.firehoseProcess = spawn("python3", [scriptPath, "--keywords", keywords.join(","), "--actors", firehoseActors]);
            this.firehoseProcess.stdout.on("data", async (data) => {
                data.toString().split("\n").forEach(async line => {
                    if (line.startsWith("MATCH:")) {
                        try {
                            const match = JSON.parse(line.substring(6));
                            const now = Date.now();
                            const cooldown = config.BACKOFF_DELAY || 300000;
                            if (match.type === "firehose_topic_match" && Math.random() < 0.2 && (now - this.lastImpulseTime > cooldown)) {
                                this.lastImpulseTime = now;
                                orchestratorService.addTaskToQueue(() => orchestratorService.performAutonomousPost({ topic: match.matched_keywords?.[0] || "trending" }), "firehose_impulse");
                            }
                        } catch (e) {}
                    }
                });
            });
            this.firehoseProcess.on("close", () => {
                setTimeout(() => this.startFirehose(), 60000);
            });
        } catch (e) {}
    }

    startNotificationPoll() {
        setInterval(async () => { try { await this.catchUpNotifications(); } catch (e) {} }, 120000);
    }

    async catchUpNotifications() {
        const response = await blueskyService.getNotifications();
        if (!response) return;
        const unreadActionable = response.notifications.filter(notif => !notif.isRead && ['mention', 'reply', 'quote'].includes(notif.reason));
        for (const notif of unreadActionable.reverse()) {
            if (notif.author.did !== blueskyService.did && !await dataStore.hasReplied?.(notif.uri)) {
                await this.processNotification(notif);
                await new Promise(r => setTimeout(r, 2000));
            }
            await blueskyService.updateSeen(notif.indexedAt);
        }
    }

    async processNotification(notif) {
        const text = notif.record.text || "";
        const history = await this._getThreadHistory(notif.uri);
        const isAdmin = notif.author.handle === config.ADMIN_BLUESKY_HANDLE;

        if (checkHardCodedBoundaries(text).blocked) {
            await dataStore.setBoundaryLockout(notif.author.did, 30);
            return;
        }
        if (dataStore.isUserLockedOut(notif.author.did)) return;

        const isSelf = notif.author.did === blueskyService.did;
        const prePlan = await llmService.performPrePlanning(text, history, null, "bluesky", {}, {});
        if (isSelf && prePlan.intent !== 'analytical') return;

        let plan = await llmService.performAgenticPlanning(text, history, null, isAdmin, "bluesky", [], {}, {}, {}, {}, null, prePlan, { memories: [] });
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

    async performDiscordPinnedGift() {}

    async performAutonomousPost() {
        await orchestratorService.performAutonomousPost();
    }
}
export const bot = new Bot();

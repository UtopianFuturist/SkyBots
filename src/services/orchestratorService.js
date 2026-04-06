import { blueskyService } from './blueskyService.js';
import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import { imageService } from './imageService.js';
import { googleSearchService } from './googleSearchService.js';
import { newsroomService } from './newsroomService.js';
import { memoryService } from './memoryService.js';
import { discordService } from './discordService.js';
import { socialHistoryService } from './socialHistoryService.js';
import { introspectionService } from './introspectionService.js';
import { temporalService } from './temporalService.js';
import { checkHardCodedBoundaries, isLiteralVisualPrompt, getSlopInfo, sanitizeThinkingTags } from '../utils/textUtils.js';
import * as prompts from '../prompts/index.js';
import config from '../../config.js';
import fs from "fs";

const AUTONOMOUS_POST_SYSTEM_PROMPT = (followerCount) => prompts.system.AUTONOMOUS_POST_SYSTEM_PROMPT(followerCount);

class OrchestratorService {
    constructor() {
        this.taskQueue = [];
        this.isProcessingQueue = false;
        this.bot = null;
    }

    setBotInstance(bot) { this.bot = bot; }

    async addTaskToQueue(taskFn, taskName = 'anonymous_task') {
        this.taskQueue.push({ fn: taskFn, name: taskName });
        if (!this.isProcessingQueue) this.processQueue();
    }

    async processQueue() {
        if (this.isProcessingQueue || this.taskQueue.length === 0) return;
        this.isProcessingQueue = true;
        while (this.taskQueue.length > 0) {
            const task = this.taskQueue.shift();
            try { await task.fn(); } catch (e) { console.error(`[Orchestrator] Error in ${task.name}:`, e); }
        }
        this.isProcessingQueue = false;
    }

    async getUnifiedContext() {
        const discordHistory = (await discordService.fetchAdminHistory(5)) || [];
        const blueskyHistory = (await dataStore.getRecentInteractions()) || [];
        const lastDiscordMsg = discordHistory[0]?.timestamp || 0;
        const lastBlueskyMsg = blueskyHistory[0]?.timestamp || 0;
        const adminEnergy = dataStore.getAdminEnergy();
        const mood = dataStore.getMood();
        const temporalContext = await temporalService.getEnhancedTemporalContext();

        return {
            last_interaction_platform: lastDiscordMsg > lastBlueskyMsg ? 'discord' : 'bluesky',
            time_since_admin_contact: Date.now() - Math.max(lastDiscordMsg, lastBlueskyMsg),
            admin_energy: adminEnergy,
            current_mood: mood,
            temporal_context: temporalContext,
            network_sentiment: dataStore.getNetworkSentiment()
        };
    }

    async performAutonomousPost() {
        const dailyStats = dataStore.getDailyStats();
        const dailyLimits = dataStore.getDailyLimits();
        if (dailyStats.text_posts >= dailyLimits.text && dailyStats.image_posts >= dailyLimits.image) return;

        try {
            const unifiedContext = await this.getUnifiedContext();
            let choice = Math.random() < 0.3 ? "image" : "text";

            if (choice === "image") {
                const topicRes = await llmService.generateResponse([{ role: "system", content: `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}. Identify a visual topic. Context: ${JSON.stringify(unifiedContext)}. Respond JSON: {"topic": "label", "prompt": "stylized artistic prompt"}.` }], { useStep: true });
                let tData = { topic: "reality", prompt: "" };
                try {
                    const match = topicRes.match(/\{[\s\S]*\}/);
                    tData = match ? JSON.parse(match[0]) : tData;
                } catch(e) {}
                await this._performHighQualityImagePost(tData.prompt || tData.topic, tData.topic);
            } else {
                const topicRaw = await llmService.generateResponse([{ role: "system", content: `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}. Identify a text topic. Context: ${JSON.stringify(unifiedContext)}. Respond with ONLY the topic.` }], { useStep: true });
                const topic = topicRaw?.trim() || "existence";
                const contentPrompt = `${AUTONOMOUS_POST_SYSTEM_PROMPT(0)}\nContext: ${JSON.stringify(unifiedContext)}\nTopic: ${topic}\nShared thought:`;

                let content = await llmService.generateResponse([{ role: "system", content: contentPrompt }], { useStep: true });
                const audit = await llmService.performRealityAudit(unifiedContext.temporal_context + "\n" + content);

                if (audit.hallucination_detected) {
                    content = await llmService.generateResponse([{ role: "system", content: `${contentPrompt}\n\nCRITIQUE: ${audit.critique}. Ground the version: ${content}` }], { useStep: true });
                }

                if (content) {
                    await blueskyService.post(content);
                    await dataStore.incrementDailyTextPosts();
                    await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                }
            }
        } catch (e) { console.error("[Orchestrator] Autonomous post error:", e); }
    }

    async _performHighQualityImagePost(prompt, topic) {
        let attempts = 0;
        while (attempts < 3) {
            attempts++;
            const res = await imageService.generateImage(prompt, { allowPortraits: false });
            if (res?.buffer) {
                const vision = await llmService.analyzeImage(res.buffer.toString('base64'));
                let caption = await llmService.generateResponse([{ role: "system", content: `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}. You generated this image: "${vision}". Write a caption under 300 chars.` }], { useStep: true });

                const audit = await llmService.performRealityAudit(caption);
                if (audit.hallucination_detected) {
                    caption = await llmService.generateResponse([{ role: "system", content: `Adopt persona. CRITIQUE: ${audit.critique}. Refine: ${caption}` }], { useStep: true });
                }

                if (caption) {
                    const blob = await blueskyService.uploadBlob(res.buffer);
                    if (blob?.data?.blob) {
                        const embed = { $type: "app.bsky.embed.images", images: [{ image: blob.data.blob, alt: topic }] };
                        await blueskyService.post(caption, embed);
                        await dataStore.incrementDailyImagePosts();
                        return true;
                    }
                }
            }
        }
        return false;
    }

    async heartbeat() {
        const now = Date.now();
        const lastPostTime = dataStore.getLastAutonomousPostTime();
        const lastPost = lastPostTime ? new Date(lastPostTime).getTime() : 0;
        if (now - lastPost >= (config.AUTONOMOUS_POST_COOLDOWN || 6) * 3600000) {
            this.addTaskToQueue(() => this.performAutonomousPost(), "autonomous_post");
        }
        this.addTaskToQueue(() => this.performSpontaneityCheck(), "spontaneity_check");

        // Maintenance
        this.checkMaintenanceTasks();
    }

    async performSpontaneityCheck() {
        if (this.bot?.paused) return;

        const tz = dataStore.getAdminTimezone();
        const now = new Date();
        const adminLocalTime = new Date(now.getTime() + (tz.offset * 60 * 1000));
        const hour = adminLocalTime.getHours();

        // 7. Proactive window finder: Sleep suppression (11 PM - 7 AM)
        if (hour >= 23 || hour < 7) return;

        const history = await discordService.fetchAdminHistory(10);
        const impulse = await llmService.performImpulsePoll(history);
        if (impulse?.impulse_detected) await discordService.sendSpontaneousMessage();
    }

    async checkMaintenanceTasks() {
        const now = Date.now();
        const heavyTasks = [
            { name: "Newsroom", method: "performNewsroomUpdate", interval: 3 * 3600000, key: "last_newsroom_update" },
            { name: "ScoutMission", method: "performScoutMission", interval: 4 * 3600000, key: "last_scout_mission" },
            { name: "PersonaAudit", method: "performPersonaAudit", interval: 6 * 3600000, key: "last_persona_audit" }
        ];

        for (const task of heavyTasks) {
            const lastRun = dataStore.db.data[task.key] || 0;
            if (now - lastRun >= task.interval) {
                await this[task.method]();
                dataStore.db.data[task.key] = now;
                await dataStore.db.write();
            }
        }

        if (now - (dataStore.db.data.last_pruning || 0) >= 4 * 3600000) {
            await dataStore.pruneOldData();
            dataStore.db.data.last_pruning = now;
            await dataStore.db.write();
        }
    }

    async performNewsroomUpdate() {
        try {
            const topics = dataStore.getConfig().post_topics || [];
            const brief = await newsroomService.getDailyBrief(topics);
            if (brief?.new_keywords?.length > 0) {
                const current = dataStore.db.data.deep_keywords || [];
                dataStore.db.data.deep_keywords = [...new Set([...current, ...brief.new_keywords])].slice(-50);
                if (this.bot) this.bot.restartFirehose?.();
            }
        } catch (e) {}
    }

    async performScoutMission() {
        try {
            const timeline = await blueskyService.getTimeline(20);
            const orphaned = timeline.filter(t => t.post?.replyCount === 0);
            if (orphaned.length > 0) {
                const post = orphaned[0].post;
                const response = await llmService.generateResponse([{ role: 'system', content: `You are 'The Scout'. Select an orphaned post and suggest a reply.` }], { useStep: true });
                if (response) await blueskyService.postReply(post, response);
            }
        } catch (e) {}
    }

    async performPersonaAudit() {
        try {
            const blurbs = dataStore.getPersonaBlurbs();
            const res = await llmService.generateResponse([{ role: 'system', content: `Audit persona blurbs for consistency. BLURBS: ${JSON.stringify(blurbs)}. Respond JSON: {"removals": [], "suggestion": ""}` }], { useStep: true });
            const audit = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
            if (audit.removals?.length) {
                const newBlurbs = blurbs.filter(b => !audit.removals.includes(b.uri));
                await dataStore.setPersonaBlurbs(newBlurbs);
            }
            if (audit.suggestion) await dataStore.addPersonaBlurb(audit.suggestion);
        } catch (e) {}
    }

    async start() { console.log('[Orchestrator] Cycles started.'); }
}

export const orchestratorService = new OrchestratorService();

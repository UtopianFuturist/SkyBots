import { dataStore } from './dataStore.js';
import { llmService } from './llmService.js';
import { blueskyService } from './blueskyService.js';
import { discordService } from './discordService.js';
import { memoryService } from './memoryService.js';
import { newsroomService } from './newsroomService.js';
import { evaluationService } from './evaluationService.js';
import { introspectionService } from './introspectionService.js';
import { imageService } from './imageService.js';
import { openClawService } from './openClawService.js';
import config from '../../config.js';
import { isLiteralVisualPrompt, isSlop } from '../utils/textUtils.js';
import path from 'path';
import fs from 'fs/promises';

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
            try { await task.fn(); } catch (e) { console.error(`[Orchestrator] Task failed: ${task.name}`, e); }
        }
        this.isProcessingQueue = false;
    }

    async heartbeat() {
        if (this.bot?.paused) return;
        console.log('[Orchestrator] Heartbeat Pulse...');
        const now = Date.now();
        const lastPost = dataStore.getLastAutonomousPostTime() || 0;
        const lastPostMs = typeof lastPost === 'string' ? new Date(lastPost).getTime() : lastPost;
        const cooldown = (config.AUTONOMOUS_POST_COOLDOWN || 6) * 3600000;
        if (now - lastPostMs >= cooldown) {
            this.addTaskToQueue(() => this.performAutonomousPost(), "autonomous_post");
        }
    }

    async performAutonomousPost(options = {}) {
        const dailyStats = dataStore.getDailyStats();
        const dailyLimits = dataStore.getDailyLimits();
        if (dailyStats.text_posts >= dailyLimits.text && dailyStats.image_posts >= dailyLimits.image) {
            console.log("[Orchestrator] Daily posting limits reached. Skipping autonomous post.");
            return;
        }

        try {
            console.log("[Orchestrator] Starting autonomous post...");
            let resonanceTopics = [];
            try {
                const timeline = await blueskyService.getTimeline(20);
                const allContent = (timeline?.data?.feed || []).map(f => f.post.record.text).join('\n');
                if (allContent) {
                    const resonancePrompt = "Identify 3 deep topics. Respond with ONLY comma-separated topics. Text: " + allContent.substring(0, 1000);
                    const res = await llmService.generateResponse([{ role: "system", content: resonancePrompt }], { useStep: true });
                    if (res) resonanceTopics = res.split(",").map(t => t.trim());
                }
            } catch (e) {}

            const decisionPrompt = "Decide: Share image or text? JSON: {\"choice\": \"image\"|\"text\", \"mode\": \"SINCERE\"}";
            const decisionRes = await llmService.generateResponse([{ role: "system", content: decisionPrompt }], { useStep: true });
            let pollResult = llmService.extractJson(decisionRes) || { choice: "text", mode: "SINCERE" };

            if (pollResult.choice === "image" || options.forceImage) {
                await this._performHighQualityImagePost(resonanceTopics[0] || "existence");
            } else {
                const topic = options.topic || resonanceTopics[0] || "existence";
                const draftPrompt = "Write a post about: " + topic + ". Follow ANTI-SLOP MANDATE. Raw text ONLY.";
                let content = await llmService.generateResponse([{ role: "user", content: draftPrompt }], { platform: "bluesky" });
                if (content) {
                    const result = await blueskyService.post(content);
                    if (result) {
                        await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                        await dataStore.incrementDailyTextPosts();
                        await introspectionService.performAAR("autonomous_text_post", content, { success: true });
                    }
                }
            }
        } catch (e) { console.error("[Orchestrator] Autonomous post failed:", e); }
    }

    async _performHighQualityImagePost(topic) {
        console.log("[Orchestrator] Starting image post flow for: " + topic);
        const result = await this._generateVerifiedImagePost(topic);
        if (result && result.buffer) {
            const postResult = await blueskyService.post(result.caption, { image: result.buffer });
            if (postResult) {
                await dataStore.updateLastBlueskyImagePostTime(new Date().toISOString());
                await dataStore.incrementDailyImagePosts();
                return postResult;
            }
        }
        return null;
    }

    async _generateVerifiedImagePost(topic) {
        let attempts = 0;
        let imagePrompt = topic;
        while (attempts < 5) {
            attempts++;
            console.log(`[Orchestrator] Image post attempt ${attempts} for topic: ${topic}`);
            const slopInfo = isSlop(imagePrompt);
            const literalCheck = isLiteralVisualPrompt(imagePrompt);
            if (!slopInfo && literalCheck.isLiteral && imagePrompt.length >= 15) {
                const gen = await imageService.generateImage(imagePrompt);
                if (gen && gen.buffer) return { buffer: gen.buffer, caption: topic, finalPrompt: imagePrompt };
            }
            const retryPrompt = "Adopt persona. Provide a literal artistic visual description. Topic: " + topic + ". Generate NEW artistic image prompt:";
            imagePrompt = await llmService.generateResponse([{ role: "system", content: retryPrompt }], { useStep: true }) || topic;
        }
        // Force attempt if loop fails
        const finalPrompt = topic + ", cinematic oil painting, artstation style, high detail";
        const gen = await imageService.generateImage(finalPrompt);
        if (gen && gen.buffer) return { buffer: gen.buffer, caption: topic, finalPrompt };
        return null;
    }
}
export const orchestratorService = new OrchestratorService();

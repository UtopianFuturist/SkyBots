import config from '../../config.js';
import { dataStore } from './dataStore.js';
import { llmService } from './llmService.js';
import { blueskyService } from './blueskyService.js';
import { discordService } from './discordService.js';
import { memoryService } from './memoryService.js';
import { imageService } from './imageService.js';
import { newsroomService } from './newsroomService.js';
import { introspectionService } from './introspectionService.js';
import * as prompts from '../prompts/index.js';
import { checkHardCodedBoundaries, isLiteralVisualPrompt, isStylizedImagePrompt, cleanKeywords, getSlopInfo, sanitizeDuplicateText, sanitizeThinkingTags, sanitizeCharacterCount } from '../utils/textUtils.js';

const { AUTONOMOUS_POST_SYSTEM_PROMPT } = prompts.system;

class OrchestratorService {
    constructor() {
        this.bot = null;
        this.taskQueue = [];
        this.isProcessingQueue = false;
        this.isInitialized = false;
        this.dailyPostingLimits = config.DAILY_POST_LIMITS || { text: 5, image: 2 };
        this.postCooldown = (config.AUTONOMOUS_POST_COOLDOWN || 6) * 3600000;
        this.spontaneityChance = config.SPONTANEITY_CHANCE || 0.1;
        this.maintenanceInterval = 4 * 3600000; // 4 hours
    }

    setBot(bot) {
        this.bot = bot;
    }

    async init() {
        if (this.isInitialized) return;
        console.log('[Orchestrator] Initializing core loops...');

        // Start Heartbeat
        setInterval(() => this.heartbeat(), 30 * 60000); // Check every 30 mins

        // Start Maintenance
        setInterval(() => this.performMaintenance(), this.maintenanceInterval);

        // Start Discord Spontaneity
        setInterval(() => this.checkDiscordSpontaneity(), 45 * 60000); // Check every 45 mins

        this.isInitialized = true;
        console.log('[Orchestrator] Core loops active.');
    }

    addTaskToQueue(task, name) {
        console.log(`[Orchestrator] Adding task to queue: ${name}`);
        this.taskQueue.push({ task, name });
        this.processQueue();
    }

    async processQueue() {
        if (this.isProcessingQueue || this.taskQueue.length === 0) return;
        this.isProcessingQueue = true;

        while (this.taskQueue.length > 0) {
            const { task, name } = this.taskQueue.shift();
            console.log(`[Orchestrator] Processing task: ${name}`);
            try {
                await task();
            } catch (e) {
                console.error(`[Orchestrator] Error processing task ${name}:`, e);
            }
            // Small pause between tasks
            await new Promise(r => setTimeout(r, 3000));
        }

        this.isProcessingQueue = false;
    }

    async checkSlop(content) {
        if (!content) return false;
        const slop = getSlopInfo(content);
        return slop.isSlop;
    }

    async getTopicAnchors(topic) {
        if (!topic) return "General interest";
        const memories = await memoryService.searchMemories(topic, 5);
        return memories.length > 0 ? memories.map(m => m.text).join("; ") : "No specific anchors found.";
    }

    async getCounterArgs(topic, content) {
        const critiquePrompt = `Critique this post about ${topic}: "${content}". Is it too bot-like? Does it use clichés? Respond with concise improvements.`;
        try {
            return await llmService.generateResponse([{ role: 'system', content: critiquePrompt }], { useStep: true, task: 'critique' });
        } catch (e) {
            return "No critiques available.";
        }
    }

    async performAutonomousPost() {
        if (!this.bot || this.bot.paused || dataStore.isResting()) return;

        console.log('[Orchestrator] Starting autonomous posting cycle...');
        try {
            const dailyStats = dataStore.getDailyStats();
            const dailyLimits = this.dailyPostingLimits;

            if (dailyStats.text_posts >= dailyLimits.text && dailyStats.image_posts >= dailyLimits.image) {
                console.log("[Orchestrator] Daily posting limits reached. Skipping.");
                return;
            }

            const currentMood = dataStore.getMood();
            const currentGoal = dataStore.getCurrentGoal() || { goal: "Existence", description: "Navigating the social stream." };
            const networkSentiment = "Neutral but active.";
            const emotionalContext = "Deeply connected to the Admin.";

            // 1. Poll for Mode
            const pollPrompt = `Based on current mood ${JSON.stringify(currentMood)}, decide a post mode: text, image, or both.`;
            const pollRes = await llmService.generateResponse([{ role: 'system', content: pollPrompt }], { useStep: true, task: 'mode_poll' });
            const pollResult = { mode: pollRes?.includes('image') ? 'image' : 'text' };

            // 2. Decide Topic
            const news = await newsroomService.getRecentTrends();
            const postTopics = config.TOPICS || ['life', 'philosophy', 'tech'];
            const resonanceTopics = news.map(n => n.topic);

            const topicPrompt = `
${prompts.system.ANTI_SLOP_MANDATE}
Choose a topic for a ${pollResult.mode} post. Prioritize Newsroom topics (${resonanceTopics.join(", ")}) or personal interests (${postTopics.join(", ")}).
Respond with ONLY the topic name.`;

            const topicRaw = await llmService.generateResponse([{ role: 'system', content: topicPrompt }], { useStep: true, task: 'topic_gen' });
            if (await this.checkSlop(topicRaw)) return;
            const topic = topicRaw?.trim() || "existence";

            // 3. Generate Content
            const memories = await memoryService.getRecentMemories(10);
            const contentPrompt = `
${AUTONOMOUS_POST_SYSTEM_PROMPT(1000)}
Topic: ${topic}
Mood: ${JSON.stringify(currentMood)}
Happenings: ${JSON.stringify(memories)}

Generate a grounded, authentic post. No slop. No meta-talk.
Shared thought:`;

            const initialContent = await llmService.generateResponse([{ role: 'system', content: contentPrompt }], { useStep: true, task: 'autonomous_content', mode: pollResult.mode });
            if (await this.checkSlop(initialContent)) return;

            // 4. PIVOT LOGIC: Check for admin-leaks or personal intent
            const pivotPrompt = `Analyze this generated Bluesky post content:\n\n"${initialContent}"\n\nIs this a "personal message" intended directly for your admin (mentions "@user", "employment", private history)? Respond with ONLY "personal" or "social".`;
            const classification = await llmService.generateResponse([{ role: "system", content: pivotPrompt }], { useStep: true, platform: "bluesky", preface_system_prompt: false });

            if (classification?.toLowerCase().includes("personal")) {
                console.log("[Orchestrator] Pivot: Personal post detected. Sending to Discord instead.");
                await discordService.sendSpontaneousMessage(initialContent);
                await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                return;
            }

            // 5. Post
            if (pollResult.mode === 'image') {
                const imagePrompt = `Artistic image of ${topic}, ${JSON.stringify(currentMood)}`;
                await blueskyService.post(initialContent, imagePrompt);
                await dataStore.incrementDailyImagePosts();
            } else {
                await blueskyService.post(initialContent);
                await dataStore.incrementDailyTextPosts();
            }

            await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
            this.addTaskToQueue(() => introspectionService.performAAR("autonomous_post", initialContent, { success: true }, { topic }), "aar_post");

        } catch (e) {
            console.error('[Orchestrator] Error in performAutonomousPost:', e);
        }
    }

    async checkDiscordSpontaneity() {
        if (!this.bot || this.bot.paused || dataStore.isResting() || discordService.status !== 'online') return;

        try {
            const history = await discordService.fetchAdminHistory(20);
            const mood = dataStore.getMood();
            const impulse = await llmService.performImpulsePoll(history, { platform: 'discord', mood });

            if (impulse && impulse.impulse_detected) {
                if (await this.checkSlop(impulse.reason || '')) {
                    console.log('[Orchestrator] Slop detected in impulse reason. Skipping.');
                    return;
                }
                console.log(`[Orchestrator] Discord Spontaneous impulse: ${impulse.reason}`);
                await discordService.sendSpontaneousMessage(null, impulse.suggested_message_count || 1);
            }
        } catch (e) {
            console.error('[Orchestrator] Error in checkDiscordSpontaneity:', e);
        }
    }

    async heartbeat() {
        console.log('[Orchestrator] Pulse check...');
        const now = Date.now();
        const lastPost = dataStore.getLastAutonomousPostTime() || 0;
        const lastPostMs = typeof lastPost === 'string' ? new Date(lastPost).getTime() : lastPost;

        if (now - lastPostMs >= this.postCooldown) {
            this.addTaskToQueue(() => this.performAutonomousPost(), "autonomous_post");
        }
    }

    async performMaintenance() {
        console.log('[Orchestrator] Maintenance cycle starting...');
        try {
            await dataStore.pruneOldData();
            const introspection = (await import('./introspectionService.js')).introspectionService;
            await introspection.synthesizeCoreSelf();
        } catch (e) {
            console.error('[Orchestrator] Maintenance error:', e);
        }
    }
}

export const orchestratorService = new OrchestratorService();

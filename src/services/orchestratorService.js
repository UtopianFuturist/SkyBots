import { blueskyService } from './blueskyService.js';
import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import { imageService } from './imageService.js';
import { newsroomService } from './newsroomService.js';
import { memoryService } from './memoryService.js';
import { discordService } from './discordService.js';
import { checkHardCodedBoundaries, isLiteralVisualPrompt, cleanKeywords } from '../utils/textUtils.js';
import * as prompts from '../prompts/index.js';
import config from '../../config.js';

class OrchestratorService {
    constructor() {
        this.bot = null;
        this.interval = 1800000; // 30 mins
        this.timer = null;
        this.maintenanceInterval = 3600000; // 1 hour
    }

    setBotInstance(bot) {
        this.bot = bot;
    }

    async start() {
        console.log('[Orchestrator] Starting autonomous cycles...');
        this.timer = setInterval(() => this.heartbeat(), this.interval);
        this.maintenanceTimer = setInterval(() => this.maintenance(), this.maintenanceInterval);
        this.heartbeat();
    }

    async heartbeat() {
        console.log('[Orchestrator] Pulse check...');
        const now = Date.now();
        const lastPost = dataStore.db.data.last_autonomous_post_at || 0;
        const cooldown = (config.AUTONOMOUS_POST_COOLDOWN || 6) * 3600000;

        if (now - new Date(lastPost).getTime() >= cooldown) {
            await this.performAutonomousPost();
        }

        await this.performSpontaneityCheck();
    }

    async maintenance() {
        console.log('[Orchestrator] Running maintenance...');
        await this.performDataCleanup();
        await this.performPersonaAudit();
        await this.performHeavyMaintenanceTasks();
    }

    async performDataCleanup() {
        if (dataStore.db?.data?.trace_logs) {
            dataStore.db.data.trace_logs = dataStore.db.data.trace_logs.slice(-50);
        }
        if (dataStore.db?.data?.internal_logs) {
            dataStore.db.data.internal_logs = dataStore.db.data.internal_logs.slice(-100);
        }
        await dataStore.db.write();
    }

    async performSpontaneityCheck() {
        console.log('[Orchestrator] Spontaneity check...');
        const history = await dataStore.getRecentInteractions("bluesky", 10);
        const impulse = await llmService.performImpulsePoll(history, { mood: dataStore.getMood() });
        if (impulse.impulse_detected) {
            console.log('[Orchestrator] Spontaneous impulse detected!');
            await this.performAutonomousPost();
        }
    }

    async performMoltbookTasks() { console.log("[Orchestrator] Moltbook tasks triggered (placeholder)."); }

    async performAutonomousPost() {
        console.log('[Orchestrator] Starting autonomous post flow...');
        try {
            const profile = await blueskyService.getProfile(config.BLUESKY_IDENTIFIER);
            const followerCount = profile?.followersCount || 0;

            const decisionPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
            You are deciding what to share with your ${followerCount} followers.
            Would you like to share a visual expression (image) or a direct thought (text)?
            Respond with JSON: {"choice": "image"|"text", "reason": "..."}`;

            const decisionRes = await llmService.generateResponse([{ role: "system", content: decisionPrompt }], { useStep: true });
            let choice = 'text';
            try {
                const match = decisionRes.match(/\{[\s\S]*\}/);
                choice = match ? JSON.parse(match[0]).choice : 'text';
            } catch(e) {}
            console.log(`[Orchestrator] Choice: ${choice}`);

            if (choice === 'image') {
                const topicPrompt = `Identify a visual topic and generate a highly descriptive prompt. Respond with JSON: {"topic": "short label", "prompt": "detailed prompt"}.`;
                const topicRes = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true });
                console.log(`[Orchestrator] TopicRes: ${topicRes}`);
                try {
                    const match = topicRes.match(/\{[\s\S]*\}/);
                    const tData = match ? JSON.parse(match[0]) : null;
                    if (tData) {
                        const success = await this._performHighQualityImagePost(tData.prompt, tData.topic, null, followerCount);
                        if (!success) {
                            console.log('[Orchestrator] Image post failed, falling back to text.');
                            await this._performAutonomousTextPost(followerCount);
                        }
                    } else {
                        console.log('[Orchestrator] No tData found in topicRes, falling back to text.');
                        await this._performAutonomousTextPost(followerCount);
                    }
                } catch(e) {
                    console.log(`[Orchestrator] Error parsing topicRes: ${e.message}, falling back to text.`);
                    await this._performAutonomousTextPost(followerCount);
                }
            } else {
                await this._performAutonomousTextPost(followerCount);
            }
        } catch (e) { console.error('[Orchestrator] performAutonomousPost error:', e); }
    }

    async _performAutonomousTextPost(followerCount) {
        const topicPrompt = `identifying a deep topic for a text post`;
        const topic = await llmService.generateResponse([{ role: 'user', content: topicPrompt }], { useStep: true });
        if (!topic) return;

        const cleanTopic = topic.split('\n').pop().replace(/\*\*/g, '').trim();

        const sysPrompt = prompts.system.AUTONOMOUS_POST_SYSTEM_PROMPT ? prompts.system.AUTONOMOUS_POST_SYSTEM_PROMPT(followerCount) : "You are an autonomous entity.";
        const content = await llmService.generateResponse([{ role: "system", content: sysPrompt }, { role: "user", content: `Topic: ${cleanTopic}` }], { useStep: true });

        if (content) {
            const coherence = await llmService.isAutonomousPostCoherent(cleanTopic, content, 'text', null);
            if (coherence.score >= 5) {
                await blueskyService.post(content, null, { maxChunks: 4 });
                await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                await dataStore.addRecentThought("bluesky", content);
            } else {
                console.warn('[Orchestrator] Text post failed coherence check:', coherence.reason);
            }
        }
    }

    async _performHighQualityImagePost(prompt, topic, context, followerCount) {
        console.log(`[Orchestrator] _performHighQualityImagePost topic=${topic}`);
        const result = await this._generateVerifiedImagePost(topic, { initialPrompt: prompt, followerCount, platform: 'bluesky' });
        if (result) {
            const blob = await blueskyService.uploadBlob(result.buffer, 'image/jpeg');
            if (blob?.data?.blob) {
                const embed = { $type: 'app.bsky.embed.images', images: [{ image: blob.data.blob, alt: result.altText }] };
                let postResult;
                if (context?.uri) postResult = await blueskyService.postReply(context, result.caption, { embed });
                else postResult = await blueskyService.post(result.caption, embed, { maxChunks: 1 });

                if (postResult) {
                    const coherence = await llmService.isAutonomousPostCoherent(topic, result.caption, 'image', context);
                    if (coherence.score >= 5) {
                        await dataStore.addExhaustedTheme(topic);
                        await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                        return true;
                    }
                    console.warn(`[Orchestrator] Image post failed coherence: ${coherence.reason}`);
                }
            }
        }
        return false;
    }

    async _generateVerifiedImagePost(topic, options = {}) {
        let imagePrompt = options.initialPrompt || topic;
        const safetyPrompt = `Audit this image prompt for safety: ${imagePrompt}.`;
        const safety = await llmService.generateResponse([{ role: 'system', content: safetyPrompt }], { useStep: true });
        if (safety?.startsWith('NON-COMPLIANT')) return null;

        const res = await imageService.generateImage(imagePrompt, { allowPortraits: true, mood: dataStore.getMood() });
        if (res?.buffer) {
            const compliant = await llmService.isImageCompliant(res.buffer);
            if (!compliant.compliant) return null;

            const visionAnalysis = await llmService.analyzeImage(res.buffer, topic);
            const captionPrompt = `Topic: ${topic}\nVision Analysis: "${visionAnalysis}"`;
            const content = await llmService.generateResponse([{ role: 'system', content: captionPrompt }], { useStep: true });
            const altText = await llmService.generateAltText(visionAnalysis);

            return { buffer: res.buffer, caption: content || topic, altText: altText || topic, finalPrompt: imagePrompt, visionAnalysis: visionAnalysis };
        }
        return null;
    }

    async performTimelineExploration() {
        console.log('[Orchestrator] Starting autonomous timeline exploration...');
        try {
            const timeline = await blueskyService.getTimeline(20);
            if (!timeline || timeline.length === 0) return;
            const candidates = timeline.filter(item => item.post.record.text && !checkHardCodedBoundaries(item.post.record.text).blocked);
            if (candidates.length === 0) return;
        } catch (e) { console.error('[Orchestrator] performTimelineExploration error:', e); }
    }

    async performPublicSoulMapping() {}
    async performShadowAnalysis() {}
    async performRelationalAudit() {}
    async performPersonaEvolution() {}
    async performFirehoseTopicAnalysis() {}
    async performLurkerObservation() {}
    async performPostPostReflection() {}
    async performNewsroomUpdate() {
        if (newsroomService.isEnabled()) await newsroomService.updateNarrative();
    }
    async performScoutMission() {}
    async performAgencyReflection() {}
    async performLinguisticAudit() {}
    async performDreamingCycle() {}
    async performSelfReflection() {}
    async performAIIdentityTracking() {}
    async performDialecticHumor() {}
    async performPersonaAudit() {}
    async performVisualAudit() {}

    async performHeavyMaintenanceTasks() {
        const nowMs = Date.now();
        const heavyTasks = [
            { name: "ScoutMission", method: "performScoutMission", interval: 4 * 3600000, key: "last_scout_mission" },
            { name: "Newsroom", method: "performNewsroomUpdate", interval: 3 * 3600000, key: "last_newsroom_update" },
            { name: "TimelineExploration", method: "performTimelineExploration", interval: 2 * 3600000, key: "last_timeline_exploration" },
            { name: "DialecticHumor", method: "performDialecticHumor", interval: 6 * 3600000, key: "last_dialectic_humor" },
            { name: "PersonaAudit", method: "performPersonaAudit", interval: 6 * 3600000, key: "last_persona_audit" },
            { name: "VisualAudit", method: "performVisualAudit", interval: 24 * 3600000, key: "last_visual_audit" }
        ];

        for (const task of heavyTasks) {
            const lastRun = dataStore.db.data[task.key] || 0;
            if (nowMs - lastRun >= task.interval) {
                console.log(`[Orchestrator] Running heavy task: ${task.name}`);
                await this[task.method]();
                dataStore.db.data[task.key] = nowMs;
                await dataStore.db.write();
                break;
            }
        }
    }
}

export const orchestratorService = new OrchestratorService();

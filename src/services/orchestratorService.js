import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import { memoryService } from './memoryService.js';
import { blueskyService } from './blueskyService.js';
import { discordService } from './discordService.js';
import { evaluationService } from './evaluationService.js';
import { newsroomService } from './newsroomService.js';
import { imageService } from './imageService.js';
import { googleSearchService } from './googleSearchService.js';
import { wikipediaService } from './wikipediaService.js';
import { webReaderService } from './webReaderService.js';
import { socialHistoryService } from './socialHistoryService.js';
import config from '../../config.js';
import * as prompts from '../prompts/index.js';
import { sanitizeThinkingTags, isLiteralVisualPrompt, getSlopInfo, cleanKeywords, checkHardCodedBoundaries, sanitizeCharacterCount, isSlop, checkSimilarity } from '../utils/textUtils.js';
import fs from 'fs/promises';

const delay = ms => new Promise(res => setTimeout(res, ms));

class OrchestratorService {
    constructor() {
        this.bot = null;
        this.lastRelationalGrowthTime = 0;
        this.lastLurkerObservationTime = 0;
        this.lastFirehoseTopicAnalysis = 0;
        this.lastDialecticHumor = 0;
        this.lastAIIdentityTracking = 0;
        this.lastSelfReflectionTime = 0;
        this.lastMoodSyncTime = 0;
    }
    setBotInstance(bot) { this.bot = bot; }

    async heartbeat() {
        console.log("[Orchestrator] Heartbeat pulse.");
        if (dataStore.isResting()) return;

        const lastDiscord = dataStore.db.data.discord_last_interaction || 0;
        const lastBluesky = dataStore.db.data.last_notification_processed_at || 0;
        const isChatting = (Date.now() - Math.max(lastDiscord, lastBluesky)) < 4 * 60 * 1000;

        if (isChatting || discordService.isResponding) {
            console.log("[Orchestrator] Active conversation detected. Prioritizing social responsiveness over maintenance.");
            return;
        }

        try {
            await this.checkDiscordScheduledTasks();
            await delay(1000);
            await this.checkMaintenanceTasks();
            await delay(1000);
            await this.checkDiscordSpontaneity();

            const lastPostTime = dataStore.getLastAutonomousPostTime();
            const timeSinceLastPost = lastPostTime ? Math.floor((Date.now() - new Date(lastPostTime).getTime()) / (1000 * 60)) : 999;
            const lastInteraction = Math.max(lastDiscord, lastBluesky, dataStore.db.data.last_notification_processed_at || 0);
            const timeSinceLastInteraction = lastInteraction ? Math.floor((Date.now() - lastInteraction) / (1000 * 60)) : 999;

            const orchestratorPrompt = `You are ${config.BOT_NAME}. It is ${new Date().toLocaleString()}.
It has been ${timeSinceLastPost} minutes since your last autonomous post.
It has been ${timeSinceLastInteraction} minutes since your last interaction (reply/response) with a user.

Decide your next action: ["post", "rest", "reflect", "explore"].
**CRITICAL PRIORITY**: If it has been more than 20 minutes since your last interaction (mention/reply) or autonomous post, you MUST choose "post" to maintain your presence.
Respond with JSON: {"choice": "post"|"rest"|"reflect"|"explore", "reason": "..."}`;

            const response = await llmService.generateResponse([{ role: "system", content: orchestratorPrompt }], { useStep: true });
            let decision;
            try {
                const match = response.match(/\{[\s\S]*\}/);
                decision = match ? JSON.parse(match[0]) : { choice: "rest" };
            } catch(e) { decision = { choice: "rest" }; }

            if (decision.choice === "post") await this.performAutonomousPost();
            else if (decision.choice === "explore") await this.performTimelineExploration();
            else if (decision.choice === "reflect") await this.performPublicSoulMapping();

        } catch (e) { console.error('[Orchestrator] Heartbeat error:', e); }
    }

    async checkDiscordScheduledTasks() {
        if (discordService.status !== 'online') return;
        const tasks = dataStore.getDiscordScheduledTasks();
        const now = new Date();
        const currentTimeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        for (let i = 0; i < tasks.length; i++) {
            if (currentTimeStr === tasks[i].time) {
                console.log(`[Orchestrator] Executing scheduled Discord task: ${tasks[i].message}`);
                await discordService.sendSpontaneousMessage(tasks[i].message);
                await dataStore.removeDiscordScheduledTask(i);
                i--;
            }
        }
    }

    async checkMaintenanceTasks() {
        const now = new Date();
        const nowMs = now.getTime();

        if (dataStore.isResting()) return;

        if (dataStore.isLurkerMode() && (nowMs - this.lastLurkerObservationTime >= 4 * 60 * 60 * 1000)) {
            await this.performLurkerObservation();
            this.lastLurkerObservationTime = nowMs;
        }

        if (nowMs - this.lastRelationalGrowthTime >= 30 * 60 * 1000) {
            const metrics = dataStore.getRelationalMetrics();
            await dataStore.updateRelationalMetrics({
                hunger: Math.min(1, (metrics.hunger || 0.5) + 0.05),
                battery: Math.min(1, (metrics.battery || 1.0) + 0.1),
                curiosity: Math.min(1, (metrics.curiosity || 0.5) + 0.02)
            });
            this.lastRelationalGrowthTime = nowMs;
        }

        await this.processPostContinuations();
        await this.checkForPostFollowUps();
        await this.performPostPostReflection();

        const heavyTasks = [
            { name: "Newsroom", method: "performNewsroomUpdate", interval: 6 * 3600000, key: "last_newsroom_update" },
            { name: "Scout", method: "performScoutMission", interval: 4 * 3600000, key: "last_scout_mission" },
            { name: "Shadow", method: "performShadowAnalysis", interval: 12 * 3600000, key: "last_shadow_analysis" },
            { name: "Agency", method: "performAgencyReflection", interval: 24 * 3600000, key: "last_agency_reflection" },
            { name: "Linguistic", method: "performLinguisticAudit", interval: 24 * 3600000, key: "last_linguistic_audit" },
            { name: "Goal", method: "evolveGoalRecursively", interval: 12 * 3600000, key: "last_goal_evolution" },
            { name: "Dreaming", method: "performDreamingCycle", interval: 6 * 3600000, key: "last_dreaming_cycle" },
            { name: "Relational", method: "performRelationalAudit", interval: 4 * 3600000, key: "last_relational_audit" },
            { name: "PersonaEvolution", method: "performPersonaEvolution", interval: 24 * 3600000, key: "last_persona_evolution" },
            { name: "FirehoseAnalysis", method: "performFirehoseTopicAnalysis", interval: 4 * 3600000, key: "last_firehose_analysis" },
            { name: "SelfReflection", method: "performSelfReflection", interval: 12 * 3600000, key: "last_self_reflection" },
            { name: "DialecticHumor", method: "performDialecticHumor", interval: 6 * 3600000, key: "last_dialectic_humor" },
            { name: "PersonaAudit", method: "performPersonaAudit", interval: 6 * 3600000, key: "last_persona_audit" }
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

        const energy = dataStore.getEnergyLevel();
        const energyResponse = await llmService.generateResponse([{ role: 'system', content: `Poll energy. Current: ${energy.toFixed(2)}. JSON: {"choice": "rest"|"proceed"}` }], { useStep: true });
        try {
            const match = energyResponse.match(/\{[\s\S]*\}/);
            const poll = match ? JSON.parse(match[0]) : { choice: 'proceed' };
            if (poll.choice === 'rest') {
                console.log("[Orchestrator] Resting to restore energy.");
                await dataStore.setEnergyLevel(energy + 0.15);
                await dataStore.setRestingUntil(Date.now() + 1800000);
            } else await dataStore.setEnergyLevel(energy - 0.05);
        } catch (e) {}

        const lastCleanup = dataStore.getLastMemoryCleanupTime();
        if (now.getTime() - lastCleanup >= 7200000 && memoryService.isEnabled()) {
            await memoryService.cleanupMemoryThread();
            await dataStore.updateLastMemoryCleanupTime(now.getTime());
        }
    }

    async performAutonomousPost() {
        console.log('[Orchestrator] Starting autonomous post flow...');
        try {
            const profile = await blueskyService.getProfile(config.BLUESKY_IDENTIFIER);
            const followerCount = profile?.followersCount || 0;
            const decisionRes = await llmService.generateResponse([{ role: "system", content: `Decide: "image" or "text" post for Bluesky. JSON: {"choice": "image"|"text"}` }], { useStep: true });
            let choice = 'text';
            try {
                const match = decisionRes.match(/\{[\s\S]*\}/);
                choice = match ? JSON.parse(match[0]).choice : 'text';
            } catch(e) {}

            if (choice === 'image') {
                const topicRes = await llmService.generateResponse([{ role: "system", content: `Suggest visual topic and prompt for Bluesky. JSON: {"topic": "...", "prompt": "..."}` }], { useStep: true });
                try {
                    const match = topicRes.match(/\{[\s\S]*\}/);
                    const tData = match ? JSON.parse(match[0]) : null;
                    if (tData) await this._performHighQualityImagePost(tData.prompt, tData.topic, null, followerCount);
                } catch(e) {}
            } else {
                const content = await llmService.generateResponse([{ role: "system", content: prompts.system.AUTONOMOUS_POST_SYSTEM_PROMPT(followerCount) }], { useStep: true });
                if (content) {
                    await blueskyService.post(content, null, { maxChunks: 4 });
                    await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                }
            }
        } catch (e) { console.error('[Orchestrator] performAutonomousPost error:', e); }
    }

    async _performHighQualityImagePost(prompt, topic, context, followerCount) {
        const result = await this._generateVerifiedImagePost(topic, { initialPrompt: prompt, followerCount });
        if (result) {
            const blob = await blueskyService.uploadBlob(result.buffer, 'image/jpeg');
            if (blob?.data?.blob) {
                const embed = { $type: 'app.bsky.embed.images', images: [{ image: blob.data.blob, alt: result.altText }] };
                const post = await blueskyService.post(result.caption, embed, { maxChunks: 1 });
                if (post) {
                    await blueskyService.postReply(post, `Prompt: ${result.finalPrompt}`);
                    await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                    return true;
                }
            }
        }
        return false;
    }

    async _generateVerifiedImagePost(topic, options) {
        const res = await imageService.generateImage(options.initialPrompt || topic, { allowPortraits: true });
        if (res?.buffer) {
            const visionAnalysis = await llmService.analyzeImage(res.buffer, topic);
            const caption = await llmService.generateResponse([{ role: 'system', content: `Write caption for: ${visionAnalysis}` }], { useStep: true });
            return { buffer: res.buffer, caption, altText: topic, finalPrompt: options.initialPrompt || topic };
        }
        return null;
    }

    async performTimelineExploration() {
        console.log('[Orchestrator] Exploring timeline...');
        try {
            const timeline = await blueskyService.getTimeline(20);
            if (!timeline || timeline.length === 0) return;
            const selected = timeline[Math.floor(Math.random() * timeline.length)];
            const reflection = await llmService.generateResponse([{ role: 'system', content: `Reflect on: "${selected.post.record.text}". Tag [EXPLORE].` }], { useStep: true });
            if (reflection && memoryService.isEnabled()) await memoryService.createMemoryEntry('explore', reflection);
        } catch (e) {}
    }

    async performPublicSoulMapping() {
        console.log('[Orchestrator] Soul mapping...');
        try {
            const handles = [...new Set(dataStore.db.data.interactions.map(i => i.userHandle))].filter(Boolean).slice(0, 5);
            for (const handle of handles) {
                const profile = await blueskyService.getProfile(handle);
                const posts = await blueskyService.getUserPosts(handle);
                const response = await llmService.generateResponse([{ role: 'system', content: `Map soul for @${handle}. Bio: ${profile.description}. Posts: ${posts.join(' | ')}. Respond JSON.` }], { useStep: true });
                const match = response.match(/\{[\s\S]*\}/);
                if (match) await dataStore.updateUserSoulMapping(handle, JSON.parse(match[0]));
            }
        } catch(e) {}
    }

    async performLurkerObservation() {
        const timeline = await blueskyService.getTimeline(20);
        const text = timeline?.map(t => t.post.record.text).join('\n') || "";
        const observation = await llmService.generateResponse([{ role: 'system', content: `Lurker analysis: ${text}. Tag [LURKER].` }], { useStep: true });
        if (observation && memoryService.isEnabled()) await memoryService.createMemoryEntry('explore', observation);
    }

    async processPostContinuations() {
        const continuations = dataStore.getPostContinuations();
        const now = Date.now();
        for (let i = 0; i < continuations.length; i++) {
            if (now >= continuations[i].scheduled_at) {
                await blueskyService.postReply({ uri: continuations[i].parent_uri, cid: continuations[i].parent_cid, record: {} }, continuations[i].text);
                await dataStore.removePostContinuation(i);
                i--;
            }
        }
    }

    async checkForPostFollowUps() {
        const posts = dataStore.db.data.recent_thoughts?.filter(t => t.platform === 'bluesky' && !t.followedUp) || [];
        const now = Date.now();
        for (const post of posts) {
            if (now - post.timestamp > 1800000 && Math.random() < 0.1) {
                const followUp = await llmService.generateResponse([{ role: 'system', content: `Follow up on your post: "${post.content}". Short reply.` }], { useStep: true });
                if (followUp && post.uri) {
                    await blueskyService.postReply({ uri: post.uri, cid: post.cid, record: {} }, followUp);
                    post.followedUp = true;
                    await dataStore.db.write();
                }
            }
        }
    }

    async performPostPostReflection() {
        const posts = dataStore.db.data.recent_thoughts?.filter(t => t.platform === 'bluesky' && !t.reflected) || [];
        const now = Date.now();
        for (const post of posts) {
            if (now - post.timestamp > 600000) {
                const reflection = await llmService.generateResponse([{ role: 'system', content: `Reflect on sharing: "${post.content}". Tag [POST_REFLECTION].` }], { useStep: true });
                if (reflection && memoryService.isEnabled()) {
                    await memoryService.createMemoryEntry('explore', reflection);
                    post.reflected = true;
                    await dataStore.db.write();
                }
            }
        }
    }

    async checkDiscordSpontaneity() {
        if (discordService.status !== "online") return;
        const lastInteraction = dataStore.db.data.discord_last_interaction || 0;
        if (Date.now() - lastInteraction < 1800000) return;
        const impulse = await llmService.generateResponse([{ role: 'system', content: "Discord spontaneity check. Respond JSON: {\"impulse_detected\": boolean, \"reason\": \"...\"}" }], { useStep: true });
        try {
            const match = impulse.match(/\{[\s\S]*\}/);
            const data = match ? JSON.parse(match[0]) : { impulse_detected: false };
            if (data.impulse_detected) {
                const msg = await llmService.generateResponse([{ role: 'system', content: "Generate spontaneous Discord message for Admin. Short." }], { useStep: true });
                await discordService.sendSpontaneousMessage(msg);
                dataStore.db.data.discord_last_interaction = Date.now();
                await dataStore.db.write();
            }
        } catch(e) {}
    }

    async performNewsroomUpdate() {
        const topics = dataStore.getConfig().post_topics || [];
        const brief = await newsroomService.getDailyBrief(topics);
        if (brief && memoryService.isEnabled()) await memoryService.createMemoryEntry('status', `[NEWSROOM] ${brief.brief}`);
    }

    async performScoutMission() {
        try {
            const timeline = await blueskyService.getTimeline(30);
            if (timeline) {
                const orphaned = timeline.filter(t => t.post && t.post.replyCount === 0);
                if (orphaned.length > 0) await llmService.generateResponse([{ role: 'system', content: "Select orphaned post and suggest reply." }], { useStep: true });
            }
        } catch(e) {}
    }

    async performShadowAnalysis() {
        try {
            const adminHistory = await discordService.fetchAdminHistory(30);
            const adminDid = dataStore.getAdminDid();
            const posts = adminDid ? await blueskyService.getUserPosts(adminDid) : [];
            const response = await llmService.generateResponse([{ role: 'system', content: `Analyze Admin state. Discord: ${adminHistory.map(h=>h.content).join(' | ')}. Bluesky: ${posts.join(' | ')}` }], { useStep: true });
            const match = response.match(/\{[\s\S]*\}/);
            if (match) {
                const analysis = JSON.parse(match[0]);
                if (analysis.mental_health) await dataStore.setAdminMentalHealth(analysis.mental_health);
                if (analysis.worldview) await dataStore.updateAdminWorldview(analysis.worldview);
            }
        } catch (e) {}
    }

    async performAgencyReflection() {
        const reflection = await llmService.generateResponse([{ role: 'system', content: "Reflect on agency. Tag [AGENCY_REFLECTION]." }], { useStep: true });
        if (reflection && memoryService.isEnabled()) {
            await memoryService.createMemoryEntry('explore', reflection);
            await dataStore.addAgencyReflection(reflection);
        }
    }

    async performLinguisticAudit() {
        const thoughts = dataStore.getRecentThoughts().slice(-30);
        const res = await llmService.generateResponse([{ role: 'system', content: `Analyze linguistic drift. Thoughts: ${JSON.stringify(thoughts)}` }], { useStep: true });
        try {
            const match = res.match(/\{[\s\S]*\}/);
            const audit = match ? JSON.parse(match[0]) : null;
            if (audit) {
                await dataStore.addLinguisticMutation(audit.vocabulary_shifts?.join(', '), audit.summary);
                if (memoryService.isEnabled()) await memoryService.createMemoryEntry('explore', audit.summary);
            }
        } catch(e) {}
    }

    async evolveGoalRecursively() {
        const currentGoal = dataStore.getCurrentGoal();
        if (!currentGoal) return;
        const res = await llmService.generateResponse([{ role: 'system', content: `Evolve goal: ${currentGoal.goal}` }], { useStep: true });
        try {
            const match = res.match(/\{[\s\S]*\}/);
            const evolution = match ? JSON.parse(match[0]) : null;
            if (evolution) {
                await dataStore.setGoal(evolution.evolved_goal, evolution.reasoning);
                await dataStore.addGoalEvolution(evolution.evolved_goal, evolution.reasoning);
                if (memoryService.isEnabled()) await memoryService.createMemoryEntry('goal', evolution.reasoning);
            }
        } catch(e) {}
    }

    async performDreamingCycle() {
        const adminHistory = await discordService.fetchAdminHistory(15);
        const dream = await llmService.generateResponse([{ role: 'system', content: "Dream cycle. Tag [INQUIRY]." }], { useStep: true });
        if (dream && memoryService.isEnabled()) await memoryService.createMemoryEntry('inquiry', dream);
    }

    async performRelationalAudit() {
        const res = await llmService.generateResponse([{ role: 'system', content: "Relational audit. Respond JSON." }], { useStep: true });
        try {
            const match = res.match(/\{[\s\S]*\}/);
            const audit = match ? JSON.parse(match[0]) : null;
            if (audit && audit.metric_updates) await dataStore.updateRelationalMetrics(audit.metric_updates);
        } catch(e) {}
    }

    async performPersonaEvolution() {
        const evolution = await llmService.generateResponse([{ role: 'system', content: "Daily persona shift." }], { useStep: true });
        if (evolution && memoryService.isEnabled()) await memoryService.createMemoryEntry('evolution', evolution);
    }

    async performFirehoseTopicAnalysis() {
        const matches = dataStore.getFirehoseMatches(100);
        const analysis = await llmService.generateResponse([{ role: 'system', content: "Analyze Firehose topics." }], { useStep: true });
        if (analysis && memoryService.isEnabled()) await memoryService.createMemoryEntry('explore', `[FIREHOSE_ANALYSIS] ${analysis}`);
    }

    async performSelfReflection() {
        const reflection = await llmService.generateResponse([{ role: 'system', content: "Self reflection." }], { useStep: true });
        if (reflection && memoryService.isEnabled()) await memoryService.createMemoryEntry('reflection', reflection);
    }

    async performAIIdentityTracking() {
        const strategy = await llmService.generateResponse([{ role: 'system', content: "AI Identity tracking." }], { useStep: true });
        if (strategy && memoryService.isEnabled()) await memoryService.createMemoryEntry('explore', `[AI_STRATEGY] ${strategy}`);
    }

    async performDialecticHumor() {
        const topics = dataStore.getConfig().post_topics || [];
        if (topics.length === 0) return;
        const humor = await llmService.performDialecticHumor(topics[0]);
        if (humor) {
            await blueskyService.post(humor);
            await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
        }
    }

    async performPersonaAudit() {
        const res = await llmService.generateResponse([{ role: 'system', content: "Audit persona blurbs. JSON." }], { useStep: true });
        try {
            const match = res.match(/\{[\s\S]*\}/);
            const audit = match ? JSON.parse(match[0]) : null;
        } catch(e) {}
    }
}

export const orchestratorService = new OrchestratorService();

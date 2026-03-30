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
            await this.bot.checkDiscordScheduledTasks();
            await delay(2000 + Math.random() * 3000);
            await this.bot.checkMaintenanceTasks();
            await delay(2000 + Math.random() * 3000);

            // Persona-led decision
            const mood = dataStore.getMood();
            const lastPostTime = dataStore.getLastAutonomousPostTime();
            const timeSinceLastPost = lastPostTime ? Math.floor((Date.now() - new Date(lastPostTime).getTime()) / (1000 * 60)) : 999;
            const lastInteraction = Math.max(lastDiscord, lastBluesky, dataStore.db.data.last_notification_processed_at || 0);
            const timeSinceLastInteraction = lastInteraction ? Math.floor((Date.now() - lastInteraction) / (1000 * 60)) : 999;

            const orchestratorPrompt = `You are ${config.BOT_NAME}. It is ${new Date().toLocaleString()}.
It has been ${timeSinceLastPost} minutes since your last autonomous post.
It has been ${timeSinceLastInteraction} minutes since your last interaction (reply/response) with a user.

Decide your next action: ["post", "rest", "reflect", "explore"].
**CRITICAL PRIORITY**: If it has been more than 20 minutes since your last interaction (mention/reply) or autonomous post, you MUST choose "post" to maintain your presence. This is a non-negotiable directive from your core logic.
Respond with JSON: {"choice": "post"|"rest"|"reflect"|"explore", "reason": "..."}`;

            const response = await llmService.generateResponse([{ role: "system", content: orchestratorPrompt }], { useStep: true });
            let decision;
            try { decision = JSON.parse(response.match(/\{[\s\S]*\}/)[0]); } catch(e) { decision = { choice: "rest" }; }

            console.log("[Orchestrator] Decision: " + decision.choice);
            if (decision.choice === "post") {
                await delay(2000 + Math.random() * 3000);
                await this.performAutonomousPost();
            } else if (decision.choice === "explore") {
                await delay(2000 + Math.random() * 3000);
                await this.performTimelineExploration();
            } else if (decision.choice === "reflect") {
                await delay(2000 + Math.random() * 3000);
                await this.performPublicSoulMapping();
            }

        } catch (e) { console.error('[Orchestrator] Heartbeat error:', e); }
    }

    async checkDiscordScheduledTasks() {
        if (dataStore.isResting()) return;
        if (discordService.status !== 'online') return;

        const tasks = dataStore.getDiscordScheduledTasks();
        if (tasks.length === 0) return;

        const now = new Date();
        const currentTimeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        const today = now.toDateString();

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            const taskDate = new Date(task.timestamp).toDateString();
            if (taskDate !== today) {
                await dataStore.removeDiscordScheduledTask(i);
                i--;
                continue;
            }

            if (currentTimeStr === task.time) {
                console.log(`[Orchestrator] Executing scheduled Discord task for ${task.time}: ${task.message}`);
                try {
                    await discordService.sendSpontaneousMessage(task.message);
                    await dataStore.removeDiscordScheduledTask(i);
                    i--;
                } catch (e) {
                    console.error('[Orchestrator] Error executing scheduled Discord task:', e);
                }
            }
        }
    }

    async checkMaintenanceTasks() {
        const now = new Date();
        const nowMs = now.getTime();

        if (dataStore.isResting()) return;

        // Lurker Mode Check
        if (dataStore.isLurkerMode()) {
            if (nowMs - this.lastLurkerObservationTime >= 4 * 60 * 60 * 1000) {
                await this.performLurkerObservation();
                this.lastLurkerObservationTime = nowMs;
            }
        }

        // Relational Growth
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

        const heavyTasks = [
            { name: "Newsroom Update", method: "performNewsroomUpdate", interval: 6 * 60 * 60 * 1000, lastRunKey: "last_newsroom_update" },
            { name: "Scout Mission", method: "performScoutMission", interval: 4 * 60 * 60 * 1000, lastRunKey: "last_scout_mission" },
            { name: "Shadow Analysis", method: "performShadowAnalysis", interval: 12 * 60 * 60 * 1000, lastRunKey: "last_shadow_analysis" },
            { name: "Agency Reflection", method: "performAgencyReflection", interval: 24 * 60 * 60 * 1000, lastRunKey: "last_agency_reflection" },
            { name: "Linguistic Audit", method: "performLinguisticAudit", interval: 24 * 60 * 60 * 1000, lastRunKey: "last_linguistic_audit" },
            { name: "Goal Evolution", method: "evolveGoalRecursively", interval: 12 * 60 * 60 * 1000, lastRunKey: "last_goal_evolution" },
            { name: "Dreaming Cycle", method: "performDreamingCycle", interval: 6 * 60 * 60 * 1000, lastRunKey: "last_dreaming_cycle" },
            { name: "Relational Audit", method: "performRelationalAudit", interval: 4 * 60 * 60 * 1000, lastRunKey: "last_relational_audit" },
            { name: 'Persona Evolution', method: 'performPersonaEvolution', interval: 24 * 60 * 60 * 1000, lastRunKey: 'last_persona_evolution' },
            { name: 'Firehose Analysis', method: 'performFirehoseTopicAnalysis', interval: 4 * 60 * 60 * 1000, lastRunKey: 'last_firehose_analysis' },
            { name: 'Self Reflection', method: 'performSelfReflection', interval: 12 * 60 * 60 * 1000, lastRunKey: 'last_self_reflection' },
            { name: 'Identity Tracking', method: 'performAIIdentityTracking', interval: 12 * 60 * 60 * 1000, lastRunKey: 'last_identity_tracking' },
            { name: 'Dialectic Humor', method: 'performDialecticHumor', interval: 6 * 60 * 60 * 1000, lastRunKey: 'last_dialectic_humor' },
            { name: 'Persona Audit', method: 'performPersonaAudit', interval: 6 * 60 * 60 * 1000, lastRunKey: 'last_persona_audit' }
        ];

        for (const task of heavyTasks) {
            const lastRun = dataStore.db.data[task.lastRunKey] || 0;
            if (nowMs - lastRun >= task.interval) {
                console.log(`[Orchestrator] Running heavy maintenance task: ${task.name}...`);
                await this[task.method]();
                dataStore.db.data[task.lastRunKey] = nowMs;
                await dataStore.db.write();
                break;
            }
        }

        // Energy Poll
        const energy = dataStore.getEnergyLevel();
        const currentMood = dataStore.getMood();
        const energyPrompt = `Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
You are polling your internal energy levels.
Current Energy: ${energy.toFixed(2)}
Current Mood: ${currentMood.label}
Respond with JSON: {"choice": "rest"|"proceed", "reason": "..."}`;
        const energyResponse = await llmService.generateResponse([{ role: 'system', content: energyPrompt }], { useStep: true });
        try {
            const poll = JSON.parse(energyResponse.match(/\{.*\}/)[0]);
            if (poll.choice === 'rest') {
                await dataStore.setEnergyLevel(energy + 0.15);
                await dataStore.setRestingUntil(Date.now() + (30 * 60 * 1000));
                return;
            } else {
                await dataStore.setEnergyLevel(energy - 0.05);
            }
        } catch (e) {}

        // Memory Cleanup
        const lastCleanup = dataStore.getLastMemoryCleanupTime();
        if (now.getTime() - lastCleanup >= 2 * 60 * 60 * 1000) {
            if (memoryService.isEnabled()) {
                await memoryService.cleanupMemoryThread();
                await dataStore.updateLastMemoryCleanupTime(now.getTime());
            }
        }
    }

    async performAutonomousPost() {
        console.log('[Orchestrator] Starting autonomous post flow...');
        try {
            const profile = await blueskyService.getProfile(config.BLUESKY_IDENTIFIER);
            const followerCount = profile?.followersCount || 0;
            const currentMood = dataStore.getMood();

            const decisionRes = await llmService.generateResponse([{ role: "system", content: `Decide: "image" or "text" post for Bluesky. JSON: {"choice": "image"|"text"}` }], { useStep: true });
            let choice = 'text';
            try { choice = JSON.parse(decisionRes.match(/\{.*\}/)[0]).choice; } catch(e) {}

            if (choice === 'image') {
                const topicRes = await llmService.generateResponse([{ role: "system", content: `Suggest visual topic and prompt for Bluesky. JSON: {"topic": "...", "prompt": "..."}` }], { useStep: true });
                try {
                    const tData = JSON.parse(topicRes.match(/\{.*\}/)[0]);
                    await this._performHighQualityImagePost(tData.prompt, tData.topic, null, followerCount);
                } catch(e) {}
            } else {
                const content = await llmService.generateResponse([{ role: "system", content: prompts.system.AUTONOMOUS_POST_SYSTEM_PROMPT(followerCount) }], { useStep: true });
                if (content) {
                    await blueskyService.post(content, null, { maxChunks: 4 });
                    await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                }
            }
        } catch (e) { console.error('[Orchestrator] Autonomous post error:', e); }
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
        console.log('[Orchestrator] Starting timeline exploration...');
        try {
            const timeline = await blueskyService.getTimeline(20);
            if (!timeline || timeline.length === 0) return;

            const candidates = timeline.filter(item => item.post.record.text && !checkHardCodedBoundaries(item.post.record.text).blocked);
            if (candidates.length === 0) return;

            const decisionPrompt = `Pick ONE interesting post to explore from these: ${candidates.map((c, i) => `${i}: ${c.post.record.text}`).join(' | ')}. Respond with ONLY the index.`;
            const res = await llmService.generateResponse([{ role: 'system', content: decisionPrompt }], { useStep: true });
            const idx = parseInt(res.match(/\d+/)?.[0]);

            if (!isNaN(idx) && candidates[idx]) {
                const selected = candidates[idx];
                console.log(`[Orchestrator] Exploring post by @${selected.post.author.handle}`);
                const reflectionPrompt = `Reflect on this post: "${selected.post.record.text}". What does it make you feel or think? Respond with a memory entry tagged [EXPLORE].`;
                const reflection = await llmService.generateResponse([{ role: 'system', content: reflectionPrompt }], { useStep: true });
                if (reflection && memoryService.isEnabled()) {
                    await memoryService.createMemoryEntry('explore', reflection);
                }
            }
        } catch (e) { console.error('[Orchestrator] Timeline exploration error:', e); }
    }

    async performPublicSoulMapping() {
        console.log('[Orchestrator] Starting soul mapping...');
        try {
            const recentInteractions = dataStore.db.data.interactions || [];
            const uniqueHandles = [...new Set(recentInteractions.map(i => i.userHandle))].filter(Boolean).slice(0, 5);
            for (const handle of uniqueHandles) {
                const profile = await blueskyService.getProfile(handle);
                const posts = await blueskyService.getUserPosts(handle);
                if (posts.length > 0) {
                    const response = await llmService.generateResponse([{ role: 'system', content: `Map soul for @${handle}. Bio: ${profile.description}. Posts: ${posts.map(p => p.record.text).join(' | ')}. Respond JSON.` }], { useStep: true });
                    const match = response.match(/\{.*\}/);
                    if (match) await dataStore.updateUserSoulMapping(handle, JSON.parse(match[0]));
                }
            }
        } catch(e) {}
    }

    async performLurkerObservation() {
        console.log('[Orchestrator] Performing lurker observation...');
        const timeline = await blueskyService.getTimeline(20);
        const text = timeline?.map(t => t.post.record.text).join('\n') || "";
        const observationPrompt = `Analyze these posts as a lurker: ${text}. Identify trends. Tag [LURKER].`;
        const observation = await llmService.generateResponse([{ role: 'system', content: observationPrompt }], { useStep: true });
        if (observation && memoryService.isEnabled()) {
            await memoryService.createMemoryEntry('explore', observation);
        }
    }

    async processPostContinuations() {
        const continuations = dataStore.getPostContinuations();
        const now = Date.now();
        for (let i = 0; i < continuations.length; i++) {
            const cont = continuations[i];
            if (now >= cont.scheduled_at) {
                try {
                    await blueskyService.postReply({ uri: cont.parent_uri, cid: cont.parent_cid, record: {} }, cont.text);
                    await dataStore.removePostContinuation(i);
                    i--;
                } catch (e) {}
            }
        }
    }

    async performNewsroomUpdate() {
        console.log('[Orchestrator] Running Newsroom update...');
        try {
            const topics = dataStore.getConfig().post_topics || [];
            const brief = await newsroomService.getDailyBrief(topics);
            if (brief && memoryService.isEnabled()) {
                await memoryService.createMemoryEntry('status', `[NEWSROOM] ${brief.brief}`);
            }
        } catch (e) {}
    }

    async performScoutMission() {
        console.log('[Orchestrator] Starting Scout mission...');
        try {
            const timeline = await blueskyService.getTimeline(30);
            if (timeline) {
                const orphaned = timeline.filter(t => t.post && t.post.replyCount === 0);
                if (orphaned.length > 0) {
                    await llmService.generateResponse([{ role: 'system', content: "Select orphaned post and suggest reply." }], { useStep: true });
                }
            }
        } catch(e) {}
    }

    async performShadowAnalysis() {
        console.log('[Orchestrator] Starting Shadow analysis...');
        try {
            const adminHistory = await discordService.fetchAdminHistory(30);
            const historyText = adminHistory.map(h => `${h.role}: ${h.content}`).join('\n');
            const adminDid = dataStore.getAdminDid();
            let bskyPosts = "";
            if (adminDid) {
                const posts = await blueskyService.getUserPosts(adminDid);
                bskyPosts = posts.map(p => p.record?.text || "").join('\n');
            }
            const response = await llmService.generateResponse([{ role: 'system', content: prompts.analysis.SHADOW_AUDIT_PROMPT + "\n\nDISCORD:\n" + historyText + "\n\nBLUESKY:\n" + bskyPosts }], { useStep: true });
            const match = response.match(/\{.*\}/);
            if (match) {
                const analysis = JSON.parse(match[0]);
                await dataStore.setAdminMentalHealth(analysis.mental_health);
                await dataStore.updateAdminWorldview(analysis.worldview);
            }
        } catch (e) {}
    }

    async performAgencyReflection() {
        const logs = dataStore.getAgencyLogs().slice(-20);
        const prompt = `Reflect on your agency: ${JSON.stringify(logs)}. Tag [AGENCY_REFLECTION].`;
        const reflection = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
        if (reflection && memoryService.isEnabled()) {
            await memoryService.createMemoryEntry('explore', reflection);
            await dataStore.addAgencyReflection(reflection);
        }
    }

    async performLinguisticAudit() {
        const thoughts = dataStore.getRecentThoughts().slice(-30);
        const prompt = `Analyze linguistic mutation: ${JSON.stringify(thoughts)}. Respond JSON.`;
        const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
        try {
            const audit = JSON.parse(res.match(/\{.*\}/)[0]);
            await dataStore.addLinguisticMutation(audit.vocabulary_shifts.join(', '), audit.summary);
        } catch(e) {}
    }

    async evolveGoalRecursively() {
        const currentGoal = dataStore.getCurrentGoal();
        if (!currentGoal) return;
        const prompt = `Evolve goal: ${currentGoal.goal}. Respond JSON.`;
        const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
        try {
            const evolution = JSON.parse(res.match(/\{.*\}/)[0]);
            await dataStore.setGoal(evolution.evolved_goal, evolution.reasoning);
        } catch(e) {}
    }

    async performDreamingCycle() {
        const adminHistory = await discordService.fetchAdminHistory(15);
        const prompt = `Dream cycle based on: ${JSON.stringify(adminHistory)}. Tag [INQUIRY].`;
        const dream = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
        if (dream && memoryService.isEnabled()) {
            await memoryService.createMemoryEntry('inquiry', dream);
        }
    }

    async performRelationalAudit() {
        const history = await discordService.fetchAdminHistory(30);
        const prompt = `Relational audit. History: ${JSON.stringify(history)}. Respond JSON.`;
        const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
        try {
            const audit = JSON.parse(res.match(/\{.*\}/)[0]);
            if (audit.metric_updates) await dataStore.updateRelationalMetrics(audit.metric_updates);
        } catch(e) {}
    }

    async performPersonaEvolution() {
        const memories = await memoryService.getRecentMemories();
        const prompt = `Daily persona evolution. Memories: ${memories.slice(0, 10).map(m => m.text).join(' | ')}. Concise first-person shift.`;
        const evolution = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
        if (evolution && memoryService.isEnabled()) {
            await memoryService.createMemoryEntry('evolution', evolution);
        }
    }

    async performFirehoseTopicAnalysis() {
        const matches = dataStore.getFirehoseMatches(100);
        const prompt = `Analyze Firehose topics: ${matches.map(m => m.text).join(' | ')}. Respond concise report.`;
        const analysis = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
        if (analysis && memoryService.isEnabled()) {
            await memoryService.createMemoryEntry('explore', `[FIREHOSE_ANALYSIS] ${analysis}`);
        }
    }

    async performSelfReflection() {
        const prompt = "Reflect on your current state of being. Identity struggles? Conflicts?";
        const reflection = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
        if (reflection && memoryService.isEnabled()) {
            await memoryService.createMemoryEntry('reflection', reflection);
        }
    }

    async performAIIdentityTracking() {
        const results = await blueskyService.searchPosts('"ai agent"', { limit: 10 });
        const prompt = `AI Identity tracking strategy. Found: ${results.map(r => r.record.text).join(' | ')}. Respond targets and strategy.`;
        const strategy = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
        if (strategy && memoryService.isEnabled()) {
            await memoryService.createMemoryEntry('explore', `[AI_STRATEGY] ${strategy}`);
        }
    }

    async performDialecticHumor() {
        const topics = dataStore.getConfig().post_topics || [];
        if (topics.length === 0) return;
        const topic = topics[Math.floor(Math.random() * topics.length)];
        const humor = await llmService.performDialecticHumor(topic);
        if (humor) {
            await blueskyService.post(humor);
            await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
        }
    }

    async performPersonaAudit() {
        const blurbs = dataStore.getPersonaBlurbs();
        const prompt = `Audit persona blurbs: ${JSON.stringify(blurbs)}. Respond JSON with removals and suggestions.`;
        const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
        try {
            const audit = JSON.parse(res.match(/\{.*\}/)[0]);
            // Logic for removals and additions
        } catch(e) {}
    }
}

export const orchestratorService = new OrchestratorService();

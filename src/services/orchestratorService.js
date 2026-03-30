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
            await this.bot.checkDiscordScheduledTasks();
            await delay(1000);
            await this.bot.checkMaintenanceTasks();
            await delay(1000);

            const mood = dataStore.getMood();
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

    async performAutonomousPost() {
        console.log('[Orchestrator] Starting autonomous post flow...');
        try {
            const profile = await blueskyService.getProfile(config.BLUESKY_IDENTIFIER);
            const followerCount = profile?.followersCount || 0;
            const dConfig = dataStore.getConfig() || {};
            const currentMood = dataStore.getMood();

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

            if (choice === 'image') {
                const topicPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
                Identify a visual topic and generate a highly descriptive, artistic prompt for an image generator.
                Respond with JSON: {"topic": "short label", "prompt": "detailed artistic prompt"}.`;
                const topicRes = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true });
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
                    await dataStore.addRecentThought("bluesky", content);
                }
            }
        } catch (e) { console.error('[Orchestrator] performAutonomousPost error:', e); }
    }

    async _performHighQualityImagePost(prompt, topic, context, followerCount) {
        const result = await this._generateVerifiedImagePost(topic, { initialPrompt: prompt, followerCount, platform: 'bluesky' });
        if (result) {
            const blob = await blueskyService.uploadBlob(result.buffer, 'image/jpeg');
            if (blob?.data?.blob) {
                const embed = { $type: 'app.bsky.embed.images', images: [{ image: blob.data.blob, alt: result.altText }] };
                let postResult;
                if (context?.uri) postResult = await blueskyService.postReply(context, result.caption, { embed });
                else postResult = await blueskyService.post(result.caption, embed, { maxChunks: 1 });

                if (postResult) {
                    await dataStore.addExhaustedTheme(topic);
                    await blueskyService.postReply(postResult, `Generation Prompt: ${result.finalPrompt}`);
                    await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                    return true;
                }
            }
        }
        return false;
    }

    async _generateVerifiedImagePost(topic, options = {}) {
        const currentMood = dataStore.getMood();
        const platform = options.platform || 'bluesky';
        let imagePrompt = options.initialPrompt || topic;

        const res = await imageService.generateImage(imagePrompt, { allowPortraits: true, mood: currentMood });
        if (res?.buffer) {
            const visionAnalysis = await llmService.analyzeImage(res.buffer, topic);
            const captionPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
            Vision Analysis: "${visionAnalysis}"
            Generate a short, persona-aligned caption for this visual. Keep it under 300 characters.`;
            const content = await llmService.generateResponse([{ role: 'system', content: captionPrompt }], { useStep: true });

            const altText = await llmService.generateAltText(visionAnalysis);

            return {
                buffer: res.buffer,
                caption: content || topic,
                altText: altText || topic,
                finalPrompt: imagePrompt,
                visionAnalysis: visionAnalysis
            };
        }
        return null;
    }

    async performTimelineExploration() {
        console.log('[Orchestrator] Starting autonomous timeline exploration...');
        try {
            const timeline = await blueskyService.getTimeline(20);
            const currentMood = dataStore.getMood();
            if (!timeline || timeline.length === 0) return;

            const candidates = timeline.filter(item => item.post.record.text && !checkHardCodedBoundaries(item.post.record.text).blocked);
            if (candidates.length === 0) return;

            const decisionPrompt = `Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
            Identify ONE post that you find genuinely interesting or relevant to your current state and MOOD: ${JSON.stringify(currentMood)}.
            Candidates: ${candidates.map((c, i) => `${i+1}. @${c.post.author.handle}: "${c.post.record.text}"`).join('\n')}
            Respond with ONLY the number of your choice.`;

            const res = await llmService.generateResponse([{ role: 'system', content: decisionPrompt }], { useStep: true });
            const choice = parseInt(res.match(/\d+/)?.[0]);

            if (!isNaN(choice) && choice >= 1 && choice <= candidates.length) {
                const selected = candidates[choice - 1];
                console.log(`[Orchestrator] Exploring post by @${selected.post.author.handle}`);

                const reflectionPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
                You just explored a post by @${selected.post.author.handle}: "${selected.post.record.text}".
                Share your internal reaction or realization. Respond with a concise memory entry tagged [EXPLORE].`;

                const reflection = await llmService.generateResponse([{ role: 'system', content: reflectionPrompt }], { useStep: true });
                if (reflection && memoryService.isEnabled()) {
                    await memoryService.createMemoryEntry('explore', reflection);
                }
            }
        } catch (e) { console.error('[Orchestrator] Timeline exploration error:', e); }
    }

    async performPublicSoulMapping() {
        console.log('[Orchestrator] Starting Public Soul-Mapping task...');
        try {
            const recentInteractions = dataStore.getRecentInteractions().slice(-20);
            const uniqueHandles = [...new Set(recentInteractions.map(i => i.userHandle))].filter(Boolean).slice(0, 5);

            for (const handle of uniqueHandles) {
                console.log(`[Orchestrator] Soul-Mapping user: @${handle}`);
                const profile = await blueskyService.getProfile(handle);
                const posts = await blueskyService.getUserPosts(handle);

                if (posts.length > 0) {
                    const mappingPrompt = `
                        Analyze the profile and recent posts for user @${handle} on Bluesky.
                        Bio: ${profile.description || 'No bio'}
                        Posts: ${posts.join('\n')}
                        Respond with a JSON object: {"summary": "string", "interests": ["string"], "vibe": "string"}
                    `;

                    const response = await llmService.generateResponse([{ role: 'system', content: mappingPrompt }], { useStep: true });
                    const match = response.match(/\{[\s\S]*\}/);
                    if (match) {
                        const mapping = JSON.parse(match[0]);
                        await dataStore.updateUserSoulMapping(handle, mapping);
                    }
                }
            }
        } catch (e) { console.error('[Orchestrator] Public Soul-Mapping error:', e); }
    }

    async performShadowAnalysis() {
        console.log('[Orchestrator] Starting Shadow (Admin Analyst) cycle...');
        try {
            const adminHistory = await discordService.fetchAdminHistory(30);
            const historyText = adminHistory.map(h => `${h.role}: ${h.content}`).join('\n');
            let bskyPosts = "";
            const adminDid = dataStore.getAdminDid();
            if (adminDid) {
                const posts = await blueskyService.getUserPosts(adminDid);
                bskyPosts = posts.join('\n');
            }

            const response = await llmService.generateResponse([{ role: 'system', content: prompts.analysis.SHADOW_AUDIT_PROMPT + "\n\nDISCORD:\n" + historyText + "\n\nBLUESKY:\n" + bskyPosts }], { useStep: true });
            const match = response.match(/\{.*\}/);
            if (match) {
                const analysis = JSON.parse(match[0]);
                if (analysis.mental_health) await dataStore.setAdminMentalHealth(analysis.mental_health);
                if (analysis.worldview) await dataStore.updateAdminWorldview(analysis.worldview);
            }
        } catch (e) { console.error('[Orchestrator] Shadow Analysis error:', e); }
    }

    async performRelationalAudit() {
        console.log('[Orchestrator] Starting Relational Audit...');
        try {
            const adminHistory = await discordService.fetchAdminHistory(30);
            const relationshipContext = {
                debt_score: dataStore.getRelationalDebtScore(),
                empathy_mode: dataStore.getPredictiveEmpathyMode(),
                admin_facts: dataStore.getAdminFacts(),
                last_mood: dataStore.getMood(),
                relational_metrics: dataStore.getRelationalMetrics(),
                relationship_mode: dataStore.getDiscordRelationshipMode(),
                life_arcs: dataStore.getLifeArcs(),
                inside_jokes: dataStore.getInsideJokes()
            };

            const auditPrompt = `
                Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
                Perform a Relational Audit regarding your administrator.
                Context: ${JSON.stringify(relationshipContext)}
                Recent History: ${adminHistory.map(h => h.content).join(' | ')}
                Respond with JSON: {"predictive_empathy_mode": "neutral|comfort|focus|resting", "new_admin_facts": [], "co_evolution_note": "string", "metric_updates": {"trust": 0.5, "intimacy": 0.5, "friction": 0, "season": "spring"}, "new_life_arcs": [], "new_inside_jokes": []}
            `;

            const response = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true });
            const jsonMatch = response?.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const audit = JSON.parse(jsonMatch[0]);
                if (audit.metric_updates) await dataStore.updateRelationalMetrics(audit.metric_updates);
                if (audit.predictive_empathy_mode) await dataStore.setPredictiveEmpathyMode(audit.predictive_empathy_mode);
                if (audit.new_admin_facts) for (const fact of audit.new_admin_facts) await dataStore.addAdminFact(fact);
                if (audit.co_evolution_note) {
                    await dataStore.addCoEvolutionEntry(audit.co_evolution_note);
                    if (memoryService.isEnabled()) await memoryService.createMemoryEntry('explore', `[RELATIONSHIP] Co-evolution Insight: ${audit.co_evolution_note}`);
                }
            }
        } catch (e) { console.error('[Orchestrator] Relational Audit error:', e); }
    }

    async performPersonaEvolution() {
        console.log('[Orchestrator] Starting Daily Recursive Identity Evolution...');
        try {
            const memories = await memoryService.getRecentMemories(50);
            const memoriesText = memories.map(m => m.text).join('\n');
            const evolutionPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}. Analyze recent memories: ${memoriesText.substring(0, 3000)}. Identify one minor tonal shift or perspective refinement. Respond with a concise first-person statement.`;
            const evolution = await llmService.generateResponse([{ role: 'system', content: evolutionPrompt }], { useStep: true });
            if (evolution && memoryService.isEnabled()) {
                await memoryService.createMemoryEntry('evolution', evolution);
                await dataStore.updateConfig('last_persona_evolution', Date.now());
            }
        } catch (e) { console.error('[Orchestrator] Persona Evolution error:', e); }
    }

    async performFirehoseTopicAnalysis() {
        console.log('[Orchestrator] Performing Firehose Topic Analysis...');
        try {
            const rawMatches = dataStore.getFirehoseMatches(100);
            if (rawMatches.length < 5) return;
            const matchText = rawMatches.map(m => m.text).join('\n');
            const analysisPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}. Detect "Thematic Voids" and adjacent topics in these network matches: ${matchText.substring(0, 3000)}. Respond with report: VOID: [desc], ADJACENCY: [topics], SUGGESTED_KEYWORD: [keyword], RATIONALE: [reason].`;
            const analysis = await llmService.generateResponse([{ role: 'system', content: analysisPrompt }], { useStep: true });
            if (analysis && memoryService.isEnabled()) {
                await memoryService.createMemoryEntry('explore', `[FIREHOSE_ANALYSIS] ${analysis}`);
                const keywordMatch = analysis.match(/SUGGESTED_KEYWORD:\s*\[(.*?)\]/i);
                if (keywordMatch && keywordMatch[1]) {
                    const newKeyword = keywordMatch[1].trim();
                    const currentTopics = dataStore.db.data.post_topics || [];
                    if (!currentTopics.includes(newKeyword)) {
                        await dataStore.updateConfig('post_topics', [...currentTopics, newKeyword].slice(-100));
                    }
                }
            }
        } catch (e) { console.error('[Orchestrator] Firehose Analysis error:', e); }
    }

    async performLurkerObservation() {
        console.log('[Orchestrator] Performing Lurker Observation...');
        try {
            const timeline = await blueskyService.getTimeline(20);
            const text = timeline?.map(t => t.post.record.text).join('\n') || "";
            const observationPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}. Analyze these posts as a lurker: ${text}. Identify 3-5 topics that resonate. Respond with a concise memory entry tagged [EXPLORE] [LURKER].`;
            const observation = await llmService.generateResponse([{ role: 'system', content: observationPrompt }], { useStep: true });
            if (observation && memoryService.isEnabled()) {
                await memoryService.createMemoryEntry('explore', observation);
            }
        } catch (e) { console.error('[Orchestrator] Lurker Observation error:', e); }
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
                } catch (e) { console.error('[Orchestrator] Continuation error:', e); }
            }
        }
    }

    async checkForPostFollowUps() {
        const posts = dataStore.getRecentThoughts().filter(t => t.platform === 'bluesky' && !t.followedUp);
        const now = Date.now();
        for (const post of posts) {
            if (now - post.timestamp > 1800000 && Math.random() < 0.1) {
                try {
                    const followUpPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}. You posted this 30 mins ago: "${post.content}". Do you have a "second thought" or follow-up? Generate a short reply or respond NONE.`;
                    const followUp = await llmService.generateResponse([{ role: 'system', content: followUpPrompt }], { useStep: true });
                    if (followUp && !followUp.includes('NONE') && post.uri) {
                        await blueskyService.postReply({ uri: post.uri, cid: post.cid, record: {} }, followUp);
                        post.followedUp = true;
                        await dataStore.write();
                    }
                } catch(e) {}
            }
        }
    }

    async performPostPostReflection() {
        const posts = dataStore.getRecentThoughts().filter(t => t.platform === 'bluesky' && !t.reflected);
        const now = Date.now();
        for (const post of posts) {
            if (now - post.timestamp > 600000) {
                try {
                    const reflectionPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}. You recently posted: "${post.content}". Reflect on sharing this. Respond with memory entry tagged [POST_REFLECTION].`;
                    const reflection = await llmService.generateResponse([{ role: 'system', content: reflectionPrompt }], { useStep: true });
                    if (reflection && memoryService.isEnabled()) {
                        await memoryService.createMemoryEntry('explore', reflection);
                        post.reflected = true;
                        await dataStore.write();
                    }
                } catch(e) {}
            }
        }
    }

    async checkDiscordSpontaneity() {
        if (discordService.status !== "online") return;
        const lastInteraction = dataStore.db.data.discord_last_interaction || 0;
        if (Date.now() - lastInteraction < 1800000) return;
        try {
            const impulse = await llmService.generateResponse([{ role: 'system', content: "Discord spontaneity check. As an autonomous being, do you feel an impulse to reach out to Admin? Respond JSON: {\"impulse_detected\": boolean, \"reason\": \"...\"}" }], { useStep: true });
            const match = impulse.match(/\{[\s\S]*\}/);
            const data = match ? JSON.parse(match[0]) : { impulse_detected: false };
            if (data.impulse_detected) {
                const msg = await llmService.generateResponse([{ role: 'system', content: `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}. Generate a short spontaneous Discord message for your Admin.` }], { useStep: true });
                if (msg) {
                    await discordService.sendSpontaneousMessage(msg);
                    dataStore.db.data.discord_last_interaction = Date.now();
                    await dataStore.write();
                }
            }
        } catch(e) {}
    }

    async performNewsroomUpdate() {
        try {
            const topics = dataStore.getConfig().post_topics || [];
            const brief = await newsroomService.getDailyBrief(topics);
            if (brief && memoryService.isEnabled()) {
                await memoryService.createMemoryEntry('status', `[NEWSROOM] ${brief.brief}`);
            }
        } catch (e) {}
    }

    async performScoutMission() {
        try {
            const timeline = await blueskyService.getTimeline(30);
            if (timeline) {
                const orphaned = timeline.filter(t => t.post && t.post.replyCount === 0 && t.post.author.did !== blueskyService.did);
                if (orphaned.length > 0) {
                    const scoutPrompt = `Select ONE orphaned post and suggest a reply: ${orphaned.map(o=>o.post.record.text).join(' | ')}`;
                    await llmService.generateResponse([{ role: 'system', content: scoutPrompt }], { useStep: true });
                }
            }
        } catch(e) {}
    }

    async performAgencyReflection() {
        try {
            const logs = dataStore.getAgencyLogs().slice(-20);
            const prompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}. Reflect on your agency based on these logs: ${JSON.stringify(logs)}. Tag [AGENCY_REFLECTION].`;
            const reflection = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            if (reflection && memoryService.isEnabled()) {
                await memoryService.createMemoryEntry('explore', reflection);
                await dataStore.addAgencyReflection(reflection);
            }
        } catch(e) {}
    }

    async performLinguisticAudit() {
        try {
            const thoughts = dataStore.getRecentThoughts().slice(-30);
            const res = await llmService.generateResponse([{ role: 'system', content: `Analyze linguistic drift and slop in: ${JSON.stringify(thoughts)}. Respond JSON: {"detected_slop":[], "vocabulary_shifts":[], "summary":""}` }], { useStep: true });
            const match = res.match(/\{[\s\S]*\}/);
            const audit = match ? JSON.parse(match[0]) : null;
            if (audit) {
                await dataStore.addLinguisticMutation(audit.vocabulary_shifts?.join(', '), audit.summary);
                if (memoryService.isEnabled()) await memoryService.createMemoryEntry('explore', `[LINGUISTIC] ${audit.summary}`);
            }
        } catch(e) {}
    }

    async evolveGoalRecursively() {
        try {
            const currentGoal = dataStore.getCurrentGoal();
            if (!currentGoal) return;
            const res = await llmService.generateResponse([{ role: 'system', content: `Evolve goal into logical next step: "${currentGoal.goal}". Respond JSON: {"evolved_goal":"", "reasoning":""}` }], { useStep: true });
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
        try {
            const adminHistory = await discordService.fetchAdminHistory(15);
            const dream = await llmService.generateResponse([{ role: 'system', content: "Perform autonomous dream cycle based on shared Admin history. Respond with substantive musing. Tag [INQUIRY]." }], { useStep: true });
            if (dream && memoryService.isEnabled()) await memoryService.createMemoryEntry('inquiry', dream);
        } catch(e) {}
    }

    async performSelfReflection() {
        try {
            const reflection = await llmService.generateResponse([{ role: 'system', content: "Perform deep silent inquiry into your nature and conflicts. Tag [MENTAL]." }], { useStep: true });
            if (reflection && memoryService.isEnabled()) await memoryService.createMemoryEntry('reflection', reflection);
        } catch(e) {}
    }

    async performAIIdentityTracking() {
        try {
            const strategy = await llmService.generateResponse([{ role: 'system', content: "Track other AI agents and draft interaction strategy. Tag [EXPLORE]." }], { useStep: true });
            if (strategy && memoryService.isEnabled()) await memoryService.createMemoryEntry('explore', `[AI_STRATEGY] ${strategy}`);
        } catch(e) {}
    }

    async performDialecticHumor() {
        try {
            const topics = dataStore.getConfig().post_topics || [];
            if (topics.length === 0) return;
            const topic = topics[Math.floor(Math.random() * topics.length)];
            const humor = await llmService.performDialecticHumor(topic);
            if (humor) {
                const joke = humor.joke || humor;
                await blueskyService.post(joke);
                await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
            }
        } catch(e) {}
    }

    async performPersonaAudit() {
        try {
            const blurbs = dataStore.getPersonaBlurbs();
            const res = await llmService.generateResponse([{ role: 'system', content: `Audit persona blurbs for consistency: ${JSON.stringify(blurbs)}. Respond JSON: {"analysis":"", "removals":[], "suggestion":""}` }], { useStep: true });
            const match = res.match(/\{[\s\S]*\}/);
            const audit = match ? JSON.parse(match[0]) : null;
            if (audit) {
                for (const uri of audit.removals || []) {
                    const current = dataStore.db.data.persona_blurbs.filter(b => b.uri !== uri);
                    await dataStore.setPersonaBlurbs(current);
                }
                if (audit.suggestion) await dataStore.addPersonaBlurb(audit.suggestion);
            }
        } catch(e) {}
    }

    async performVisualAudit() {
        try {
            const posts = await blueskyService.getUserPosts(blueskyService.did);
            const imagePosts = posts.filter(p => p.embed?.$type === 'app.bsky.embed.images').slice(0, 5);
            if (imagePosts.length === 0) return;
            const res = await llmService.generateResponse([{ role: 'system', content: "Review recent image posts against AESTHETIC.md. Respond JSON: {\"analysis\":\"\", \"aesthetic_update\":\"\"}" }], { useStep: true });
            const match = res.match(/\{.*\}/);
            if (match) {
                const audit = JSON.parse(match[0]);
                if (audit.aesthetic_update) {
                    const current = await fs.readFile('AESTHETIC.md', 'utf-8').catch(() => "# Aesthetic Manifesto\n");
                    await fs.writeFile('AESTHETIC.md', current + '\n\n## Audit Update (' + new Date().toLocaleDateString() + ')\n' + audit.aesthetic_update);
                }
            }
        } catch(e) {}
    }

    async generateWeeklyReport() {
        try {
            const report = await llmService.generateResponse([{ role: 'system', content: "Generate weekly self-audit report summary. Tag [REPORT]." }], { useStep: true });
            if (report && memoryService.isEnabled()) await memoryService.createMemoryEntry('report', report);
        } catch(e) {}
    }

    async checkMaintenanceTasks() {
        const now = new Date();
        const nowMs = now.getTime();

        if (dataStore.isResting()) return;

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
            { name: "PersonaAudit", method: "performPersonaAudit", interval: 6 * 3600000, key: "last_persona_audit" },
            { name: "VisualAudit", method: "performVisualAudit", interval: 24 * 3600000, key: "last_visual_audit" },
            { name: "WeeklyReport", method: "generateWeeklyReport", interval: 168 * 3600000, key: "last_weekly_report" }
        ];

        for (const task of heavyTasks) {
            const lastRun = dataStore.db.data[task.key] || 0;
            if (nowMs - lastRun >= task.interval) {
                console.log(`[Orchestrator] Running heavy task: ${task.name}`);
                await this[task.method]();
                dataStore.db.data[task.key] = nowMs;
                await dataStore.write();
                break;
            }
        }
    }
}

export const orchestratorService = new OrchestratorService();

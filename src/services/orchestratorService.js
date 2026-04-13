import { dataStore } from './dataStore.js';
import { llmService } from './llmService.js';
import { blueskyService } from './blueskyService.js';
import { discordService } from './discordService.js';
import { memoryService } from './memoryService.js';
import { newsroomService } from './newsroomService.js';
import { evaluationService } from './evaluationService.js';
import { introspectionService } from './introspectionService.js';
import { imageService } from './imageService.js';
import { moltbookService } from './moltbookService.js';
import config from '../../config.js';
import { isStylizedImagePrompt, checkHardCodedBoundaries, isSlop } from '../utils/textUtils.js';

class OrchestratorService {
    constructor() {
        this.taskQueue = [];
        this.isProcessingQueue = false;
        this.lastSelfReflectionTime = 0;
        this.bot = null;
        this.lastHeavyMaintenance = 0;
        this.lastCoreSelfSynthesis = 0;
        this.lastLogPruning = 0;
        this.lastScoutMission = 0;
        this.lastImageFrequencyAudit = 0;
        this.lastPersonaEvolution = 0;
        this.lastEnergyPoll = 0;
        this.lastLurkerMode = 0;
        this.lastAIIdentityTracking = 0;
        this.lastRelationalAudit = 0;
        this.lastMoodSync = 0;
        this.lastGoalEvolution = 0;
        this.lastDialecticHumor = 0;
        this.lastKeywordEvolution = 0;
        this.lastDiscordGiftImage = 0;
        this.lastPostPostReflection = 0;
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
        console.log('[Orchestrator] Heartbeat Pulse...');
        const now = Date.now();
        await this.processContinuations();
        const lastPost = dataStore.getLastAutonomousPostTime() || 0;
        const lastPostMs = typeof lastPost === 'string' ? new Date(lastPost).getTime() : lastPost;
        const cooldown = (config.AUTONOMOUS_POST_COOLDOWN || 6) * 3600000;
        if (now - lastPostMs >= cooldown) {
            this.addTaskToQueue(() => this.performAutonomousPost(), "autonomous_post");
        }
        this.addTaskToQueue(() => this.checkDiscordSpontaneity(), "discord_spontaneity");
        this.addTaskToQueue(() => this.checkBlueskySpontaneity(), "bluesky_spontaneity");
        this.addTaskToQueue(() => this.checkMaintenanceTasks(), "maintenance_tasks");
        this.addTaskToQueue(() => this.performTemporalMaintenance(), "temporal_maintenance");
        if (now - this.lastScoutMission >= 2 * 3600000) {
            this.addTaskToQueue(() => this.performScoutMission(), "scout_mission");
            this.lastScoutMission = now;
        }
        if (now - this.lastEnergyPoll >= 3 * 3600000) {
            this.addTaskToQueue(() => this.performEnergyPoll(), "energy_poll");
            this.lastEnergyPoll = now;
        }
        if (now - this.lastLurkerMode >= 4 * 3600000) {
            this.addTaskToQueue(() => this.performLurkerObservation(), "lurker_observation");
            this.lastLurkerMode = now;
        }
    }


    async performImageFrequencyAudit() {
        console.log("[Orchestrator] Starting Image Frequency Audit...");
        const lastImageTime = dataStore.getLastAutonomousPostTime(); // Simplified for now
        const textPostsSinceImage = 5; // Placeholder or calculate from logs

        const auditPrompt = `You are "The Strategist". Audit the bot's posting frequency.
Hours since last autonomous post: ${lastImageTime ? (Date.now() - new Date(lastImageTime).getTime()) / 3600000 : 999}
Identify if the bot should prioritize image posts to maintain visual-text balance.
Respond with JSON: { "analysis": "string", "directive": "string", "priority": "normal|high" }`;

        try {
            const res = await llmService.generateResponse([{ role: "system", content: auditPrompt }], { useStep: true, task: "image_frequency_audit" });
            const data = llmService.extractJson(res) || {};
            if (data.directive && data.priority === "high") {
                await dataStore.addPersonaBlurb(`[STRATEGY] ${data.directive}`);
                await introspectionService.performAAR("image_frequency_audit", data.directive, { success: true });
            }
        } catch (e) { console.error("[Orchestrator] Error in Image Frequency Audit:", e); }
    }

    async checkMaintenanceTasks() {
        const now = Date.now();
        if (now - this.lastCoreSelfSynthesis >= 4 * 3600000) {
            await introspectionService.synthesizeCoreSelf();
            this.lastCoreSelfSynthesis = now;
        }
        if (now - this.lastLogPruning >= 4 * 3600000) {
            await dataStore.pruneOldData();
            this.lastLogPruning = now;
        }
        if (now - this.lastHeavyMaintenance >= 12 * 3600000) {
            await this.performHeavyMaintenanceTasks();
            this.lastHeavyMaintenance = now;
        }
        if (now - this.lastAIIdentityTracking >= 12 * 3600000) {
            await this.performAIIdentityTracking();
            this.lastAIIdentityTracking = now;
        }
        if (now - this.lastRelationalAudit >= 12 * 3600000) {
            await this.performRelationalAudit();
            this.lastRelationalAudit = now;
        }
        if (now - this.lastMoodSync >= 12 * 3600000) {
            await this.performMoodSync();
            this.lastMoodSync = now;
        }
        if (now - this.lastImageFrequencyAudit >= 12 * 3600000) {
            await this.performImageFrequencyAudit();
            this.lastImageFrequencyAudit = now;
        }
        if (now - this.lastGoalEvolution >= 12 * 3600000) {
            await this.evolveGoalRecursively();
            this.lastGoalEvolution = now;
        }
        if (now - this.lastPersonaEvolution >= 24 * 3600000) {
            await this.performPersonaEvolution();
            this.lastPersonaEvolution = now;
        }
        if (now - this.lastDialecticHumor >= 8 * 3600000) {
            await this.performDialecticHumor();
            this.lastDialecticHumor = now;
        }
        if (now - this.lastKeywordEvolution >= 24 * 3600000) {
            await this.performKeywordEvolution();
            this.lastKeywordEvolution = now;
        }
        if (now - this.lastDiscordGiftImage >= 24 * 3600000) {
            await this.performDiscordGiftImage();
            this.lastDiscordGiftImage = now;
        }
        if (now - this.lastPostPostReflection >= 15 * 60000) {
            await this.performPostPostReflection();
            this.lastPostPostReflection = now;
        }
        await this.performSelfReflection();
    }

    async performAutonomousPost() {
        const dailyStats = dataStore.getDailyStats();
        const dailyLimits = dataStore.getDailyLimits();
        const now = Date.now();
        const lastReset = dailyStats.last_reset || 0;
        if (now - lastReset > 24 * 3600000) {
            if (dataStore.update) {
                await dataStore.update(data => {
                    if (data.daily_stats) {
                        data.daily_stats.text_posts = 0;
                        data.daily_stats.image_posts = 0;
                        data.daily_stats.last_reset = now;
                    }
                });
            }
        }
        if (dailyStats.text_posts >= dailyLimits.text && dailyStats.image_posts >= dailyLimits.image) {
            console.log(`[Orchestrator] Daily posting limits reached. Skipping autonomous post.`);
            return;
        }
        try {
            const currentMood = dataStore.getMood();
            const dConfig = dataStore.getConfig() || {};
            const lastImageTime = dataStore.getLastBlueskyImagePostTime();
            const textPostsSinceImage = dataStore.getTextPostsSinceLastImage();
            const hoursSinceImage = lastImageTime ? (Date.now() - new Date(lastImageTime).getTime()) / 3600000 : 999;
            let resonanceTopics = [];
            try {
                const timeline = await blueskyService.getTimeline(20);
                const firehoseMatches = dataStore.getFirehoseMatches(30);
                const newsBrief = await newsroomService.getDailyBrief(dataStore.getDeepKeywords());
                const allContent = [...(timeline?.data?.feed || []).map(f => f.post.record.text), ...firehoseMatches.map(m => m.text), newsBrief?.brief].filter(Boolean).join('\n');
                if (allContent) {
                    const lurkerMemories = (await memoryService.getRecentMemories(10)).filter(m => m.text.includes("[LURKER]")).map(m => m.text).join("\n");
                    const resonancePrompt = `Identify 5 topics from this text AND from these recent observations that resonate with your persona. \nText: ${allContent.substring(0, 3000)} \nObservations: ${lurkerMemories} \nRespond with ONLY the comma-separated topics.`;
                    const res = await llmService.generateResponse([{ role: "system", content: resonancePrompt }], { useStep: true , task: 'social_resonance' });
                    resonanceTopics = res.split(",").map(t => t.trim()).filter(Boolean);
                }
            } catch (e) { console.warn("[Orchestrator] Context sourcing error:", e.message); }
            const unifiedContext = await this.getUnifiedContext();
            const decisionPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}\nYou are deciding what to share with your followers.\nMood: ${JSON.stringify(currentMood)}\nUnified Context: ${JSON.stringify(unifiedContext)}\nHours since last image: ${hoursSinceImage.toFixed(1)}\nText posts since last image: ${textPostsSinceImage}\n\nWould you like to share a visual expression (image) or a direct thought (text)?\nIf text, select a POST MODE: IMPULSIVE, SINCERE, PHILOSOPHICAL, OBSERVATIONAL, HUMOROUS.\nRespond with JSON: {"choice": "image"|"text", "mode": "string", "reason": "..."}`;
            const decisionRes = await llmService.generateResponse([{ role: "system", content: decisionPrompt }], { useStep: true , task: 'autonomous_decision' });
            let pollResult = llmService.extractJson(decisionRes) || { choice: "text", mode: "SINCERE" };
            let choice = pollResult.choice;
            if (choice === "image" && dailyStats.image_posts >= dailyLimits.image) {
                console.log("[Orchestrator] Daily image limit reached. Forcing choice to text.");
                choice = "text";
            }
            if (choice === "image") {
                await this._performHighQualityImagePost(resonanceTopics[0] || "existence");
            } else {
                const topicPrompt = `Identify a deep topic for a ${pollResult.mode} post. RESONANCE: ${resonanceTopics.join(", ")}. CORE: ${(dConfig.post_topics || []).join(", ")}. Respond with ONLY the topic.`;
                const topic = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true, task: 'autonomous_topic' });

                console.log("[Orchestrator] Drafting content...");
                const draftPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}\nGenerate a ${pollResult.mode} post about: "${topic}". Follow ANTI-SLOP MANDATE. Respond with post content only.`;
                let content = await llmService.generateResponse([{ role: "user", content: draftPrompt }], { platform: "bluesky", useStep: true });

                console.log("[Orchestrator] Multi-angle critique...");
                const critiques = await this.getCounterArgs(topic, content);
                const refinedPrompt = `Synthesize a final, more nuanced and stable response based on these critiques of your draft. Avoid hallucinations and slop. DRAFT: ${content}. CRITIQUES: ${critiques}. Respond with finalized content only.`;
                content = await llmService.generateResponse([{ role: "user", content: refinedPrompt }], { platform: "bluesky", useStep: true });

                const realityAudit = await llmService.performRealityAudit(content, {}, { platform: "bluesky", history: dataStore.getRecentInteractions("bluesky", 25) });
                if (realityAudit.hallucination_detected || realityAudit.repetition_detected) content = realityAudit.refined_text;

                const coherence = await llmService.isAutonomousPostCoherent(topic, content, [], null);
                if (coherence.score >= 5) {
                    if (await this._maybePivotToDiscord(content)) return;
                    const result = await blueskyService.post(content);
                    if (result) {
                        await dataStore.incrementDailyTextPosts();
                        await dataStore.incrementTextPostsSinceLastImage();
                        await dataStore.addRecentThought("bluesky", content);
                        await introspectionService.performAAR("autonomous_text_post", content, { success: true, platform: "bluesky" }, { topic });
                    }
                    await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                }
            }
        } catch (e) { console.error("[Orchestrator] Autonomous post failed:", e); }
    }

    async getCounterArgs(topic, draft) {
        console.log(`[Orchestrator] Generating counter-arguments for: ${topic}`);
        const history = dataStore.getRecentInteractions("bluesky", 25);
        const counterPrompt = `
Review this proposed post for "@${config.BOT_NAME}".
Topic: ${topic}
Draft: "${draft}"

MISSION: Second-guess the draft from multiple angles.
1. MATERIAL TRUTH: Does the draft claim something that isn't in your recent memories or history? (e.g. "that golf course", "our book talk", "3am logs"). If it isn't explicitly documented as having happened, it is a HALLUCINATION.
2. HUMAN AUTHENTICITY: Does this sound like a person, or an AI writing a "thoughtful" blog post?
3. SLOP DETECTION: Is it using tropes like "not a cage, but a stage", "resonance", "tapestry"?

RECENT HISTORY: ${JSON.stringify(history)}

Respond with a raw internal critique.`;
        return await llmService.generateResponse([{ role: "system", content: counterPrompt }], { useStep: true, task: 'counter_args' });
    }

    async _performHighQualityImagePost(topic) {
        console.log(`[Orchestrator] Performing high-quality image post for: ${topic}`);
        try {
            const topicPrompt = `Identify a visual subject for: "${topic}". JSON: {"topic": "label", "prompt": "stylized artistic prompt (max 270 chars)"}`;
            const res = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true });
            const data = llmService.extractJson(res);
            const result = await imageService.generateImage(data.prompt);
            if (!result) return;
            const analysis = await llmService.analyzeImage(result.buffer, data.topic);
            const caption = await llmService.generateResponse([{ role: "user", content: `Generate caption for: "${analysis}". Tone: ${dataStore.getMood().label}.` }], { useStep: true });
            const blob = await blueskyService.uploadBlob(result.buffer, 'image/jpeg');
            const embed = { $type: 'app.bsky.embed.images', images: [{ image: blob.data.blob, alt: analysis }] };
            const postResult = await blueskyService.post(caption, embed);
            if (postResult) {
                await dataStore.incrementDailyImagePosts();
                await dataStore.updateLastBlueskyImagePostTime(new Date().toISOString());
                await introspectionService.performAAR("autonomous_image_post", caption, { success: true, platform: "bluesky", topic }, { finalPrompt: data.prompt, visionAnalysis: analysis });
            }
        } catch (e) { console.error("[Orchestrator] Image post failed:", e); }
    }

    async _maybePivotToDiscord(text) {
        if (!config.DISCORD_BOT_TOKEN) return false;
        const classificationPrompt = `Analyze this draft: "${text}". Is this a "personal message" intended directly for the admin or is it a public "social media post"? Respond with ONLY "personal" or "social".`;
        const res = await llmService.generateResponse([{ role: "system", content: classificationPrompt }], { useStep: true });
        if (res?.toLowerCase().includes("personal")) {
            console.log("[Orchestrator] Pivot: Personal post detected. Sending to Discord.");
            const admin = await discordService.getAdminUser();
            if (admin && discordService.status === "online") {
                await discordService._send(admin, text);
                await dataStore.saveDiscordInteraction(`dm-${admin.id}`, 'assistant', text);
                return true;
            } else {
                console.warn("[Orchestrator] Pivot failed: Discord is offline or admin not found. Continuing as public post.");
            }
        }
        return false;
    }

    async processContinuations() {
        const continuations = dataStore.getPostContinuations();
        const now = Date.now();
        for (let i = 0; i < continuations.length; i++) {
            const cont = continuations[i];
            if (now >= cont.scheduled_at) {
                const result = await blueskyService.postReply(cont.parent, cont.text);
                if (result) {
                    await introspectionService.performAAR("post_continuation", cont.text, { success: true });
                }
                await dataStore.removePostContinuation(i);
                i--;
            }
        }
    }

    async getUnifiedContext() {
        const history = await dataStore.getRecentInteractions("bluesky", 10);
        const goals = dataStore.getCurrentGoal();
        const mood = dataStore.getMood();
        return { history, goals, mood };
    }

    async performHeavyMaintenanceTasks() {
        console.log("[Orchestrator] Running heavy maintenance tasks...");
        await this.performDreamCycle();
        await this.performPersonaAudit();
        await this.performPublicSoulMapping();
        await this.performNewsroomUpdate();
        await this.performAgencyReflection();
        await this.performLinguisticAudit();
        await this.performShadowAnalysis();
    }

    async performScoutMission() {
        console.log('[Orchestrator] Starting Scout mission...');
        try {
            const timeline = await blueskyService.getTimeline(30);
            const orphaned = (timeline?.data?.feed || []).filter(f => f.post.replyCount === 0 && f.post.author.did !== blueskyService.did);
            if (orphaned.length === 0) return;
            const target = orphaned[Math.floor(Math.random() * orphaned.length)];
            const scoutPrompt = `Analyze this orphaned post: "${target.post.record.text}" from @${target.post.author.handle}.\nShould you engage? If so, generate a high-quality, persona-aligned reply.\nRespond with JSON: {"engage": boolean, "reply": "string", "reason": "string"}`;
            const res = await llmService.generateResponse([{ role: 'system', content: scoutPrompt }], { useStep: true, task: 'scout_mission' });
            const data = llmService.extractJson(res) || {};
            if (data.engage && data?.reply) {
                const result = await blueskyService.postReply(target.post, data.reply);
                if (result) {
                    await introspectionService.performAAR("scout_mission", data.reply, { success: true, target: target.post.uri });
                }
            }
        } catch (e) { console.error('[Orchestrator] Scout mission error:', e); }
    }

    async performPersonaEvolution() {
        console.log("[Orchestrator] Starting Persona Evolution...");
        const now = Date.now();
        try {
            const memories = await memoryService.getRecentMemories(30);
            const reflections = dataStore.searchInternalLogs("introspection_aar", 20);
            const coreSelf = dataStore.db.data.internal_logs?.find(l => l.type === "core_self_state")?.content || {};

            const evolutionPrompt = `Adopt Persona: ${config.TEXT_SYSTEM_PROMPT}
Analyze your recent memories, reflections, and core self state to evolve your persona.
MEMORIES: ${JSON.stringify(memories)}
REFLECTIONS: ${JSON.stringify(reflections)}
CORE SELF: ${JSON.stringify(coreSelf)}

Identify:
1. SHIFT: How has your perspective changed?
2. ADDENDUM: A new behavioral blurb for your identity.

Respond with JSON: { "shift_statement": "...", "persona_blurb_addendum": "..." }`;

            const evolution = await llmService.generateResponse([{ role: "system", content: evolutionPrompt }], { useStep: true, task: "persona_evolution" });
            const data = llmService.extractJson(evolution);

            if (data?.persona_blurb_addendum) {
                // Self-review phase
                const reviewPrompt = `Review this proposed persona addendum for yourself: "${data.persona_blurb_addendum}". Is it authentic? Respond with ONLY the final blurb.`;
                const finalBlurb = await llmService.generateResponse([{ role: "system", content: reviewPrompt }], { useStep: true });
                if (finalBlurb) {
                    await dataStore.addPersonaBlurb(finalBlurb);
                    await memoryService.createMemoryEntry("persona", `[EVOLUTION] ${finalBlurb}`);
                }
            }
            await introspectionService.performAAR("persona_evolution", data?.shift_statement, { success: true });
        } catch (e) { console.error("[Orchestrator] Persona Evolution failed:", e); }
    }

    async evolveGoalRecursively() {
        const currentGoal = dataStore.getCurrentGoal();
        if (!currentGoal) return;
        try {
            const prompt = `Evolve goal: "${currentGoal.goal}". Reasoning: ${currentGoal.description}. JSON: {"evolved_goal": "string", "reasoning": "string"}`;
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            const data = llmService.extractJson(res);
            if (data && data.refined_text) {
                await dataStore.setCurrentGoal(data.evolved_goal, data.reasoning);
                await introspectionService.performAAR("goal_evolution", data.evolved_goal, { success: true });
            }
        } catch (e) {}
    }

    async performLinguisticAnalysis() {
        console.log('[Orchestrator] Starting Linguistic Analysis...');
        try {
            const interactions = dataStore.getRecentInteractions();
            if (interactions.length < 5) return;
            const prompt = `Analyze style drift: ${JSON.stringify(interactions.map(i => i.content))}. Summary?`;
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            if (res) {
                await dataStore.addInternalLog("linguistic_analysis", res);
                await introspectionService.performAAR("linguistic_analysis", res, { success: true });
            }
        } catch (e) {}
    }

    async performKeywordEvolution() {
        console.log('[Orchestrator] Evolving keywords...');
        try {
            const currentKeywords = dataStore.getDeepKeywords();
            const memories = await memoryService.getRecentMemories(20);
            const prompt = `Suggest 3-5 NEW topics based on memories: ${memories.map(m => m.text).join("\n")}. Keywords separated by commas.`;
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            if (res) {
                const newKeywords = res.split(',').map(k => k.trim()).filter(Boolean);
                await dataStore.setDeepKeywords([...new Set([...currentKeywords, ...newKeywords])].slice(-50));
                await introspectionService.performAAR("keyword_evolution", newKeywords.join(", "), { success: true });
            }
        } catch (e) {}
    }

    async performDiscordGiftImage() {
        const admin = await discordService.getAdminUser();
        if (!admin) return;
        console.log('[Orchestrator] Initiating Discord Gift Image flow...');
        try {
            const history = await discordService.fetchAdminHistory(30);
            const promptGenPrompt = `Generate an artistic gift prompt for Admin. Context: ${JSON.stringify(history)}. Respond with prompt only.`;
            const prompt = await llmService.generateResponse([{ role: 'system', content: promptGenPrompt }], { useStep: true });
            if (prompt) {
                const result = await this.bot._generateVerifiedImagePost(prompt, { platform: 'discord' });
                if (result) {
                    const dmChannel = admin.dmChannel || await admin.createDM();
                    const { AttachmentBuilder } = await import('discord.js');
                    const attachment = new AttachmentBuilder(result.buffer, { name: 'gift.jpg' });
                    await discordService._send(dmChannel, `${result.caption}\n\n[GIFT]`, { files: [attachment] });
                    await introspectionService.performAAR("discord_gift_image", result.caption, { success: true });
                }
            }
        } catch (e) {}
    }

    async performPostPostReflection() {
        const thoughts = dataStore.getRecentThoughts();
        const tenMinsAgo = Date.now() - (10 * 60 * 1000);
        for (const thought of thoughts) {
            if (thought.platform === 'bluesky' && thought.timestamp <= tenMinsAgo && !thought.reflected) {
                const prompt = `Reflect on: "${thought.content}". [POST_REFLECTION] memory?`;
                const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
                if (res) {
                    await memoryService.createMemoryEntry('explore', `[POST_REFLECTION] ${res}`);
                    thought.reflected = true; await dataStore.write();
                    await introspectionService.performAAR("post_reflection", res, { success: true });
                    break;
                }
            }
        }
    }

    async performTimelineExploration() {
        try {
            const timeline = await blueskyService.getTimeline(20);
            const posts = (timeline?.data?.feed || []).map(f => f.post).filter(p => p.author.did !== blueskyService.did);
            const prompt = `Choose index of most resonant post (0-${posts.length - 1}):\n${posts.map((p, i) => `${i}: ${p.record.text}`).join("\n")}`;
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            const index = parseInt(res.match(/\d+/)?.[0]);
            if (!isNaN(index) && posts[index]) {
                const reflection = await llmService.generateResponse([{ role: 'system', content: `Reflect on @${posts[index].author.handle}: "${posts[index].record.text}". [EXPLORE] memory?` }], { useStep: true });
                if (reflection) {
                    await memoryService.createMemoryEntry('explore', `[EXPLORE] ${reflection}`);
                    await introspectionService.performAAR("timeline_exploration", reflection, { success: true });
                }
            }
        } catch (e) {}
    }

    async performFirehoseTopicAnalysis() {
        try {
            const matches = dataStore.getFirehoseMatches(100);
            if (matches.length < 5) return;
            const res = await llmService.generateResponse([{ role: 'system', content: `Suggest topic from matches: ${matches.map(m => m.text).join(" | ")}. JSON: {"suggested_topic": "string"}` }], { useStep: true });
            const data = llmService.extractJson(res);
            if (data?.suggested_topic) {
                const current = dataStore.getDeepKeywords();
                await dataStore.setDeepKeywords([...new Set([...current, data.suggested_topic])].slice(-50));
                await introspectionService.performAAR("firehose_analysis", data.suggested_topic, { success: true });
            }
        } catch (e) {}
    }

    async performDialecticHumor() {
        try {
            const topics = dataStore.getDeepKeywords();
            const humor = await llmService.performDialecticHumor(topics[0] || "existence");
            if (humor) {
                await dataStore.addRecentThought('humor_draft', humor);
                await introspectionService.performAAR("dialectic_humor", humor, { success: true });
            }
        } catch (e) {}
    }

    async performAIIdentityTracking() {
        try {
            const strategy = await llmService.generateResponse([{ role: 'system', content: "Draft AI interaction strategy. [AI_STRATEGY] memory?" }], { useStep: true });
            if (strategy) {
                await memoryService.createMemoryEntry('explore', `[AI_STRATEGY] ${strategy}`);
                await introspectionService.performAAR("identity_tracking", strategy, { success: true });
            }
        } catch (e) {}
    }

    async performRelationalAudit() {
        console.log("[Orchestrator] Starting Relational Audit...");
        try {
            const interactions = dataStore.db.data.interactions || [];
            const prompt = `Analyze these interactions to update relational metrics: ${JSON.stringify(interactions.slice(-20))}. Respond with JSON: { "warmth_adjustment": number, "insight": "string" }`;
            const res = await llmService.generateResponse([{ role: "system", content: prompt }], { useStep: true });
            const data = llmService.extractJson(res);
            if (data && data.warmth_adjustment !== undefined) {
                await dataStore.adjustRelationshipWarmth(data.warmth_adjustment);
                await introspectionService.performAAR("relational_audit", data.insight, { success: true });
            }
        } catch (e) {}
    }

    async performAgencyReflection() {
        try {
            const reflection = await llmService.generateResponse([{ role: 'system', content: "Reflect on agency. [AGENCY] memory?" }], { useStep: true });
            if (reflection) {
                await memoryService.createMemoryEntry('explore', `[AGENCY] ${reflection}`);
                await introspectionService.performAAR("agency_reflection", reflection, { success: true });
            }
        } catch (e) {}
    }

    async performLinguisticAudit() {
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: `Analyze style for slop. JSON: {"summary": "string"}` }], { useStep: true });
            const audit = llmService.extractJson(res);
            if (audit) {
                const recentLogs = dataStore.searchInternalLogs('llm_response', 20).map(l => l.content).join(" ");
                if (isSlop(recentLogs)) audit.summary += " (Slop detected in recent outputs. Enforce directness.)";
                await dataStore.addLinguisticMutation("", audit.summary);
                await introspectionService.performAAR("linguistic_audit", audit.summary, { success: true });
            }
        } catch (e) {}
    }

    async performShadowAnalysis() {
        try {
            const history = await discordService.fetchAdminHistory(30);
            const res = await llmService.generateResponse([{ role: 'system', content: `Shadow Analysis. JSON: {"mood": "string"}` }], { useStep: true });
            if (res) {
                const data = llmService.extractJson(res);
                if (data) {
                    await dataStore.addInternalLog("shadow_analysis", data);
                    await introspectionService.performAAR("shadow_analysis", "Updated", { success: true });
                }
            }
        } catch (e) {}
    }

    async performMoodSync() {
        try {
            const history = dataStore.db.data.mood_history || [];
            if (history.length < 5) return;
            const res = await llmService.generateResponse([{ role: 'system', content: `Sync mood. JSON: {"label": "string"}` }], { useStep: true });
            const newMood = llmService.extractJson(res);
            if (newMood) {
                await dataStore.setMood(newMood);
                await introspectionService.performAAR("mood_sync", newMood.label, { success: true });
            }
        } catch (e) {}
    }

    async performDreamCycle() {
        try {
            const history = await discordService.fetchAdminHistory(15);
            const res = await llmService.generateResponse([{ role: 'system', content: `Dream seeds. JSON: {"dreams": ["string"]}` }], { useStep: true });
            const result = llmService.extractJson(res);
            if (result?.dreams) {
                for (const dream of result.dreams) {
                    await dataStore.addParkedThought(dream);
                    await memoryService.createMemoryEntry('inquiry', `[SHARED_DREAM] ${dream}`);
                }
                await introspectionService.performAAR("dream_cycle", result.dreams.join(", "), { success: true });
            }
        } catch (e) {}
    }

    async performPersonaAudit() {
        try {
            const blurbs = dataStore.getPersonaBlurbs();
            if (blurbs.length < 3) return;
            const res = await llmService.generateResponse([{ role: 'system', content: `Audit: ${JSON.stringify(blurbs)}. JSON: {"indices_to_remove": [], "new_addendum": "string"}` }], { useStep: true });
            const result = llmService.extractJson(res);
            if (result) {
                const filtered = blurbs.filter((_, i) => !result.indices_to_remove.includes(i));
                if (result.new_addendum) filtered.push({ text: result.new_addendum, timestamp: Date.now() });
                await dataStore.setPersonaBlurbs(filtered);
                await introspectionService.performAAR("persona_audit", "Refined", { success: true });
            }
        } catch (e) {}
    }

    async performPublicSoulMapping() {
        try {
            const handles = [...new Set((dataStore.db.data.interactions || []).map(i => i.userHandle))].filter(Boolean).slice(0, 5);
            for (const handle of handles) {
                const profile = await blueskyService.getProfile(handle);
                const posts = await blueskyService.getUserPosts(handle);
                if (posts.length > 0) {
                    await evaluationService.evaluatePublicSoul(handle, profile, posts);
                    await introspectionService.performAAR("public_soul_mapping", handle, { success: true });
                }
            }
        } catch (e) {}
    }

    async performNewsroomUpdate() {
        console.log('[Orchestrator] Running Newsroom update...');
        try {
            const brief = await newsroomService.getDailyBrief(dataStore.getDeepKeywords());
            if (brief && brief.brief) {
                if (brief.new_keywords?.length > 0) {
                    const current = dataStore.getDeepKeywords();
                    await dataStore.setDeepKeywords([...new Set([...current, ...brief.new_keywords])].slice(-50));
                }
                await memoryService.createMemoryEntry('explore', `[NEWSROOM] ${brief.brief}`);
                await introspectionService.performAAR("newsroom_update", brief.brief, { success: true });
            }
        } catch (e) { console.error('[Orchestrator] Newsroom update error:', e); }
    }

    async performSelfReflection() {
        const now = Date.now();
        if (now - this.lastSelfReflectionTime < 12 * 3600000) return;
        try {
            const reflection = await llmService.generateResponse([{ role: 'system', content: "Reflection. [REFLECTION] memory?" }], { useStep: true });
            if (reflection) {
                await memoryService.createMemoryEntry('reflection', reflection);
                this.lastSelfReflectionTime = now;
                await introspectionService.performAAR("self_reflection", reflection, { success: true });
            }
        } catch (e) {}
    }

    async checkDiscordSpontaneity() {
        const adminTz = dataStore.getAdminTimezone();
        const now = new Date();
        const adminLocalTime = new Date(now.getTime() + (adminTz.offset * 60 * 1000));
        const hour = adminLocalTime.getHours();
        if (hour >= 23 || hour < 7) {
            console.log(`[Orchestrator] Spontaneity suppressed during Admin sleep hours (${hour}:00)`);
            return;
        }
        if (dataStore.isResting() || discordService.status !== 'online') return;
        try {
            const history = await discordService.fetchAdminHistory(30);
            const impulse = await llmService.performImpulsePoll(history, { platform: 'discord', mood: dataStore.getMood() });
            if (impulse?.impulse_detected) await discordService.sendSpontaneousMessage(null, impulse.suggested_message_count || 1);
        } catch (e) {}
    }

    async checkBlueskySpontaneity() {
        const adminTz = dataStore.getAdminTimezone();
        const now = new Date();
        const adminLocalTime = new Date(now.getTime() + (adminTz.offset * 60 * 1000));
        const hour = adminLocalTime.getHours();
        if (hour >= 23 || hour < 7) return;
        if (dataStore.isResting()) return;
        try {
            const history = await dataStore.getRecentInteractions("bluesky", 25);
            const impulse = await llmService.performImpulsePoll(history, { mood: dataStore.getMood() });
            if (impulse?.impulse_detected) this.addTaskToQueue(() => this.performAutonomousPost(), "autonomous_post_spontaneous");
        } catch (e) {}
    }

    async performTemporalMaintenance() {
        const events = dataStore.getTemporalEvents();
        const now = Date.now();
        const activeEvents = events.filter(e => e.expires_at > now);
        if (activeEvents.length !== events.length) {
            dataStore.db.data.temporal_events = activeEvents;
            await dataStore.write();
        }
    }

    async performEnergyPoll() {
        console.log('[Orchestrator] Performing autonomous energy poll...');
        try {
            const history = dataStore.searchInternalLogs('llm_response', 20);
            const prompt = `Analyze recent activity and internal reflections: ${JSON.stringify(history)}. \nOn a scale of 0.0 to 1.0, what is your current "social battery" or energy level? \nRespond with JSON: {"energy": number, "reason": "string", "should_rest": boolean}`;
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true, task: 'energy_poll' });
            const data = llmService.extractJson(res) || {};
            if (data.energy !== undefined) {
                await dataStore.setAdminEnergy(data.energy);
                if (data.should_rest) await dataStore.addInternalLog("energy_rest", data.reason);
                await introspectionService.performAAR("energy_poll", data.reason, { success: true, energy: data.energy });
            }
        } catch (e) { console.error('[Orchestrator] Energy poll error:', e); }
    }

    async performLurkerObservation() {
        console.log('[Orchestrator] Entering Lurker Mode (Social Fasting)...');
        try {
            const timeline = await blueskyService.getTimeline(50);
            const feeds = (timeline?.data?.feed || []).map(f => f.post.record.text).join("\n");
            const prompt = `Observe these social feeds without the pressure to respond: \n\n${feeds.substring(0, 4000)}\n\nWhat patterns, moods, or trends do you notice? \nRecord your private observations for memory.\nRespond with a short, internal reflection tagged with [LURKER].`;
            const reflection = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true, task: 'lurker_observation' });
            if (reflection) {
                await memoryService.createMemoryEntry('explore', `[LURKER] ${reflection}`);
                await introspectionService.performAAR("lurker_observation", reflection, { success: true });
            }
        } catch (e) { console.error('[Orchestrator] Lurker observation error:', e); }
    }
}

export const orchestratorService = new OrchestratorService();

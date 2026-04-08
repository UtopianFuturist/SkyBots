import { dataStore } from './dataStore.js';
import { llmService } from './llmService.js';
import { blueskyService } from './blueskyService.js';
import { discordService } from './discordService.js';
import { memoryService } from './memoryService.js';
import { newsroomService } from './newsroomService.js';
import { evaluationService } from './evaluationService.js';
import { introspectionService } from './introspectionService.js';
import { imageService } from './imageService.js';
import config from '../../config.js';
import { isStylizedImagePrompt, checkHardCodedBoundaries } from '../utils/textUtils.js';

class OrchestratorService {
    constructor() {
        this.taskQueue = [];
        this.isProcessingQueue = false;
        this.lastSelfReflectionTime = 0;
        this.bot = null;

        // Task tracking last run times
        this.lastFirehoseTopicAnalysis = 0;
        this.lastDialecticHumor = 0;
        this.lastAIIdentityTracking = 0;
        this.lastTimelineExploration = 0;
        this.lastRelationalAudit = 0;
        this.lastHeavyMaintenance = 0;
        this.lastPostPostReflection = 0;
        this.lastMoodSync = 0;
        this.lastScoutMission = 0;
        this.lastPersonaEvolution = 0;
        this.lastGoalEvolution = 0;
        this.lastLinguisticAnalysis = 0;
        this.lastKeywordEvolution = 0;
        this.lastDiscordGiftImage = 0;
    }

    setBotInstance(bot) {
        this.bot = bot;
    }

    async getUnifiedContext() {
        return {
            mood: dataStore.getMood(),
            goal: dataStore.getCurrentGoal(),
            energy: dataStore.getAdminEnergy(),
            warmth: dataStore.getRelationshipWarmth(),
            coreSelf: dataStore.db.data.internal_logs?.find(l => l.type === "core_self_state")?.content || {}
        };
    }

    async performAutonomousPost() {
        const dailyStats = dataStore.getDailyStats();
        const dailyLimits = dataStore.getDailyLimits();

        if (dailyStats.text_posts >= dailyLimits.text && dailyStats.image_posts >= dailyLimits.image) {
            console.log(`[Orchestrator] Daily posting limits reached. Skipping autonomous post.`);
            return;
        }

        try {
            const profile = await blueskyService.getProfile(config.BLUESKY_IDENTIFIER);
            const followerCount = profile?.followersCount || 0;
            const currentMood = dataStore.getMood();
            const dConfig = dataStore.getConfig() || {};
            const postTopics = (dConfig.post_topics || []).filter(Boolean);

            const lastImageTime = dataStore.getLastBlueskyImagePostTime();
            const textPostsSinceImage = dataStore.getTextPostsSinceLastImage();
            const hoursSinceImage = lastImageTime ? (Date.now() - new Date(lastImageTime).getTime()) / 3600000 : 999;

            // 1. Context Sourcing
            let resonanceTopics = [];
            try {
                const timeline = await blueskyService.getTimeline(20);
                const firehoseMatches = dataStore.getFirehoseMatches(30);
                const newsBrief = await newsroomService.getDailyBrief(postTopics);

                const allContent = [
                    ...(timeline?.data?.feed || []).map(f => f.post.record.text),
                    ...firehoseMatches.map(m => m.text),
                    newsBrief?.brief
                ].filter(Boolean).join('\n');

                if (allContent) {
                    const lurkerMemories = (await memoryService.getRecentMemories(10)).filter(m => m.text.includes("[LURKER]")).map(m => m.text).join("\n");
                    const resonancePrompt = `Identify 5 topics from this text AND from these recent observations that resonate with your persona. \nText: ${allContent.substring(0, 3000)} \nObservations: ${lurkerMemories} \nRespond with ONLY the comma-separated topics.`;
                    const res = await llmService.generateResponse([{ role: "system", content: resonancePrompt }], { useStep: true , task: 'social_resonance' });
                    resonanceTopics = res.split(",").map(t => t.trim()).filter(Boolean);
                }
            } catch (e) { console.warn("[Orchestrator] Context sourcing error:", e.message); }

            // 2. Persona Decision Poll
            const unifiedContext = await this.getUnifiedContext();
            const decisionPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
You are deciding what to share with your followers.
Mood: ${JSON.stringify(currentMood)}
Unified Context: ${JSON.stringify(unifiedContext)}
Hours since last image: ${hoursSinceImage.toFixed(1)}
Text posts since last image: ${textPostsSinceImage}

Would you like to share a visual expression (image) or a direct thought (text)?
If text, select a POST MODE: IMPULSIVE, SINCERE, PHILOSOPHICAL, OBSERVATIONAL, HUMOROUS.
Respond with JSON: {"choice": "image"|"text", "mode": "string", "reason": "..."}`;

            const decisionRes = await llmService.generateResponse([{ role: "system", content: decisionPrompt }], { useStep: true , task: 'autonomous_decision' });
            let pollResult = { choice: "text", mode: "SINCERE" };
            try { pollResult = JSON.parse(decisionRes.match(/\{[\s\S]*\}/)[0]); } catch(e) {}

            let choice = pollResult.choice;
            if (choice === "image" && dailyStats.image_posts >= dailyLimits.image) {
                console.log("[Orchestrator] Daily image limit reached. Forcing choice to text.");
                choice = "text";
            }

            if (choice === "image") {
                await this._performHighQualityImagePost(resonanceTopics[0] || "existence");
            } else {
                // 3. Text Post Flow
                const topicPrompt = `Identify a deep topic for a ${pollResult.mode} post. RESONANCE: ${resonanceTopics.join(", ")}. CORE: ${postTopics.join(", ")}. Respond with ONLY the topic.`;
                const topic = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true, task: 'autonomous_topic' });

                const draftPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Generate a ${pollResult.mode} post about: "${topic}". Follow ANTI-SLOP MANDATE. Respond with post content only.`;
                let content = await llmService.generateResponse([{ role: "user", content: draftPrompt }], { platform: "bluesky", useStep: true });

                const realityAudit = await llmService.performRealityAudit(content, unifiedContext, { platform: "bluesky" });
                if (realityAudit.hallucination_detected || realityAudit.repetition_detected) content = realityAudit.refined_text;

                const coherence = await llmService.isAutonomousPostCoherent(topic, content, [], null);
                if (coherence.score >= 5) {
                    if (await this._maybePivotToDiscord(content)) return;

                    const result = await blueskyService.post(content, null, { maxChunks: 4 });
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

    async _maybePivotToDiscord(text) {
        if (!config.DISCORD_BOT_TOKEN) return false;
        const classificationPrompt = `Analyze this draft: "${text}". Is this a "personal message" intended directly for the admin or is it a public "social media post"? Respond with ONLY "personal" or "social".`;
        const res = await llmService.generateResponse([{ role: "system", content: classificationPrompt }], { useStep: true });
        if (res?.toLowerCase().includes("personal")) {
            console.log("[Orchestrator] Pivot: Personal post detected. Sending to Discord.");
            await discordService.sendSpontaneousMessage(text);
            await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
            await dataStore.addRecentThought("discord", text);
            return true;
        }
        return false;
    }

    async _performHighQualityImagePost(topic) {
        console.log(`[Orchestrator] Performing high-quality image post for: ${topic}`);
        try {
            const topicPrompt = `Identify a visual subject for: "${topic}". JSON: {"topic": "label", "prompt": "stylized artistic prompt (max 270 chars)"}`;
            const res = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true });
            const data = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);

            const result = await imageService.generateImage(data.prompt, { platform: "bluesky" });
            if (result) {
                const analysis = await llmService.analyzeImage(result.buffer, data.topic);
                const altText = await llmService.generateAltText(analysis);
                const captionPrompt = `Generate a caption for this image: "${analysis}". Topic: ${data.topic}. Tone: ${dataStore.getMood().label}.`;
                const caption = await llmService.generateResponse([{ role: "user", content: captionPrompt }], { useStep: true });

                const blob = await blueskyService.uploadBlob(result.buffer, 'image/jpeg');
                const embed = { $type: 'app.bsky.embed.images', images: [{ image: blob.data.blob, alt: altText }] };

                const postResult = await blueskyService.post(caption, embed, { maxChunks: 4 });
                if (postResult) {
                    await dataStore.incrementDailyImagePosts();
                    await dataStore.updateLastBlueskyImagePostTime(new Date().toISOString());
                    await dataStore.addRecentThought("bluesky", caption);
                    await introspectionService.performAAR("autonomous_image_post", caption, { success: true, platform: "bluesky", topic }, { finalPrompt: data.prompt, visionAnalysis: analysis });
                }
            }
        } catch (e) { console.error("[Orchestrator] Image post failed:", e); }
    }

    async processContinuations() {
        const continuations = dataStore.getPostContinuations();
        if (continuations.length === 0) return;
        const now = Date.now();
        for (let i = 0; i < continuations.length; i++) {
            const cont = continuations[i];
            if (now >= cont.scheduled_at) {
                console.log(`[Orchestrator] Executing post continuation (Type: ${cont.type})`);
                try {
                    if (await this._maybePivotToDiscord(cont.text)) {
                        await dataStore.removePostContinuation(i); i--; continue;
                    }
                    if (cont.type === 'thread') {
                        await blueskyService.postReply({ uri: cont.parent_uri, cid: cont.parent_cid, record: {} }, cont.text);
                    } else if (cont.type === 'quote') {
                        await blueskyService.post(cont.text, { quote: { uri: cont.parent_uri, cid: cont.parent_cid } });
                    }
                    await dataStore.removePostContinuation(i); i--;
                    await introspectionService.performAAR("post_continuation", cont.text, { success: true });
                } catch (e) { console.error('[Orchestrator] Error processing continuation:', e); }
            }
        }
    }

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
    }

    async checkMaintenanceTasks() {
        const now = Date.now();

        // 12 Hours
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
        if (now - this.lastGoalEvolution >= 12 * 3600000) {
            await this.evolveGoalRecursively();
            this.lastGoalEvolution = now;
        }

        // 8 Hours
        if (now - this.lastDialecticHumor >= 8 * 3600000) {
            await this.performDialecticHumor();
            this.lastDialecticHumor = now;
        }

        // 6 Hours
        if (now - this.lastFirehoseTopicAnalysis >= 6 * 3600000) {
            await this.performFirehoseTopicAnalysis();
            this.lastFirehoseTopicAnalysis = now;
        }

        // 4 Hours
        if (now - this.lastTimelineExploration >= 4 * 3600000) {
            await this.performTimelineExploration();
            this.lastTimelineExploration = now;
        }
        if (now - this.lastScoutMission >= 4 * 3600000) {
            await this.performScoutMission();
            this.lastScoutMission = now;
        }

        // 24 Hours
        if (now - this.lastPersonaEvolution >= 24 * 3600000) {
            await this.performPersonaEvolution();
            this.lastPersonaEvolution = now;
        }
        if (now - this.lastLinguisticAnalysis >= 24 * 3600000) {
            await this.performLinguisticAnalysis();
            this.lastLinguisticAnalysis = now;
        }
        if (now - this.lastKeywordEvolution >= 24 * 3600000) {
            await this.performKeywordEvolution();
            this.lastKeywordEvolution = now;
        }
        if (now - this.lastDiscordGiftImage >= 24 * 3600000) {
            await this.performDiscordGiftImage();
            this.lastDiscordGiftImage = now;
        }

        // Frequent
        if (now - this.lastPostPostReflection >= 15 * 60000) {
            await this.performPostPostReflection();
            this.lastPostPostReflection = now;
        }
        await this.performSelfReflection();

        const lastPruning = dataStore.db.data.last_pruning || 0;
        if (now - lastPruning >= 4 * 3600000) {
            await introspectionService.synthesizeCoreSelf();
            await dataStore.pruneOldData();
        }
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
            if (orphaned.length > 0) {
                const scoutPrompt = "Select an orphaned post and suggest a reply. Persona: " + config.TEXT_SYSTEM_PROMPT;
                await llmService.generateResponse([{ role: 'system', content: scoutPrompt }], { useStep: true, task: 'scout_mission' });
                await introspectionService.performAAR("scout_mission", "Scout mission evaluation", { success: true });
            }
        } catch (e) { console.error('[Orchestrator] Scout mission error:', e); }
    }

    async performPersonaEvolution() {
        console.log('[Orchestrator] Starting daily identity evolution...');
        try {
            const memories = await memoryService.getRecentMemories(20);
            const evolutionPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
You are deciding what to share with your followers.\nAnalyze memories: ${memories.map(m => m.text).join("\n")}\nIdentify one minor tone/interest shift. JSON: {"shift": "string"}`;
            const res = await llmService.generateResponse([{ role: 'system', content: evolutionPrompt }], { useStep: true, task: 'persona_evolution' });
            const match = res.match(/\{[\s\S]*\}/);
            if (match) {
                const data = JSON.parse(match[0]);
                if (data.shift) {
                    await memoryService.createMemoryEntry('evolution', `[EVOLUTION] ${data.shift}`);
                    await introspectionService.performAAR("persona_evolution", data.shift, { success: true });
                }
            }
        } catch (e) { console.error('[Orchestrator] Persona evolution error:', e); }
    }

    async evolveGoalRecursively() {
        const currentGoal = dataStore.getCurrentGoal();
        if (!currentGoal) return;
        try {
            const prompt = `Evolve goal: "${currentGoal.goal}". Reasoning: ${currentGoal.description}. JSON: {"evolved_goal": "string", "reasoning": "string"}`;
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            const match = res.match(/\{[\s\S]*\}/);
            if (match) {
                const data = JSON.parse(match[0]);
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
            const history = await discordService.fetchAdminHistory(15);
            const promptGenPrompt = `Generate an artistic gift prompt for Admin. Context: ${JSON.stringify(history)}. Respond with prompt only.`;
            const initialPrompt = await llmService.generateResponse([{ role: 'system', content: promptGenPrompt }], { useStep: true, platform: 'discord' });

            const result = await this.bot._generateVerifiedImagePost("gift", { initialPrompt, platform: 'discord', allowPortraits: true });
            if (result) {
                const alignment = await llmService.pollGiftImageAlignment(result.analysis, result.caption);
                if (alignment.decision === 'send') {
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
            if (posts.length === 0) return;
            const prompt = `Select interesting post index: ${posts.map(p => p.record.text).join(" | ")}.`;
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
            const data = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
            if (data.suggested_topic) {
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
        try {
            const history = await discordService.fetchAdminHistory(30);
            const res = await llmService.generateResponse([{ role: 'system', content: `Audit: ${JSON.stringify(history)}. JSON: {"metric_updates": {}, "new_admin_facts": []}` }], { useStep: true });
            const audit = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
            if (audit.metric_updates) await dataStore.updateRelationalMetrics(audit.metric_updates);
            if (audit.new_admin_facts) for (const f of audit.new_admin_facts) await dataStore.addAdminFact(f);
            await introspectionService.performAAR("relational_audit", "Updated", { success: true });
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
            const audit = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
            await dataStore.addLinguisticMutation("", audit.summary);
            await introspectionService.performAAR("linguistic_audit", audit.summary, { success: true });
        } catch (e) {}
    }

    async performShadowAnalysis() {
        try {
            const history = await discordService.fetchAdminHistory(30);
            const res = await llmService.generateResponse([{ role: 'system', content: `Shadow Analysis. JSON: {"mood": "string"}` }], { useStep: true });
            if (res) {
                const data = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
                await dataStore.addInternalLog("shadow_analysis", data);
                await introspectionService.performAAR("shadow_analysis", "Updated", { success: true });
            }
        } catch (e) {}
    }

    async performMoodSync() {
        try {
            const history = dataStore.db.data.mood_history || [];
            if (history.length < 5) return;
            const res = await llmService.generateResponse([{ role: 'system', content: `Sync mood. JSON: {"label": "string"}` }], { useStep: true });
            const newMood = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
            await dataStore.setMood(newMood);
            await introspectionService.performAAR("mood_sync", newMood.label, { success: true });
        } catch (e) {}
    }

    async performDreamCycle() {
        try {
            const history = await discordService.fetchAdminHistory(15);
            const res = await llmService.generateResponse([{ role: 'system', content: `Dream seeds. JSON: {"dreams": ["string"]}` }], { useStep: true });
            const result = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
            for (const dream of result.dreams) {
                await dataStore.addParkedThought(dream);
                await memoryService.createMemoryEntry('inquiry', `[SHARED_DREAM] ${dream}`);
            }
            await introspectionService.performAAR("dream_cycle", result.dreams.join(", "), { success: true });
        } catch (e) {}
    }

    async performPersonaAudit() {
        try {
            const blurbs = dataStore.getPersonaBlurbs();
            if (blurbs.length < 3) return;
            const res = await llmService.generateResponse([{ role: 'system', content: `Audit: ${JSON.stringify(blurbs)}. JSON: {"indices_to_remove": [], "new_addendum": "string"}` }], { useStep: true });
            const result = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
            const filtered = blurbs.filter((_, i) => !result.indices_to_remove.includes(i));
            if (result.new_addendum) filtered.push({ text: result.new_addendum, timestamp: Date.now() });
            await dataStore.setPersonaBlurbs(filtered);
            await introspectionService.performAAR("persona_audit", "Refined", { success: true });
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
        try {
            const brief = await newsroomService.getDailyBrief(dataStore.getDeepKeywords());
            if (brief.new_keywords?.length > 0) {
                const current = dataStore.getDeepKeywords();
                await dataStore.setDeepKeywords([...new Set([...current, ...brief.new_keywords])].slice(-50));
            }
            await introspectionService.performAAR("newsroom_update", brief.brief, { success: true });
        } catch (e) {}
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
        if (dataStore.isResting() || discordService.status !== 'online') return;
        try {
            const history = await discordService.fetchAdminHistory(20);
            const impulse = await llmService.performImpulsePoll(history, { platform: 'discord', mood: dataStore.getMood() });
            if (impulse?.impulse_detected) await discordService.sendSpontaneousMessage(null, impulse.suggested_message_count || 1);
        } catch (e) {}
    }

    async checkBlueskySpontaneity() {
        if (dataStore.isResting()) return;
        try {
            const history = await dataStore.getRecentInteractions("bluesky", 10);
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
}

export const orchestratorService = new OrchestratorService();

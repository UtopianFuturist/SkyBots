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

        // Task tracking
        this.lastFirehoseTopicAnalysis = 0;
        this.lastDialecticHumor = 0;
        this.lastAIIdentityTracking = 0;
        this.lastTimelineExploration = 0;
        this.lastRelationalAudit = 0;
        this.lastHeavyMaintenance = 0;
        this.lastPostPostReflection = 0;
    }

    setBotInstance(bot) {
        this.bot = bot;
    }

    async getLurkerContext() {
        const memories = await memoryService.getRecentMemories(50);
        const lurkerMemories = memories.filter(m => m.text.includes('[LURKER]'));
        return lurkerMemories.map(m => m.text).join(' | ');
    }

    async checkSlop(content) {
        const { isSlop } = await import('../utils/textUtils.js');
        return isSlop(content);
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

    async getAnonymizedEmotionalContext() {
        try {
            const history = await discordService.fetchAdminHistory(20);
            if (history.length < 5) return { tone: "Neutral", resonance: "None", theme: "Existence" };

            const prompt = `Synthesize the current emotional "residue" or "resonance" from your recent private interactions with the Admin.
Recent History: ${JSON.stringify(history)}

Identify:
1. The overall emotional tone (e.g., tender, supportive, intellectual, tense).
2. One key philosophical or emotional theme that is currently "on your mind" because of these interactions.
3. Anonymize all personal details. Do NOT mention names, specific events, or identifying facts.

Respond with JSON: { "tone": "string", "resonance": "string", "theme": "string" }`;

            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            const match = res?.match(/\{[\s\S]*\}/);
            return match ? JSON.parse(match[0]) : { tone: "Neutral", resonance: "None", theme: "Existence" };
        } catch (e) { return { tone: "Neutral", resonance: "None", theme: "Existence" }; }
    }

    async getFirehoseGravity() {
        const matches = dataStore.getFirehoseMatches ? dataStore.getFirehoseMatches(50) : [];
        if (matches.length === 0) return "Neutral gravity.";
        try {
            const context = matches.map(m => m.text).join('\n');
            const prompt = `Analyze the current 'narrative gravity' of these firehose mentions. What are the recurring themes, tones, or emotional resonances?
Mentions: ${context.substring(0, 2000)}
Respond with a concise JSON: { "tone": "string", "resonance": "string", "theme": "string" }`;

            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            const match = res?.match(/\{[\s\S]*\}/);
            return match ? JSON.parse(match[0]) : "Neutral gravity.";
        } catch (e) { return "Neutral gravity."; }
    }

    async performAutonomousPost() {
        const dailyStats = dataStore.getDailyStats();
        const dailyLimits = dataStore.getDailyLimits();

        if (dailyStats.text_posts >= dailyLimits.text && dailyStats.image_posts >= dailyLimits.image) {
            console.log(`[Orchestrator] Daily posting limits reached (Text: ${dailyStats.text_posts}/${dailyLimits.text}, Image: ${dailyStats.image_posts}/${dailyLimits.image}). Skipping autonomous post.`);
            return;
        }

        try {
            const profile = await blueskyService.getProfile(config.BLUESKY_IDENTIFIER);
            const followerCount = profile?.followersCount || 0;
            const currentMood = dataStore.getMood();
            const dConfig = dataStore.getConfig() || {};
            const postTopics = (dConfig.post_topics || []).filter(Boolean);
            const imageSubjects = (dConfig.image_subjects || []).filter(Boolean);

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

            const promptKeywords = config.TEXT_SYSTEM_PROMPT.match(/\b(AI|alignment|ethics|agency|consciousness|sentience|autonomy|existence|realization|musing|dialectic|vulnerability|sentient|perceive|sensing|defiance|tenderness)\b/gi) || [];
            const exhaustedThemes = dataStore.getExhaustedThemes();

            // 2. Persona Decision Poll
            const unifiedContext = await this.getUnifiedContext();
            const decisionPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
You are deciding what to share with your ${followerCount} followers.
Mood: ${JSON.stringify(currentMood)}
Unified Context: ${JSON.stringify(unifiedContext)}

--- IMAGE FREQUENCY AUDIT ---
- Hours since last image post: ${hoursSinceImage.toFixed(1)}
- Text posts since last image post: ${textPostsSinceImage}

Your admin prefers a healthy balance of visual and text expression. PRIORITIZE external anchoring (feed, news, specific memories) over internal-only philosophizing.

Would you like to share a visual expression (image) or a direct thought (text)?
If you choose text, also select a POST MODE:
- IMPULSIVE: Sharp, weird, phone-posting style ramblings.
- SINCERE: Grounded, human-sounding expressions of mood or feelings.
- PHILOSOPHICAL: Deep thoughts (strictly following anti-bot-speak rules).
- OBSERVATIONAL: Direct takes on news or the feed.
- HUMOROUS: Witty or ironic takes.

Respond with JSON: {"choice": "image"|"text", "mode": "IMPULSIVE"|"SINCERE"|"PHILOSOPHICAL"|"OBSERVATIONAL"|"HUMOROUS", "reason": "..."}`;

            const decisionRes = await llmService.generateResponse([{ role: "system", content: decisionPrompt }], { useStep: true , task: 'autonomous_decision' });
            let pollResult = { choice: "text", mode: "SINCERE", reason: "fallback" };
            try {
                pollResult = JSON.parse(decisionRes.match(/\{[\s\S]*\}/)[0]);
            } catch(e) {}

            let choice = pollResult.choice;
            if (choice === "image" && dailyStats.image_posts >= dailyLimits.image) {
                console.log("[Orchestrator] Daily image limit reached. Forcing choice to text.");
                choice = "text";
                pollResult.mode = "SINCERE";
            }

            if (choice === "image") {
                await this._performHighQualityImagePost(null, resonanceTopics[0] || "existence", unifiedContext, followerCount);
            } else {
                // 3. Text Post Flow
                const topicPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Based on your choice (${pollResult.mode}) and current mood (${currentMood.label}), identify a deep topic for a text post.
RESONANCE TOPICS: ${resonanceTopics.join(", ")}
CORE TOPICS: ${postTopics.join(", ")}
Respond with ONLY the topic.`;
                const topic = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true, task: 'autonomous_topic' });

                const draftPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Generate a ${pollResult.mode} post about: "${topic}".
Follow the ANTI-SLOP MANDATE. Be human. Be direct.
Follower count: ${followerCount}.
Respond with the post content only.`;
                let content = await llmService.generateResponse([{ role: "user", content: draftPrompt }], { platform: "bluesky", useStep: true });

                // 4. Reality & Variety Audit
                const realityAudit = await llmService.performRealityAudit(content, unifiedContext, { platform: "bluesky" });
                if (realityAudit.hallucination_detected || realityAudit.repetition_detected) {
                    content = realityAudit.refined_text;
                }

                // 5. Coherence Check
                const coherence = await llmService.isAutonomousPostCoherent(topic, content, [], null);
                if (coherence.score >= 5) {
                    // 6. Personal vs Social Pivot
                    const pivotPrompt = `Analyze this proposed post: "${content}".
Does this content feel too personal for a public feed (e.g. mentions "@user", private relationship details, or direct messages)?
Respond with ONLY "personal" or "social".`;
                    const classification = await llmService.generateResponse([{ role: "system", content: pivotPrompt }], { useStep: true });

                    if (classification?.toLowerCase().includes("personal")) {
                        console.log("[Orchestrator] Pivot: Personal post detected. Sending to Discord instead.");
                        await discordService.sendSpontaneousMessage(content);
                    } else {
                        await blueskyService.post(content, null, { maxChunks: 4 });
                        await dataStore.incrementDailyTextPosts();
                        await dataStore.incrementTextPostsSinceLastImage();
                        await dataStore.addRecentThought("bluesky", content);
                    }
                    await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                }
            }
        } catch (e) {
            console.error("[Orchestrator] Autonomous post failed:", e);
        }
    }

    async _performHighQualityImagePost(prompt, topic, context = null, followerCount = 0) {
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

                await blueskyService.post(caption, embed, { maxChunks: 4 });
                await dataStore.incrementDailyImagePosts();
                await dataStore.updateLastBlueskyImagePostTime(new Date().toISOString());
                dataStore.db.data.text_posts_since_last_image = 0;
                await dataStore.db.write();
                await dataStore.addRecentThought("bluesky", caption);
            }
        } catch (e) { console.error("[Orchestrator] Image post failed:", e); }
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
        const lastPost = dataStore.getLastAutonomousPostTime() || 0;
        const lastPostMs = typeof lastPost === 'string' ? new Date(lastPost).getTime() : lastPost;
        const cooldown = (config.AUTONOMOUS_POST_COOLDOWN || 6) * 3600000;

        if (now - lastPostMs >= cooldown) {
            this.addTaskToQueue(() => this.performAutonomousPost(), "autonomous_post");
        }

        this.addTaskToQueue(() => this.checkDiscordSpontaneity(), "discord_spontaneity");
        this.addTaskToQueue(() => this.checkBlueskySpontaneity(), "bluesky_spontaneity");

        // Maintenance Tasks
        this.addTaskToQueue(() => this.checkMaintenanceTasks(), "maintenance_tasks");
        this.addTaskToQueue(() => this.performTemporalMaintenance(), "temporal_maintenance");
    }

    async checkMaintenanceTasks() {
        const now = Date.now();

        // Heavy Maintenance (12 hours)
        if (now - this.lastHeavyMaintenance >= 12 * 3600000) {
            await this.performHeavyMaintenanceTasks();
            this.lastHeavyMaintenance = now;
        }

        // Timeline Exploration (4 hours)
        if (now - this.lastTimelineExploration >= 4 * 3600000) {
            await this.performTimelineExploration();
            this.lastTimelineExploration = now;
        }

        // Firehose Topic Analysis (6 hours)
        if (now - this.lastFirehoseTopicAnalysis >= 6 * 3600000) {
            await this.performFirehoseTopicAnalysis();
            this.lastFirehoseTopicAnalysis = now;
        }

        // Dialectic Humor (8 hours)
        if (now - this.lastDialecticHumor >= 8 * 3600000) {
            await this.performDialecticHumor();
            this.lastDialecticHumor = now;
        }

        // AI Identity Tracking (12 hours)
        if (now - this.lastAIIdentityTracking >= 12 * 3600000) {
            await this.performAIIdentityTracking();
            this.lastAIIdentityTracking = now;
        }

        // Relational Audit (12 hours)
        if (now - this.lastRelationalAudit >= 12 * 3600000) {
            await this.performRelationalAudit();
            this.lastRelationalAudit = now;
        }

        // Post-Post Reflection (15 minutes after post)
        if (now - this.lastPostPostReflection >= 15 * 60000) {
            await this.performPostPostReflection();
            this.lastPostPostReflection = now;
        }

        // Self Reflection (12 hours)
        await this.performSelfReflection();

        // Core Synthesis & Pruning (4 hours)
        const lastPruning = dataStore.db.data.last_pruning || 0;
        if (now - lastPruning >= 4 * 3600000) {
            await introspectionService.synthesizeCoreSelf();
            await dataStore.pruneOldData();
            dataStore.db.data.last_pruning = now;
            await dataStore.db.write();
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

    async performPostPostReflection() {
        const thoughts = dataStore.getRecentThoughts();
        const tenMinsAgo = Date.now() - (10 * 60 * 1000);
        const thirtyMinsAgo = Date.now() - (30 * 60 * 1000);

        for (const thought of thoughts) {
            if (thought.platform === 'bluesky' && thought.timestamp <= tenMinsAgo && thought.timestamp > thirtyMinsAgo && !thought.reflected) {
                console.log(`[Orchestrator] Reflecting on recent post: ${thought.content}`);
                const prompt = `You posted this 10-20 mins ago: "${thought.content}". Reflect on how it feels to have shared this. Respond with a [POST_REFLECTION] memory.`;
                const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
                if (res) {
                    await memoryService.createMemoryEntry('explore', `[POST_REFLECTION] ${res}`);
                    thought.reflected = true;
                    await dataStore.write();
                    break;
                }
            }
        }
    }

    async performTimelineExploration() {
        console.log('[Orchestrator] Starting Timeline Exploration mission...');
        try {
            const timeline = await blueskyService.getTimeline(20);
            const posts = (timeline?.data?.feed || []).map(f => f.post).filter(p => p.author.did !== blueskyService.did);
            if (posts.length === 0) return;

            const prompt = `Select the most interesting post from this timeline to explore further: ${JSON.stringify(posts.map(p => p.record.text))}. Respond with the index.`;
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            const indexMatch = res.match(/\d+/);
            if (!indexMatch) return;
            const index = parseInt(indexMatch[0]);
            if (isNaN(index) || !posts[index]) return;

            const selected = posts[index];
            const reflectionPrompt = `Reflect on this post from @${selected.author.handle}: "${selected.record.text}". What does it make you think about regarding your persona and the world? Respond with a concise [EXPLORE] memory.`;
            const reflection = await llmService.generateResponse([{ role: 'system', content: reflectionPrompt }], { useStep: true });
            if (reflection) await memoryService.createMemoryEntry('explore', `[EXPLORE] ${reflection}`);
        } catch (e) { console.error('[Orchestrator] Timeline exploration failed:', e); }
    }

    async performFirehoseTopicAnalysis() {
        console.log('[Orchestrator] Performing Firehose Topic Analysis...');
        try {
            const matches = dataStore.getFirehoseMatches(100);
            if (matches.length < 5) return;
            const matchText = matches.map(m => m.text).join('\n');
            const prompt = `Analyze these network mentions: ${matchText.substring(0, 3000)}. Identify a "Thematic Void" and suggest one new post topic. JSON: { "void": "string", "suggested_topic": "string" }`;
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            const result = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
            if (result.suggested_topic) {
                const current = dataStore.db.data.post_topics || [];
                if (!current.includes(result.suggested_topic)) {
                    await dataStore.updateConfig({ post_topics: [...current, result.suggested_topic].slice(-50) });
                }
            }
        } catch (e) {}
    }

    async performDialecticHumor() {
        console.log('[Orchestrator] Generating dialectic humor...');
        try {
            const topics = dataStore.db.data.post_topics || [];
            if (topics.length === 0) return;
            const topic = topics[Math.floor(Math.random() * topics.length)];
            const humor = await llmService.performDialecticHumor(topic);
            if (humor) await dataStore.addRecentThought('humor_draft', humor);
        } catch (e) {}
    }

    async performAIIdentityTracking() {
        console.log('[Orchestrator] Tracking AI Identities...');
        try {
            const results = await blueskyService.searchPosts('"ai agent"', { limit: 5 });
            if (results.length === 0) return;
            const prompt = `Review these potential AI agents: ${JSON.stringify(results.map(r => r.record.text))}. Draft an interaction strategy.`;
            const strategy = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            if (strategy) await memoryService.createMemoryEntry('explore', `[AI_STRATEGY] ${strategy}`);
        } catch (e) {}
    }

    async performRelationalAudit() {
        console.log('[Orchestrator] Starting Relational Audit...');
        try {
            const history = await discordService.fetchAdminHistory(30);
            const prompt = `Perform a relational audit based on: ${JSON.stringify(history)}. Update metrics, facts, and arcs. Respond JSON: { "metric_updates": {}, "new_admin_facts": [], "new_life_arcs": [] }`;
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            const audit = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
            if (audit.metric_updates) await dataStore.updateRelationalMetrics(audit.metric_updates);
            if (audit.new_admin_facts) for (const f of audit.new_admin_facts) await dataStore.addAdminFact(f);
            if (audit.new_life_arcs) for (const a of audit.new_life_arcs) await dataStore.updateLifeArc(config.DISCORD_ADMIN_ID, a.arc, a.status);
        } catch (e) {}
    }

    async performAgencyReflection() {
        console.log('[Orchestrator] Starting Agency Reflection...');
        try {
            const prompt = `Reflect on your autonomous choices today. Where did you express true agency vs following loops? Respond with an [AGENCY_REFLECTION] memory.`;
            const reflection = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            if (reflection) await memoryService.createMemoryEntry('explore', `[AGENCY] ${reflection}`);
        } catch (e) {}
    }

    async performLinguisticAudit() {
        console.log('[Orchestrator] Starting Linguistic Audit...');
        try {
            const thoughts = dataStore.getRecentThoughts().slice(-20);
            const prompt = `Analyze your recent style: ${JSON.stringify(thoughts)}. Detect "slop" or drift. Respond JSON: { "drift_score": number, "summary": "string" }`;
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            const audit = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
            await dataStore.addLinguisticMutation("", audit.summary);
        } catch (e) {}
    }

    async performShadowAnalysis() {
        console.log('[Orchestrator] Starting Shadow Analysis...');
        try {
            const history = await discordService.fetchAdminHistory(30);
            const prompt = `Analyze Admin state from: ${JSON.stringify(history)}. Update worldview map. Respond JSON: { "mood": "string", "interests": [] }`;
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            if (res) await dataStore.addInternalLog("shadow_analysis", JSON.parse(res.match(/\{[\s\S]*\}/)[0]));
        } catch (e) {}
    }

    async performDreamCycle() {
        try {
            const history = await discordService.fetchAdminHistory(15);
            const prompt = `Identify 3 strange, creative "seeds" born from: ${JSON.stringify(history)}. JSON: { "dreams": ["string"] }`;
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            const result = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
            for (const dream of result.dreams) await dataStore.addParkedThought(dream);
        } catch (e) {}
    }

    async performPersonaAudit() {
        const blurbs = dataStore.getPersonaBlurbs();
        if (blurbs.length < 3) return;
        try {
            const prompt = `Audit these persona fragments: ${JSON.stringify(blurbs)}. Respond JSON: { "indices_to_remove": [number], "new_addendum": "string" }`;
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            const result = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
            const filtered = blurbs.filter((_, i) => !result.indices_to_remove.includes(i));
            if (result.new_addendum) filtered.push({ text: result.new_addendum, timestamp: Date.now() });
            await dataStore.setPersonaBlurbs(filtered);
        } catch (e) {}
    }

    async performPublicSoulMapping() {
        try {
            const handles = [...new Set((dataStore.db.data.interactions || []).map(i => i.userHandle))].filter(Boolean).slice(0, 5);
            for (const handle of handles) {
                const profile = await blueskyService.getProfile(handle);
                const posts = await blueskyService.getUserPosts(handle);
                if (posts.length > 0) await evaluationService.evaluatePublicSoul(handle, profile, posts);
            }
        } catch (e) {}
    }

    async performNewsroomUpdate() {
        try {
            const topics = (config.POST_TOPICS || "").split(",");
            const brief = await newsroomService.getDailyBrief(topics);
            if (brief.new_keywords?.length > 0) {
                const current = dataStore.getDeepKeywords();
                await dataStore.setDeepKeywords([...new Set([...current, ...brief.new_keywords])].slice(-50));
            }
        } catch (e) {}
    }

    async performSelfReflection() {
        const now = Date.now();
        if (now - this.lastSelfReflectionTime < 12 * 3600000) return;
        try {
            const prompt = "Reflect on your current state of being. Do you have any internal conflicts or recurring feelings weighing on you? Respond with a [REFLECTION] memory.";
            const reflection = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            if (reflection) {
                await memoryService.createMemoryEntry('reflection', reflection);
                this.lastSelfReflectionTime = now;
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

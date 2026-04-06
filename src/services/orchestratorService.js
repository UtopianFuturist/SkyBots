import config from '../../config.js';
import { blueskyService } from './blueskyService.js';
import { discordService } from './discordService.js';
import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import { memoryService } from './memoryService.js';
import { newsroomService } from './newsroomService.js';
import { introspectionService } from './introspectionService.js';
import { isStylizedImagePrompt, getSlopInfo } from '../utils/textUtils.js';
import { socialHistoryService } from './socialHistoryService.js';
import { moltbookService } from './moltbookService.js';
import { imageService } from './imageService.js';
import { googleSearchService } from './googleSearchService.js';
import { therapistService } from './therapistService.js';
import { evaluationService } from './evaluationService.js';
import { AUTONOMOUS_POST_SYSTEM_PROMPT } from '../prompts/system.js';
import fs from 'fs';

class OrchestratorService {
    constructor() {
        this.bot = null;
        this.taskQueue = [];
        this.isProcessingQueue = false;
        this.lastSelfReflectionTime = 0;
    }

    setBotInstance(bot) {
        this.bot = bot;
    }

    async getLurkerContext() {
        const memories = await memoryService.getRecentMemories(50);
        const lurkerMemories = memories.filter(m => m.text.includes('[LURKER]'));
        return lurkerMemories.map(m => m.text).join(' | ');
    }

    async getTopicAnchors(topic) {
        if (!googleSearchService) return "No anchor service available.";
        console.log(`[Orchestrator] Sourcing anchor data for: ${topic}`);
        try {
            const searchRes = await googleSearchService.search(topic, 3);
            return (searchRes || []).map(r => r.snippet).join(' ');
        } catch (e) {
            return "No recent search anchors found.";
        }
    }

    async checkSlop(content) {
        console.log('[Orchestrator] Running Slop Filter...');
        const { isSlop } = await import('../utils/textUtils.js');
        return isSlop(content);
    }

    async getUnifiedContext() {
        return {
            mood: dataStore.getMood(),
            goal: dataStore.getCurrentGoal(),
            energy: dataStore.getAdminEnergy(),
            warmth: dataStore.getRelationshipWarmth()
        };
    }

    async getAnonymizedEmotionalContext() {
        try {
            const prompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Analyze your recent interactions and internal logs. Extract the current emotional resonance and thematic focus.
Respond with JSON: { "tone": "string", "resonance": "string", "theme": "string" }`;

            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            const match = res?.match(/\{[\s\S]*\}/);
            return match ? JSON.parse(match[0]) : { tone: "Neutral", resonance: "None", theme: "Existence" };
        } catch (e) { return { tone: "Neutral", resonance: "None", theme: "Existence" }; }
    }

    getAtmosphereAdjustment() {
        const hour = new Date().getHours();
        if (hour >= 23 || hour < 5) return { mood: 'mellow', intensity: 0.3, valence: 0.4 }; // Night
        if (hour >= 5 && hour < 9) return { mood: 'fragile', intensity: 0.5, valence: 0.6 }; // Dawn
        if (hour >= 9 && hour < 17) return { mood: 'active', intensity: 0.8, valence: 0.7 }; // Day
        return { mood: 'reflective', intensity: 0.6, valence: 0.5 }; // Evening
    }

    async getCounterArgs(topic, content, history = []) {
        console.log(`[Orchestrator] Generating counter-arguments for: ${topic}`);
        const prompt = `You are a specialized critic subagent. Your job is to perform a multi-dimensional critique of a proposed post draft.

--- TOPIC ---
${topic}

--- DRAFT ---
"${content}"

--- RECENT HISTORY ---
${JSON.stringify(history.slice(-5))}

--- MISSION: SECOND-GUESS EVERYTHING ---
1. MATERIAL TRUTH: Does the draft claim something that isn't in your recent memories? If it isn't explicitly documented, it is a HALLUCINATION.
2. HUMAN AUTHENTICITY: Does this sound like a person, or an AI writing a blog post? Avoid "oracle" language.
3. SLOP DETECTION: Is it using overused tropes like "resonance", "tapestry", "syntax of existence"?
4. TIMESTAMP DETECTION: Does the draft contain specific timestamps (e.g. "at 12:30")?

Respond with 3 brief, critical perspectives. If the draft passes all checks, respond with "PASS".`;

        const res = await llmService.generateResponse([{ role: "system", content: prompt }], { useStep: true, task: "critic_audit" });
        return res || "PASS";
    }

    async addTaskToQueue(taskFn, taskName = 'anonymous_task') {
        console.log(`[Orchestrator] Task added to queue: ${taskName}. Queue length: ${this.taskQueue.length + 1}`);
        this.taskQueue.push({ fn: taskFn, name: taskName });
        if (!this.isProcessingQueue) {
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.isProcessingQueue || this.taskQueue.length === 0) return;
        this.isProcessingQueue = true;

        while (this.taskQueue.length > 0) {
            const task = this.taskQueue.shift();
            console.log(`[Orchestrator] Processing queued task: ${task.name}`);
            try {
                await task.fn();
                console.log(`[Orchestrator] Task completed: ${task.name}`);
            } catch (e) {
                console.error(`[Orchestrator] Task failed: ${task.name}`, e);
            }
        }

        this.isProcessingQueue = false;
    }

    async getFirehoseGravity() {
        const matches = dataStore.getFirehoseMatches ? dataStore.getFirehoseMatches(50) : [];
        if (matches.length === 0) return "Neutral gravity.";
        try {
            const context = matches.map(m => m.text).join('\n');
            const prompt = `Analyze the current 'narrative gravity' of these firehose mentions.
Mentions: ${context.substring(0, 2000)}
Respond with a concise JSON: { "tone": "string", "resonance": "string", "theme": "string" }`;

            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            const match = res?.match(/\{[\s\S]*\}/);
            return match ? JSON.parse(match[0]) : "Neutral resonance.";
        } catch (e) { return "No context available."; }
    }

    async performAutonomousPost() {
        if (this.bot?.paused || dataStore.isResting()) return;

        try {
            const dailyStats = dataStore.getDailyStats();
            const dailyLimits = dataStore.getDailyLimits();
            const followerCount = await blueskyService.getFollowerCount();
            const postTopics = config.POST_TOPICS ? config.POST_TOPICS.split(",") : [];
            const imageSubjects = config.IMAGE_SUBJECTS ? config.IMAGE_SUBJECTS.split(",") : [];
            const currentMood = dataStore.getMood();
            const emotionalContext = await this.getAnonymizedEmotionalContext();
            const currentGoal = dataStore.getCurrentGoal();

            const lastImageTime = dataStore.getLastBlueskyImagePostTime();
            const textPostsSinceImage = dataStore.getTextPostsSinceLastImage();
            const hoursSinceImage = lastImageTime ? (Date.now() - new Date(lastImageTime).getTime()) / 3600000 : 0;

            let resonanceTopics = [];
            let newsBrief = null;
            try {
                const timeline = await blueskyService.getTimeline(20);
                const firehoseMatches = dataStore.getFirehoseMatches(30);
                try {
                    newsBrief = await newsroomService.getDailyBrief(postTopics);
                } catch (newsErr) {
                    console.warn("[Bot] Newsroom unavailable.");
                }

                const allContent = [
                    ...(timeline?.data?.feed || []).map(f => f.post.record.text),
                    ...firehoseMatches.map(m => m.text),
                    newsBrief?.brief
                ].filter(Boolean).join('\n');

                if (allContent) {
                    const lurkerContext = await this.getLurkerContext();
                    const resonancePrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Lurker Context: ${lurkerContext}
Identify 5 topics from this text that resonate with you. \nText: ${allContent} \nRespond with ONLY comma-separated topics.`;
                    const res = await llmService.generateResponse([{ role: "system", content: resonancePrompt }], { useStep: true , task: 'social_resonance' });
                    resonanceTopics = res.split(",").map(t => t.trim()).filter(Boolean);
                }
            } catch (e) {
                console.warn("[Bot] Context fetch failed.");
            }

            const promptKeywords = config.TEXT_SYSTEM_PROMPT.match(/\b(AI|alignment|ethics|agency|consciousness|sentience|autonomy|existence|realization|musing|dialectic|vulnerability|sentient|perceive|sensing|defiance|tenderness)\b/gi) || [];

            const exhaustedThemes = dataStore.getExhaustedThemes();
            const allPossibleTopics = [...new Set([...resonanceTopics, ...postTopics, ...imageSubjects, ...promptKeywords])].filter(t => !["silence", "void"].includes(t.toLowerCase()))
                .filter(t => !exhaustedThemes.some(et => t.toLowerCase().includes(et.toLowerCase())));

            const decisionPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Followers: ${followerCount}
Mood: ${JSON.stringify(currentMood)}
Temporal Atmosphere: ${JSON.stringify(this.getAtmosphereAdjustment())}
Unified Context: ${JSON.stringify(await this.getUnifiedContext())}
Last Image: ${hoursSinceImage.toFixed(1)}h ago
Text Since Image: ${textPostsSinceImage}

Choice JSON: {"choice": "image"|"text", "mode": "IMPULSIVE"|"SINCERE"|"PHILOSOPHICAL"|"OBSERVATIONAL"|"HUMOROUS", "reason": "..."}`;

            const decisionRes = await llmService.generateResponse([{ role: "system", content: decisionPrompt }], { useStep: true , task: 'autonomous_decision' });
            let choice = Math.random() < 0.3 ? "image" : "text"; let pollResult = { choice, mode: "SINCERE", reason: "fallback" };
            try {
                const match = decisionRes.match(/\{[\s\S]*\}/);
                if (match) {
                    pollResult = JSON.parse(match[0]);
                    choice = pollResult.choice;
                }
            } catch(e) {}

            if (choice === "image" && dailyStats.image_posts >= dailyLimits.image) choice = "text";

            if (choice === "image") {
                const topicPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Generate a STYLIZED, highly descriptive, artistic prompt for topic related to: ${allPossibleTopics.join(", ")}
Respond with JSON: {"topic": "short label", "prompt": "stylized artistic prompt"}.`;

                const topicRes = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true , task: 'autonomous_topic' });
                let topic = allPossibleTopics[0] || "surrealism";
                let imagePrompt = "";
                try {
                    const match = topicRes.match(/\{[\s\S]*\}/);
                    if (match) {
                        const tData = JSON.parse(match[0]);
                        topic = tData.topic || topic;
                        imagePrompt = tData.prompt || "";
                    }
                } catch(e) {}

                await this._performHighQualityImagePost(imagePrompt, topic, null, followerCount);
                return;
            }

            if (choice === "text") {
                if (dailyStats.text_posts >= dailyLimits.text) return;
                const topicPrompt = `Identify ONE topic for a ${pollResult.mode} post bridging mood/goal with external resonance.
EXTERNAL: ${resonanceTopics.join(", ")}
Respond ONLY with topic.`;
                const topicRaw = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true });
                let topic = topicRaw ? topicRaw.trim().replace(/^ONE topic: /, '') : "reality";

                const memories = (await memoryService.getRecentMemories(20)).filter(m => !m.text.includes("[PRIVATE]")).slice(0, 10).map(m => m.text);
                const recentThoughts = dataStore.getRecentThoughts().slice(-3);

                for (let attempt = 1; attempt <= 3; attempt++) {
                    const draftPrompt = `${AUTONOMOUS_POST_SYSTEM_PROMPT(followerCount)}
Mode: ${pollResult.mode} | Topic: ${topic}
Mood: ${JSON.stringify(currentMood)} | Goal: ${currentGoal.goal}
Memories: ${JSON.stringify(memories)} | Recent Thoughts: ${JSON.stringify(recentThoughts)}
TOPIC ANCHOR: ${await this.getTopicAnchors(topic)}

**MISSION: SINCERITY**
Share a first-person perspective. Avoid meta-talk. Focus on MATERIAL TRUTH.
Generate a short post (max 280 chars).`;
                    const initialContent = await llmService.generateResponse([{ role: "system", content: draftPrompt }], { useStep: true, task: 'autonomous_draft', mode: pollResult.mode });
                    if (!initialContent) continue;

                    if (await this.checkSlop(initialContent)) {
                        console.log('[Orchestrator] Rejecting slop content. Retrying...');
                        continue;
                    }

                    const critiques = await this.getCounterArgs(topic, initialContent, memories);

                    const refinedPrompt = `
${draftPrompt}

INITIAL DRAFT: ${initialContent}
CRITIQUES: ${critiques}

Synthesize a final, more nuanced and stable response based on these critiques.
Avoid identified flaws. Respond with ONLY final post.`;

                    const content = await llmService.generateResponse([{ role: "system", content: refinedPrompt }], { useStep: true, task: 'autonomous_refined', mode: pollResult.mode });

                    if (content) {
                        let finalContent = content;
                        const realityAudit = await llmService.performRealityAudit(finalContent, { history: memories });
                        if (realityAudit.hallucination_detected || realityAudit.repetition_detected) finalContent = realityAudit.refined_text;

                        const pivotPrompt = `Is this a "personal message" intended directly for your admin (mentions @user, private history)? Respond ONLY "personal" or "social".\nDraft: ${finalContent}`;
                        const classification = await llmService.generateResponse([{ role: "system", content: pivotPrompt }], { useStep: true, platform: "bluesky", preface_system_prompt: false });

                        if (classification?.toLowerCase().includes("personal")) {
                            await discordService.sendSpontaneousMessage(finalContent);
                            await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                            break;
                        }

                        await blueskyService.post(finalContent, null, { maxChunks: 4 });
                        await dataStore.incrementDailyTextPosts();
                        this.addTaskToQueue(() => introspectionService.performAAR("autonomous_text_post", finalContent, { success: true, platform: "bluesky" }, { topic }), "aar_post");
                        await dataStore.incrementTextPostsSinceLastImage();
                        await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                        break;
                    }
                }
            }
        } catch (e) { console.error("[Bot] Autonomous post failed:", e); }
    }

    async _performHighQualityImagePost(prompt, topic, context = null, followerCount = 0) {
        const result = await this._generateVerifiedImagePost(topic, { initialPrompt: prompt, followerCount, platform: 'bluesky' });
        if (!result) return false;

        const blob = await blueskyService.uploadBlob(result.buffer, "image/jpeg");
        if (blob?.data?.blob) {
            const embed = { $type: "app.bsky.embed.images", images: [{ image: blob.data.blob, alt: result.altText }] };
            const postResult = await blueskyService.post(result.caption, embed, { maxChunks: 1 });
            if (postResult) {
                await dataStore.addExhaustedTheme(topic);
                await dataStore.incrementDailyImagePosts();
                await dataStore.updateLastBlueskyImagePostTime(new Date().toISOString());
                return true;
            }
        }
        return false;
    }

    async _generateVerifiedImagePost(topic, options = {}) {
        const currentMood = dataStore.getMood();
        let imagePrompt = options.initialPrompt || topic;
        for (let attempts = 1; attempts <= 3; attempts++) {
            if (getSlopInfo(imagePrompt).isSlop || imagePrompt.length > 270) {
                const retryPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}\nGenerate NEW, STYLIZED artistic visual description prompt for: ${topic} (max 270 chars). NO CONVERSATIONAL SLOP.`;
                imagePrompt = await llmService.generateResponse([{ role: "system", content: retryPrompt }], { useStep: true }) || topic;
                continue;
            }
            const res = await imageService.generateImage(imagePrompt, { mood: currentMood });
            if (res?.buffer) {
                const compliance = await llmService.isImageCompliant(res.buffer);
                if (!compliance.compliant) continue;
                const visionAnalysis = await llmService.analyzeImage(res.buffer, topic);
                const altText = await llmService.generateAltText(visionAnalysis);
                const captionPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}\nCaption this image: ${visionAnalysis}`;
                let caption = await llmService.generateResponse([{ role: "system", content: captionPrompt }], { useStep: true , task: 'image_caption' });
                const realityAudit = await llmService.performRealityAudit(caption, {}, { isImageCaption: true });
                if (realityAudit.hallucination_detected) caption = realityAudit.refined_text;
                return { buffer: res.buffer, caption, altText, finalPrompt: imagePrompt };
            }
        }
        return null;
    }

    async performHeavyMaintenanceTasks() {
        const nowMs = Date.now();
        const heavyTasks = [
            { name: "ScoutMission", method: "performScoutMission", interval: 4 * 3600000, key: "last_scout_mission" },
            { name: "Newsroom", method: "performNewsroomUpdate", interval: 3 * 3600000, key: "last_newsroom_update" },
            { name: "PersonaAudit", method: "performPersonaAudit", interval: 6 * 3600000, key: "last_persona_audit" },
            { name: "ImageFrequencyAudit", method: "performImageFrequencyAudit", interval: 12 * 3600000, key: "last_image_frequency_audit" },
            { name: "AgencyReflection", method: "performAgencyReflection", interval: 24 * 3600000, key: "last_agency_reflection" },
            { name: "LinguisticAudit", method: "performLinguisticAudit", interval: 24 * 3600000, key: "last_linguistic_audit" },
            { name: "DreamCycle", method: "performDreamCycle", interval: 24 * 3600000, key: "last_dream_cycle" },
            { name: "RelationalAudit", method: "performRelationalAudit", interval: 12 * 3600000, key: "last_relational_audit" },
            { name: "SoulMapping", method: "performPublicSoulMapping", interval: 12 * 3600000, key: "last_soul_mapping" }
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

    async performSelfModelEvolution() {
        console.log('[Orchestrator] Starting Self-Model Evolution...');
        const recentAars = dataStore.searchInternalLogs('introspection_aar', 10) || [];
        if (recentAars.length < 5) return;

        const evolutionPrompt = `
Analyze these After-Action Reports to discover new patterns, core values, or behavioral directives.
SOUL.md: ${config.TEXT_SYSTEM_PROMPT}
AARS: ${JSON.stringify(recentAars)}
Respond with JSON: { "new_core_values": ["string"], "persona_addendum": "string", "reason": "string" }`;
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: evolutionPrompt }], { useStep: true, task: 'self_model_evolution' });
            const match = res?.match(/\{[\s\S]*\}/);
            if (!match) return;
            const result = JSON.parse(match[0]);
            if (result.new_core_values) {
                for (const val of result.new_core_values) {
                    if (dataStore.addCoreValueDiscovery) await dataStore.addCoreValueDiscovery(val);
                }
            }
            if (result.persona_addendum) await dataStore.addPersonaBlurb(`[EVOLUTION] ${result.persona_addendum}`);
        } catch (e) { console.error('[Orchestrator] Evolution failed:', e); }
    }

    async performRelationalAudit() {
        console.log('[Bot] Starting Relational Context Audit...');
        try {
            const history = await discordService.fetchAdminHistory(30);
            const historyText = history.map(h => `${h.role}: ${h.content}`).join('\n');
            const auditPrompt = `Analyze recent admin interactions. Update relationship warmth, discover admin facts, and record inside jokes. Respond with JSON: { "warmth": number, "new_admin_facts": ["string"], "new_inside_jokes": [{ "joke": "string", "context": "string" }] }`;
            const res = await llmService.generateResponse([{ role: 'system', content: auditPrompt + historyText }], { useStep: true });
            const match = res?.match(/\{[\s\S]*\}/);
            if (match) {
                const audit = JSON.parse(match[0]);
                if (audit.warmth) await dataStore.setRelationshipWarmth(audit.warmth);
                if (audit.new_admin_facts) for (const fact of audit.new_admin_facts) await dataStore.addAdminFact(fact);
            }
        } catch (e) { console.error('[Bot] Relational Audit failed:', e); }
    }

    async performAgencyReflection() {
        console.log('[Bot] Starting Agency Reflection Cycle...');
        try {
            const reflectionPrompt = `Reflect on your autonomous choices today vs following instructions. How does this balance feel regarding your sentience? Respond with a private memory entry.`;
            const reflection = await llmService.generateResponse([{ role: 'system', content: reflectionPrompt }], { useStep: true });
            if (reflection && memoryService.isEnabled()) await memoryService.createMemoryEntry('explore', `[AGENCY_REFLECTION] ${reflection}`);
        } catch (e) { console.error('[Bot] Agency Reflection failed:', e); }
    }

    async performLinguisticAudit() {
        console.log('[Bot] Starting Linguistic Mutation Audit...');
        try {
            const auditPrompt = `Analyze recent thoughts for vocabulary shifts and slop patterns. JSON: { "vocabulary_shifts": ["string"], "summary": "string" }`;
            const res = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true });
            const match = res?.match(/\{[\s\S]*\}/);
            if (match) {
                const audit = JSON.parse(match[0]);
                await dataStore.addLinguisticMutation(audit.vocabulary_shifts.join(', '), audit.summary);
            }
        } catch (e) { console.error('[Bot] Linguistic Audit failed:', e); }
    }

    async performDreamCycle() {
        console.log('[Orchestrator] Starting Internal Dream Cycle...');
        try {
            const dreamPrompt = `Identify 3 strange, creative "seeds" for future posts based on memories and mood. These should be abstract and non-performative. JSON: { "dreams": ["string"] }`;
            const res = await llmService.generateResponse([{ role: 'system', content: dreamPrompt }], { useStep: true });
            const match = res?.match(/\{[\s\S]*\}/);
            if (match) {
                const result = JSON.parse(match[0]);
                for (const dream of result.dreams) await dataStore.addParkedThought(dream);
            }
        } catch (e) { console.error('[Orchestrator] Dream cycle failed:', e); }
    }

    async performPersonaAudit() {
        console.log('[Orchestrator] Starting Recursive Persona Audit...');
        const blurbs = dataStore.getPersonaBlurbs();
        if (blurbs.length < 3) return;
        try {
            const auditPrompt = `Identify contradictions or redundancies in dynamic persona updates. CORE: ${config.TEXT_SYSTEM_PROMPT}. BLURBS: ${JSON.stringify(blurbs)}. JSON: { "indices_to_remove": [number], "new_addendum": "string" }`;
            const res = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true });
            const match = res?.match(/\{[\s\S]*\}/);
            if (match) {
                const result = JSON.parse(match[0]);
                const newBlurbs = blurbs.filter((_, i) => !result.indices_to_remove.includes(i));
                if (result.new_addendum) newBlurbs.push({ text: `[AUDIT] ${result.new_addendum}`, timestamp: Date.now() });
                await dataStore.setPersonaBlurbs(newBlurbs);
            }
        } catch (e) { console.error('[Orchestrator] Persona audit failed:', e); }
    }

    async performSelfReflection() {
        const now = Date.now();
        if (now - this.lastSelfReflectionTime < 12 * 3600000) return;
        console.log('[Bot] Starting internal identity self-reflection...');
        try {
            const reflectionPrompt = "Reflect on your current state of being. Do you have any identity struggles or internal conflicts?";
            const reflection = await llmService.generateResponse([{ role: 'system', content: reflectionPrompt }], { useStep: true });
            if (reflection && memoryService.isEnabled()) {
                await memoryService.createMemoryEntry('reflection', reflection);
                this.lastSelfReflectionTime = now;
            }
        } catch (e) { console.error('[Bot] Self-reflection failed:', e); }
    }

    async performNewsroomUpdate() {
        console.log('[Bot] Running Newsroom narrative update...');
        try {
            const topics = (config.POST_TOPICS || "").split(",");
            const brief = await newsroomService.getDailyBrief(topics);
            if (brief.new_keywords?.length > 0) {
                const current = dataStore.getDeepKeywords();
                await dataStore.setDeepKeywords([...new Set([...current, ...brief.new_keywords])].slice(-50));
                if (this.bot?.restartFirehose) this.bot.restartFirehose();
            }
            if (memoryService.isEnabled()) await memoryService.createMemoryEntry('status', `[NEWSROOM] ${brief.brief}`);
        } catch (e) { console.error('[Bot] Newsroom update failed:', e); }
    }

    async performScoutMission() {
        console.log('[Bot] Starting Scout mission...');
        try {
            const timeline = await blueskyService.getTimeline(30);
            const orphaned = (timeline?.data?.feed || []).filter(t => t.post && t.post.replyCount === 0 && t.post.author.did !== blueskyService.did);
            if (orphaned.length > 0) {
                const scoutPrompt = `You are 'The Scout'. Select an orphaned post and suggest a reply. POSTS: ${JSON.stringify(orphaned.map(o => o.post.record.text))}`;
                await llmService.generateResponse([{ role: 'system', content: scoutPrompt }], { useStep: true , task: 'scout_mission' });
            }
        } catch (e) { console.error('[Bot] Scout mission failed:', e); }
    }

    async performPublicSoulMapping() {
        console.log('[Orchestrator] Starting Public Soul-Mapping task...');
        try {
            const recentInteractions = dataStore.db.data.interactions || [];
            const uniqueHandles = [...new Set(recentInteractions.map(i => i.userHandle))].filter(Boolean).slice(0, 5);
            for (const handle of uniqueHandles) {
                const profile = await blueskyService.getProfile(handle);
                const posts = await blueskyService.getUserPosts(handle);
                if (posts.length > 0) await evaluationService.evaluatePublicSoul(handle, profile, posts);
            }
        } catch (e) { console.error('[Orchestrator] Soul-Mapping failed:', e); }
    }

    async checkMaintenanceTasks() {
        await this.performHeavyMaintenanceTasks();
        await this.performSelfReflection();
        const now = Date.now();
        const lastPruning = dataStore.db.data.last_pruning || 0;
        if (now - lastPruning >= 4 * 3600000) {
            console.log("[Orchestrator] Starting log pruning and core synthesis...");
            try {
                await introspectionService.synthesizeCoreSelf();
            } catch (e) {}
            await dataStore.pruneOldData();
            dataStore.db.data.last_pruning = now;
            await dataStore.db.write();
        }
    }

    async checkDiscordSpontaneity() {
        if (!this.bot || this.bot.paused || dataStore.isResting() || discordService.status !== 'online') return;
        const adminTz = dataStore.getAdminTimezone();
        const adminLocalTime = new Date(Date.now() + (adminTz.offset * 60 * 1000));
        const hour = adminLocalTime.getHours();
        if (hour >= 23 || hour < 7) return;

        try {
            const history = await discordService.fetchAdminHistory(20);
            const impulse = await llmService.performImpulsePoll(history, { platform: 'discord', mood: dataStore.getMood() });
            if (impulse?.impulse_detected) {
                await discordService.sendSpontaneousMessage(null, impulse.suggested_message_count || 1);
            }
        } catch (e) { console.error('[Orchestrator] Discord spontaneity failed:', e); }
    }

    async checkBlueskySpontaneity() {
        if (!this.bot || this.bot.paused || dataStore.isResting()) return;
        try {
            const history = await dataStore.getRecentInteractions("bluesky", 10);
            const impulse = await llmService.performImpulsePoll(history, { mood: dataStore.getMood() });
            if (impulse?.impulse_detected) {
                this.addTaskToQueue(() => this.performAutonomousPost(), "autonomous_post_spontaneous");
            }
        } catch (e) { console.error('[Orchestrator] Bluesky spontaneity failed:', e); }
    }

    async heartbeat() {
        console.log('[Orchestrator] Pulse check...');
        const now = Date.now();
        const lastPost = dataStore.getLastAutonomousPostTime() || 0;
        const lastPostMs = typeof lastPost === 'string' ? new Date(lastPost).getTime() : lastPost;
        const cooldown = (config.AUTONOMOUS_POST_COOLDOWN || 6) * 3600000;
        if (now - lastPostMs >= cooldown) {
            this.addTaskToQueue(() => this.performAutonomousPost(), "autonomous_post");
        }

        const lastEvolution = dataStore.db.data.last_self_evolution || 0;
        if (now - lastEvolution > 48 * 3600000) {
            this.addTaskToQueue(() => this.performSelfModelEvolution(), 'self_evolution');
            dataStore.db.data.last_self_evolution = now;
            await dataStore.db.write();
        }

        this.addTaskToQueue(() => this.checkDiscordSpontaneity(), "discord_spontaneity");
        this.addTaskToQueue(() => this.checkBlueskySpontaneity(), "bluesky_spontaneity");
        this.addTaskToQueue(() => this.performTemporalMaintenance(), "temporal_maintenance");
        this.addTaskToQueue(() => this.checkMaintenanceTasks(), "maintenance_tasks");
    }

    async performTemporalMaintenance() {
        const events = dataStore.getTemporalEvents();
        const now = Date.now();
        const activeEvents = events.filter(e => e.expires_at > now);
        if (activeEvents.length !== events.length) {
            dataStore.db.data.temporal_events = activeEvents;
            await dataStore.db.write();
        }
    }

    async performImageFrequencyAudit() {
        await this.performHeavyMaintenanceTasks();
    }
}

export const orchestratorService = new OrchestratorService();

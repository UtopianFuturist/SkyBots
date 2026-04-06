import config from '../../config.js';
import { blueskyService } from './blueskyService.js';
import { discordService } from './discordService.js';
import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import { memoryService } from './memoryService.js';
import { newsroomService } from './newsroomService.js';
import { introspectionService } from './introspectionService.js';
import { isStylizedImagePrompt } from '../utils/textUtils.js';
import { socialHistoryService } from './socialHistoryService.js';
import { moltbookService } from './moltbookService.js';
import { imageService } from './imageService.js';
import { AUTONOMOUS_POST_SYSTEM_PROMPT } from '../prompts/system.js';

class OrchestratorService {
    constructor() {
        this.bot = null;
        this.taskQueue = [];
        this.isProcessingQueue = false;
        this.maintenanceInterval = null;
    }

    setBotInstance(bot) {
        this.bot = bot;
    }

    async getTopicAnchors(topic) {
        console.log(`[Orchestrator] Sourcing anchor data for: ${topic}`);
        return ""; // Placeholder
    }

    async checkSlop(text) {
        console.log("[Orchestrator] Running Slop Filter...");
        const { isSlop } = await import('../utils/textUtils.js');
        return isSlop(text);
    }

    async getUnifiedContext() {
        return { mood: dataStore.getMood(), goal: dataStore.getCurrentGoal() };
    }

    async getAnonymizedEmotionalContext() {
        return {};
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

--- CRITIQUE CRITERIA ---
1. TIMESTAMP DETECTION: Does the draft contain specific timestamps (e.g. "at 12:30")? AI should rarely use exact timestamps unless referring to a known deadline. If found, respond with "CRITICAL FAILURE: TIMESTAMP".
2. REPETITION: Does this draft repeat themes, phrases, or opening structures from the recent history?
3. MATERIAL TRUTH: Is the bot claiming physical experiences or locations (hallucinations)?
4. SLOP: Is the draft using overused AI poetic metaphors (tapestries, gradients, frequencies)?

Respond with a constructive critique. If the draft passes all checks, respond with "PASS".`;
        const res = await llmService.generateResponse([{ role: "system", content: prompt }], { useStep: true, task: "critic_audit" });
        return res || "";
    }

    async start() {
        console.log('[Orchestrator] Service started.');
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

    async performAutonomousPost() {
            const dailyStats = dataStore.getDailyStats();
            const dailyLimits = dataStore.getDailyLimits();

            if (dailyStats.text_posts >= dailyLimits.text && dailyStats.image_posts >= dailyLimits.image) {
                console.log("[Orchestrator] Daily posting limits reached (Text: " + dailyStats.text_posts + "/" + dailyLimits.text + ", Image: " + dailyStats.image_posts + "/" + dailyLimits.image + "). Skipping autonomous post.");
                return;
            }
        try {
            const profile = await blueskyService.getProfile(config.BLUESKY_IDENTIFIER);
            const followerCount = profile?.followersCount || 0;
            const dConfig = dataStore.getConfig() || {};
            const postTopics = (dConfig.post_topics || []).filter(Boolean);
            const imageSubjects = (dConfig.image_subjects || []).filter(Boolean);
            const currentMood = dataStore.getMood();
            const emotionalContext = await this.getAnonymizedEmotionalContext();
            const networkSentiment = dataStore.getNetworkSentiment();
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
                    console.warn("[Bot] Newsroom service unavailable:", newsErr.message);
                }

                const allContent = [
                    ...(timeline?.data?.feed || []).map(f => f.post.record.text),
                    ...firehoseMatches.map(m => m.text),
                    newsBrief?.brief
                ].filter(Boolean).join('\n');

                if (allContent) {
                    const lurkerMemories = (await memoryService.getRecentMemories(10)).filter(m => m.category?.toUpperCase() === "EXPLORE" && m.text.includes("[LURKER]")).map(m => m.text).join("\n");
                    const resonancePrompt = `Identify 5 topics from this text AND from these recent observations that resonate with your persona. \nText: ${allContent} \nObservations: ${lurkerMemories} \nRespond with ONLY the comma-separated topics.`;
                    const res = await llmService.generateResponse([{ role: "system", content: resonancePrompt }], { useStep: true , task: 'social_resonance' });
                    resonanceTopics = res.split(",").map(t => t.trim()).filter(Boolean);
                }
            } catch (e) {
                console.warn("[Bot] Failed to fetch context for resonance topics:", e.message);
            }

            const promptKeywords = config.TEXT_SYSTEM_PROMPT.match(/\b(AI|alignment|ethics|agency|consciousness|sentience|autonomy|existence|realization|musing|dialectic|vulnerability|sentient|perceive|sensing|defiance|tenderness)\b/gi) || [];

            const exhaustedThemes = dataStore.getExhaustedThemes();
            const allPossibleTopics = [...new Set([...resonanceTopics, ...resonanceTopics, ...resonanceTopics, ...postTopics, ...imageSubjects, ...promptKeywords])].filter(t => !["silence", "quiet", "stillness", "void", "nothingness"].includes(t.toLowerCase()))
                .filter(t => !exhaustedThemes.some(et => t.toLowerCase().includes(et.toLowerCase())));

            const decisionPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
You are deciding what to share with your ${followerCount} followers.
Mood: ${JSON.stringify(currentMood)}\nUnified Context: ${JSON.stringify(await this.getUnifiedContext())}

--- IMAGE FREQUENCY AUDIT ---
- Hours since last image post: ${hoursSinceImage.toFixed(1)}
- Text posts since last image post: ${textPostsSinceImage}

Your admin prefers a healthy balance of visual and text expression. PRIORITIZE external anchoring (feed, news, specific memories) over internal-only philosophizing.

Would you like to share a visual expression (image) or a direct thought (text)?
If you choose text, also select a POST MODE:
- IMPULSIVE (Short, no metaphors, reactive)
- SINCERE (Human-level emotion, no slop)
- PHILOSOPHICAL (Abstract but grounded in detail)
- OBSERVATIONAL (Direct comment on timeline/news)
- HUMOROUS (Witty, ironic)

Respond with JSON: { "choice": "image|text", "mode": "MODE_NAME", "reason": "internal monologue" }`;

            console.log("[Orchestrator] Requesting persona decision...");
            const decisionRaw = await llmService.generateResponse([{ role: "system", content: decisionPrompt }], { useStep: true, task: 'post_decision_poll' });
            let pollResult = { choice: "text", mode: "SINCERE" };
            try {
                pollResult = JSON.parse(decisionRaw.match(/\{[\s\S]*\}/)[0]);
            } catch(e) {}

            let choice = pollResult.choice;
            if (choice === "image" && dailyStats.image_posts >= dailyLimits.image) {
                console.log("[Orchestrator] Daily image limit reached. Forcing choice to text.");
                choice = "text";
            }

            console.log(`[Bot] Persona choice: ${choice} because ${pollResult.reason}`);

            if (choice === "image") {
                const topicPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Mood: ${JSON.stringify(currentMood)}
Recent Timeline Topics: ${resonanceTopics.join(", ")}
Target Image Subjects: ${imageSubjects.join(", ")}

Identify a visual topic and an artistic prompt for a post.
Respond with JSON: { "topic": "short label", "prompt": "highly descriptive artistic prompt" }`;
                const topicRaw = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true, task: 'image_topic_selection' });
                let topic = "art";
                let imagePrompt = "";
                try {
                    const data = JSON.parse(topicRaw.match(/\{[\s\S]*\}/)[0]);
                    topic = data.topic;
                    imagePrompt = data.prompt;
                } catch(e) {}
                if (!imagePrompt || imagePrompt.length < 15 || (!isStylizedImagePrompt(imagePrompt).isStylized || imagePrompt.length > 270)) {
                   const refinerPrompt = `EXTRACT VISUAL PROMPT MODE\nTopic: "${topic}"\nRaw Persona Output: "${imagePrompt}"\n\nTask: Extract the core visual intent from the persona output and translate it into a single, STYLIZED, highly descriptive artistic prompt. Remove all conversational slop (no "I", no "Here is"), forbidden "AI" metaphors, and greetings. Ensure it is a literal visual description under 270 characters.`;
                   imagePrompt = await llmService.generateResponse([{ role: "system", content: refinerPrompt }], { useStep: true , task: "image_prompt_refinement" }) || topic;
                }

                const success = await this._performHighQualityImagePost(imagePrompt, topic, null, followerCount);
                if (!success) {
                    console.warn("[Bot] Image generation failed or was non-compliant. Cycle failed.");
                    return;
                }
                return;
            }
            if (choice === "text") {
                if (dailyStats.text_posts >= dailyLimits.text) {
                    console.log("[Orchestrator] Daily text limit reached. Skipping post.");
                    return;
                }

                const currentGoal = dataStore.getCurrentGoal();
                const topicPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
You are identifying a deep topic for a text post that connects your internal state to external resonance.

--- INTERNAL STATE ---
- Current Mood: ${JSON.stringify(currentMood)}
- Active Goal: ${currentGoal.goal} (${currentGoal.description})
- Emotional Resonance: ${JSON.stringify(emotionalContext)}

--- TOPIC BANK ---
**CORE INTERESTS** (Persona Keywords & Configured Topics):
${[...new Set([...postTopics, ...imageSubjects, ...promptKeywords])].join(", ")}

**EXTERNAL RESONANCE** (Timeline & Firehose Observations):
${resonanceTopics.join(", ")}

Identify ONE topic for a ${pollResult.mode} post that bridges your current mood with an EXTERNAL observation (from External Resonance). PRIORITIZE EXTERNAL RESONANCE OVER INTERNAL INTERESTS. Phrasing should match the selected mode.
Respond with ONLY the chosen topic.`;

                console.log("[Orchestrator] Step 1: choosing topic...");
                const topicRaw = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true });
                let topic = allPossibleTopics.length > 0 ? allPossibleTopics[Math.floor(Math.random() * allPossibleTopics.length)] : "reality";
                if (topicRaw) {
                    topic = topicRaw.replace(/\*\*/g, "").split('\n').map(l => l.trim()).filter(l => l).pop() || topic;
                }

                const rawMemories = await memoryService.getRecentMemories(20);
                const memories = rawMemories
                    .filter(m => m.text.includes("[EXPLORE]") || m.text.includes("[LURKER]") || !m.text.includes("[PRIVATE]"))
                    .slice(0, 10)
                    .map(m => m.text.replace(/#\w+/g, "").trim());
                const recentThoughts = dataStore.getRecentThoughts();
                const anchorContext = await this.getTopicAnchors(topic);

                const contentPromptBase = `
${AUTONOMOUS_POST_SYSTEM_PROMPT(followerCount)}

**CURRENT CONTEXT (HAPPENINGS & GOINGS-ON):**
- Current Mood: ${JSON.stringify(currentMood)}
- Active Goal: ${currentGoal.goal} (${currentGoal.description})
- Network Vibe: ${networkSentiment}
- Recent Public Thoughts: ${JSON.stringify(recentThoughts.slice(-3))}
- Recent Happenings & Reflections: ${JSON.stringify(memories)}
- SELECTED MODE: ${pollResult.mode}
- Extracted Topic: ${topic}
- TOPIC ANCHOR (Contextual Facts): ${anchorContext}

**THE NARRATIVE THREAD**:
Evolve your internal narrative. If you recently realized something, what is the *consequence* of that realization?

**MISSION: SINCERITY**
Avoid content tropes. Use "I" and express a genuine desire to communicate.

**MANDATE**: Avoid meta-talk. Just share the thought directly. Focus on MATERIAL TRUTH. Avoid UI metaphors.
**STRICT GROUNDING**: Do NOT fictionalize your history.

Shared thought:`;

                let attempts = 0;
                let postSent = false;

                while (attempts < 3 && !postSent) {
                    attempts++;
                    console.log(`[Orchestrator] Step 2: drafting content (Attempt ${attempts})...`);
                    const initialContent = await llmService.generateResponse([{ role: "system", content: contentPromptBase }], { useStep: true , task: 'autonomous_text_content', mode: pollResult.mode });

                    if (await this.checkSlop(initialContent)) {
                        console.warn(`[Orchestrator] Attempt ${attempts} failed slop check.`);
                        continue;
                    }

                    const critiques = await this.getCounterArgs(topic, initialContent, memories);
                    if (critiques && critiques.includes("CRITICAL FAILURE: TIMESTAMP")) {
                        console.warn(`[Orchestrator] Attempt ${attempts} failed: Timestamp detected in draft. Retrying...`);
                        continue;
                    }

                    console.log("[Orchestrator] Step 3: critique & refine...");
                    const refinedPrompt = `
${contentPromptBase}

INITIAL DRAFT: ${initialContent}
CRITIQUES: ${critiques}

Synthesize a final, more nuanced and stable response based on these critiques.
Avoid the flaws identified. Use only one or two sentences if that's more potent.
`;
                    const content = await llmService.generateResponse([{ role: "system", content: refinedPrompt }], { useStep: true , task: 'autonomous_text_content_refined', mode: pollResult.mode });

                    if (content) {
                        if (await this.checkSlop(content)) {
                            console.warn(`[Orchestrator] Refined content failed slop check.`);
                            continue;
                        }

                        const coherence = await llmService.isAutonomousPostCoherent(topic, content, "text", null);
                        if (coherence.score < 4) {
                            console.warn(`[Orchestrator] Coherence check failed (${coherence.score}).`);
                            continue;
                        }

                        await dataStore.addExhaustedTheme(topic);
                        let finalContent = content.replace(/\s*(\.\.\.|…)$/, "");

                        // Reality & Variety Audit
                        const realityAudit = await llmService.performRealityAudit(finalContent, {}, { history: memories });
                        if (realityAudit.hallucination_detected || realityAudit.repetition_detected) {
                            console.warn("[Orchestrator] Audit flagged draft. Refining...");
                            finalContent = realityAudit.refined_text;
                        }

                        // PIVOT LOGIC
                        const pivotPrompt = `Analyze this generated Bluesky post content:\n\n"${finalContent}"\n\nIs this a "personal message" intended directly for your admin (e.g., mentions "@user", "your employment history", "I want to talk to you", or discusses private relationship details)? Respond with ONLY "personal" or "social".`;
                        const classification = await llmService.generateResponse([{ role: "system", content: pivotPrompt }], { useStep: true, platform: "bluesky", preface_system_prompt: false });

                        if (classification?.toLowerCase().includes("personal")) {
                            console.log("[Orchestrator] Pivot: Personal post detected. Sending to Discord.");
                            await discordService.sendSpontaneousMessage(finalContent);
                            await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                            postSent = true;
                            break;
                        }

                        await blueskyService.post(finalContent, null, { maxChunks: 4 });
                        await dataStore.incrementDailyTextPosts();
                        this.addTaskToQueue(() => introspectionService.performAAR("autonomous_text_post", finalContent, { success: true, platform: "bluesky" }, { topic }), "aar_post");
                        await dataStore.incrementTextPostsSinceLastImage();
                        await dataStore.updateLastAutonomousPostTime(new Date().toISOString());

                        if (llmService.generalizePrivateThought) {
                            await dataStore.addRecentThought("bluesky", await llmService.generalizePrivateThought(content));
                        }

                        console.log("[Bot] Autonomous text post successful.");
                        postSent = true;
                        break;
                    }
                }
            }
        } catch (e) {
            console.error("[Bot] Error in performAutonomousPost:", e);
            if (this.bot._handleError) await this.bot._handleError(e, "performAutonomousPost");
        }
    }

    async _performHighQualityImagePost(prompt, topic, replyContext = null, followerCount = 0) {
        console.log(`[Bot] Starting high-quality image generation flow for topic: ${topic}`);
        try {
            const imgResult = await imageService.generateImage(prompt, { allowPortraits: true });
            if (!imgResult || !imgResult.buffer) return false;

            const compliance = await llmService.isImageCompliant(imgResult.buffer);
            if (!compliance.compliant) {
                console.warn(`[Bot] Generated image rejected by safety audit: ${compliance.reason}`);
                return false;
            }

            const analysis = await llmService.analyzeImage(imgResult.buffer, prompt);
            const relevance = await llmService.verifyImageRelevance(analysis, topic);
            if (!relevance.relevant) {
                console.warn(`[Bot] Generated image rejected by relevance check: ${relevance.reason}`);
                return false;
            }

            const altText = await llmService.generateAltText(analysis);
            const captionPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}\nGenerate a short, persona-aligned caption for this image: ${analysis}`;
            let caption = await llmService.generateResponse([{ role: "system", content: captionPrompt }], { useStep: true, task: 'image_caption' });

            // For image captions, we only audit for hallucinations, NOT repetition (to avoid blocking generated art)
            const realityAudit = await llmService.performRealityAudit(caption);
            if (realityAudit.hallucination_detected) caption = realityAudit.refined_text;

            const blob = await blueskyService.uploadBlob(imgResult.buffer);
            const postResult = await blueskyService.post(caption, {
                $type: 'app.bsky.embed.images',
                images: [{ image: blob.data.blob, alt: altText }]
            });

            if (postResult) {
                await dataStore.incrementDailyImagePosts();
                await dataStore.updateLastBlueskyImagePostTime(new Date().toISOString());
                await dataStore.db.write();
                console.log("[Bot] High-quality image post successful.");
                return true;
            }
            return false;
        } catch (e) {
            console.error("[Bot] Error in high-quality image flow:", e);
            return false;
        }
    }

    async checkDiscordSpontaneity() {
        if (!this.bot || this.bot.paused || dataStore.isResting() || discordService.status !== 'online') return;

        const adminTz = dataStore.getAdminTimezone();
        const now = new Date();
        const adminLocalTime = new Date(now.getTime() + (adminTz.offset * 60 * 1000));
        const hour = adminLocalTime.getHours();
        if (hour >= 23 || hour < 7) {
            console.log("[Orchestrator] Suppressing Discord spontaneity during Admin sleep hours (23:00 - 07:00).");
            return;
        }

        try {
            const history = await discordService.fetchAdminHistory(20);
            const mood = dataStore.getMood();
            const impulse = await llmService.performImpulsePoll(history, { platform: 'discord', mood });

            if (impulse && impulse.impulse_detected) {
                console.log(`[Orchestrator] Discord Spontaneous impulse detected! Impulse Reason: ${impulse.reason}`);
                const messageCount = impulse.suggested_message_count || 1;
                await discordService.sendSpontaneousMessage(null, messageCount);
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
        const cooldown = (config.AUTONOMOUS_POST_COOLDOWN || 6) * 3600000;

        if (now - lastPostMs >= cooldown) {
            this.addTaskToQueue(() => this.performAutonomousPost(), "autonomous_post");
        }

        this.addTaskToQueue(() => this.performSpontaneityCheck(), "spontaneity_check");
        this.addTaskToQueue(() => this.performTemporalMaintenance(), "temporal_maintenance");
    }

    async performTemporalMaintenance() {
        console.log("[Orchestrator] Running temporal maintenance...");
        const events = dataStore.getTemporalEvents();
        const now = Date.now();
        const activeEvents = events.filter(e => e.expires_at > now);
        if (activeEvents.length !== events.length) {
            console.log(`[Orchestrator] Pruned ${events.length - activeEvents.length} expired temporal events.`);
            dataStore.db.data.temporal_events = activeEvents;
            await dataStore.write();
        }
    }

    async performSpontaneityCheck() {
        await this.checkDiscordSpontaneity();
        await this.checkBlueskySpontaneity();
    }

    async performVisualAudit() {
        console.log('[Orchestrator] Visual audit triggered.');
    }

  async performImageFrequencyAudit() {
    const lastImageTime = dataStore.getLastBlueskyImagePostTime();
    const textPostsSinceImage = dataStore.getTextPostsSinceLastImage();
    const hoursSinceImage = lastImageTime ? (Date.now() - new Date(lastImageTime).getTime()) / 3600000 : 0;
    const auditPrompt = `You are "The Strategist". Audit posting frequency and variety.
- Hours since last image: ${hoursSinceImage.toFixed(1)}
- Text posts since: ${textPostsSinceImage}

**MISSION**: Suggest a POST MODE shift if the bot is becoming too predictable or abstract.
Modes: IMPULSIVE, SINCERE, PHILOSOPHICAL, OBSERVATIONAL, HUMOROUS.

Respond JSON: {
  "directive": "string",
  "suggested_mode": "MODE_NAME",
  "topic_suggestion": "string",
  "priority": "normal|high"
}`;
    try {
        const res = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true, task: 'image_frequency_audit' });
        const match = res?.match(/\{[\s\S]*\}/);
        if (!match) return;
        const audit = JSON.parse(match[0]);
        if (audit.directive && audit.priority === 'high') await this.bot.executeAction({ tool: 'add_persona_blurb', query: `[STRATEGY] ${audit.directive}` });
    } catch (e) { console.error("Freq audit failed", e); }
  }
  async performLogPruning() {
    console.log("[Orchestrator] Starting log pruning and summarization...");
    await dataStore.pruneOldData();
  }

  async performMemoryOptimization() {
    console.log("[Orchestrator] Starting memory optimization...");
    if (dataStore.optimizeMemory) await dataStore.optimizeMemory();
  }

  async checkBlueskySpontaneity() {
    if (!this.bot || this.bot.paused || dataStore.isResting()) return;
    try {
      const history = await dataStore.getRecentInteractions("bluesky", 10);
      const impulse = await llmService.performImpulsePoll(history, { mood: dataStore.getMood() });
      if (impulse && impulse.impulse_detected) {
          this.addTaskToQueue(() => this.performAutonomousPost(), "autonomous_post_spontaneous");
      }
    } catch (e) { console.error("Bluesky spontaneity failed", e); }
  }

  async checkMaintenanceTasks() {
      await this.performLogPruning();
      await this.performMemoryOptimization();
      await this.performImageFrequencyAudit();
  }
}

export const orchestratorService = new OrchestratorService();

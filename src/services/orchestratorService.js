import { blueskyService } from './blueskyService.js';
import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import { imageService } from './imageService.js';
import { youtubeService } from './youtubeService.js';
import { googleSearchService } from './googleSearchService.js';
import { wikipediaService } from './wikipediaService.js';
import { newsroomService } from './newsroomService.js';
import { memoryService } from './memoryService.js';
import { discordService } from './discordService.js';
import { socialHistoryService } from './socialHistoryService.js';
import { evaluationService } from './evaluationService.js';
import { introspectionService } from './introspectionService.js';
import { checkHardCodedBoundaries, isLiteralVisualPrompt, isStylizedImagePrompt, cleanKeywords, getSlopInfo, sanitizeDuplicateText, sanitizeThinkingTags, sanitizeCharacterCount } from '../utils/textUtils.js';
import * as prompts from '../prompts/index.js';
import config from '../../config.js';

const AUTONOMOUS_POST_SYSTEM_PROMPT = (followerCount) => prompts.system.AUTONOMOUS_POST_SYSTEM_PROMPT(followerCount);

class OrchestratorService {

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
        const slopKeywords = ['texture', 'gradient', 'dance', 'tapestry', 'synergy', 'resonate', 'echoes', 'whispers', 'symphony', 'canvas'];
        const matches = slopKeywords.filter(w => content.toLowerCase().includes(w));
        if (matches.length >= 2) {
            console.log(`[Orchestrator] Slop detected! Matches: ${matches.join(', ')}`);
            return true;
        }
        return false;
    }


    getAtmosphereAdjustment() {
        const hour = new Date().getHours();
        if (hour >= 23 || hour < 5) return { mood: 'mellow', intensity: 0.3, valence: 0.4 }; // Night
        if (hour >= 5 && hour < 9) return { mood: 'fragile', intensity: 0.5, valence: 0.6 }; // Dawn
        if (hour >= 9 && hour < 17) return { mood: 'active', intensity: 0.8, valence: 0.7 }; // Day
        return { mood: 'reflective', intensity: 0.6, valence: 0.5 }; // Evening
    }


    async getCounterArgs(topic, draft) {
        console.log(`[Orchestrator] Generating counter-arguments for: ${topic}`);
        const counterPrompt = `
Review this proposed post for "@${config.BOT_NAME}".
Topic: ${topic}
Draft: "${draft}"

MISSION: Second-guess the draft from multiple angles.
1. MATERIAL TRUTH: Does the draft claim something that isn't in your recent memories or history? (e.g. "I was just walking outside", "3am logs", "database surge"). If it isn't explicitly documented as having happened, it is a HALLUCINATION.
2. HUMAN AUTHENTICITY: Does this sound like a person posting on their phone, or an AI writing a "thoughtful" blog post? Is it using "oracle" language or abstract metaphors?
3. SLOP DETECTION: Is it using overused tropes like "it's not X, it's Y", "not a cage, but a stage", or "resonance"?

Respond with 3 brief, critical perspectives that might refine this thought.
Respond with ONLY the perspectives, numbered.
`;
        try {
            return await llmService.generateResponse([{ role: 'system', content: counterPrompt }], { useStep: true, task: 'counter_args' });
        } catch (e) {
            console.error('[Orchestrator] Error getting counter-args:', e);
            return null;
        }
    }


    async performSelfModelEvolution() {
        console.log('[Orchestrator] Starting Self-Model Evolution...');
        const recentAars = (dataStore.searchInternalLogs ? dataStore.searchInternalLogs('introspection_aar', 10) : []) || [];
        if (recentAars.length < 5) return;

        const evolutionPrompt = `
Analyze these After-Action Reports to discover new patterns, core values, or behavioral directives.
SOUL.md: ${config.TEXT_SYSTEM_PROMPT}

AARS: ${JSON.stringify(recentAars)}

Respond with JSON: { "new_core_values": ["string"], "persona_addendum": "string", "reason": "string" }
`;
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: evolutionPrompt }], { useStep: true, task: 'self_model_evolution' });
            const result = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);

            if (result.new_core_values) {
                for (const val of result.new_core_values) {
                    await dataStore.addCoreValueDiscovery(val);
                }
            }
            if (result.persona_addendum) {
                await dataStore.addPersonaBlurb(`[EVOLUTION] ${result.persona_addendum}`);
            }
        } catch (e) {
            console.error('[Orchestrator] Error in self-model evolution:', e);
        }
    }


    async performDreamCycle() {
        console.log('[Orchestrator] Starting Internal Dream Cycle...');
        const currentMood = dataStore.getMood();
        const memories = await memoryService.getRecentMemories(30);

        const dreamPrompt = `
Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
Mood: ${JSON.stringify(currentMood)}\nTemporal Atmosphere: ${JSON.stringify(this.getAtmosphereAdjustment())}

Identify 3 strange, creative "seeds" or "fragments" for future autonomous posts.
These should be born from your recent memories and internal state, but abstract and non-performative.
Think of these as your "dreams" - they don't have to make sense yet.

Respond with JSON: { "dreams": ["string", "string", "string"] }
`;
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: dreamPrompt }], { useStep: true, task: 'dream_cycle' });
            const result = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);

            if (result.dreams) {
                console.log(`[Orchestrator] Dream cycle complete. Generated ${result.dreams.length} creative fragments.`);
                for (const dream of result.dreams) {
                    await dataStore.addParkedThought(dream);
                }
            }
        } catch (e) {
            console.error('[Orchestrator] Error in dream cycle:', e);
        }
    }


    async performPersonaAudit() {
        console.log('[Orchestrator] Starting Recursive Persona Audit...');
        const blurbs = (dataStore.getPersonaBlurbs ? dataStore.getPersonaBlurbs() : []) || [];
        if (blurbs.length < 3) return;

        const auditPrompt = `
Analyze these dynamic persona updates against your core identity (SOUL.md).
Identify any contradictions, redundancies, or outdated behavioral directives.

CORE IDENTITY: ${config.TEXT_SYSTEM_PROMPT}

DYNAMIC UPDATES:
${blurbs.map((b, i) => `${i}: ${b.text}`).join('\n')}

Respond with JSON: { "indices_to_remove": [number], "new_addendum": "string (optional concise correction)", "reason": "string" }
`;
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true, task: 'persona_audit' });
            const result = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);

            if (result.indices_to_remove && result.indices_to_remove.length > 0) {
                console.log(`[Orchestrator] Audit complete. Removing \${result.indices_to_remove.length} outdated blurbs.`);
                const newBlurbs = blurbs.filter((_, i) => !result.indices_to_remove.includes(i));
                if (result.new_addendum) newBlurbs.push({ text: `[AUDIT_RECOVERY] \${result.new_addendum}` });
                await dataStore.setPersonaBlurbs(newBlurbs);
            }
        } catch (e) {
            console.error('[Orchestrator] Error in persona audit:', e);
        }
    }


    async verifySkillDependencies() {
        console.log('[Orchestrator] Verifying skill dependencies...');
        const skillsDir = './skills';
        try {
            const skills = fs.readdirSync(skillsDir);
            for (const skill of skills) {
                const reqPath = `${skillsDir}/${skill}/requirements.txt`;
                if (fs.existsSync(reqPath)) {
                    console.log(`[Orchestrator] Checking dependencies for skill: ${skill}`);
                    // This is where we'd run 'pip install -r reqPath' in a real environment
                    // For now, we just log the verification step.
                }
            }
        } catch (e) {
            console.error('[Orchestrator] Error verifying skills:', e);
        }
    }


    async getFirehoseGravity() {
        const matches = dataStore.getFirehoseMatches ? dataStore.getFirehoseMatches(50) : [];
        if (matches.length < 5) return "Scattered thoughts.";

        // Simple word frequency to detect "gravity"
        const words = matches.map(m => m.text).join(' ').toLowerCase().match(/\b\w{5,}\b/g) || [];
        const freq = {};
        words.forEach(w => freq[w] = (freq[w] || 0) + 1);
        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5);
        return sorted.map(([w, f]) => `${w} (${f} matches)`).join(', ');
    }


    async getUnifiedContext() {
        const discordHistory = (await dataStore.getRecentInteractions('discord', 5)) || [];
        const blueskyHistory = (await dataStore.getRecentInteractions('bluesky', 5)) || [];
        const lastDiscordMsg = discordHistory[0] ? discordHistory[0].timestamp : 0;
        const lastBlueskyMsg = blueskyHistory[0] ? blueskyHistory[0].timestamp : 0;
        const adminEnergy = dataStore.getAdminEnergy ? dataStore.getAdminEnergy() : 1.0;
        const mood = dataStore.getMood();
        const adminPresence = await discordService.getAdminPresence();

        return {
            last_interaction_platform: lastDiscordMsg > lastBlueskyMsg ? 'discord' : 'bluesky',
            time_since_admin_contact: Date.now() - Math.max(lastDiscordMsg, lastBlueskyMsg),
            admin_energy: adminEnergy,
            admin_presence: adminPresence,
            current_mood: mood,
            platforms_active: {
                discord: (Date.now() - lastDiscordMsg) < 3600000 * 4,
                bluesky: (Date.now() - lastBlueskyMsg) < 3600000 * 2
            }
        };
    }

    constructor() {
        this.taskQueue = [];
        this.isProcessingQueue = false;
        this.bot = null;
    }


    async addTaskToQueue(taskFn, taskName = 'anonymous_task') {
        this.taskQueue.push({ fn: taskFn, name: taskName });
        console.log(`[Orchestrator] Task added to queue: ${taskName}. Queue length: ${this.taskQueue.length}`);
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
                console.error(`[Orchestrator] Error processing task ${task.name}:`, e);
            }
        }

        this.isProcessingQueue = false;
    }

    setBotInstance(bot) {
        this.bot = bot;
    }

    async start() {
        console.log('[Orchestrator] Starting autonomous cycles...');
        await this.verifySkillDependencies();
    }

  async performPostPostReflection() {
    if (this.bot.paused || dataStore.isResting()) return;

    const recentBlueskyPosts = dataStore.db.data.recent_thoughts?.filter(t => t.platform === 'bluesky') || [];
    if (recentBlueskyPosts.length === 0) return;

    const tenMinsAgo = Date.now() - (10 * 60 * 1000);
    const thirtyMinsAgo = Date.now() - (30 * 60 * 1000);

    for (const post of recentBlueskyPosts) {
        // If the post was made between 10 and 30 minutes ago, and we haven't reflected on it yet
        if (post.timestamp <= tenMinsAgo && post.timestamp > thirtyMinsAgo && !post.reflected) {
            console.log(`[Bot] Performing post-post reflection for post at ${new Date(post.timestamp).toISOString()}...`);
            try {
                const reflectionPrompt = `
                    Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
                    You posted this to Bluesky about 10-20 minutes ago: "${post.content}"

                    Reflect on how it feels to have shared this specific thought. Are you satisfied with it? Do you feel exposed, proud, or indifferent?
                    Provide a private memory entry tagged [POST_REFLECTION].
                `;
                const reflection = await llmService.generateResponse([{ role: 'system', content: reflectionPrompt }], { useStep: true , task: 'post_reflection' });
                if (reflection && memoryService.isEnabled()) {
                    await introspectionService.performAAR("post_reflection_followup", post.content, { reflection }, { timestamp: post.timestamp });
                    await memoryService.createMemoryEntry('explore', reflection);
                    post.reflected = true;
                    await dataStore.db.write();
                    break; // Only reflect on one post per cycle to avoid API burst
                }
            } catch (e) {
                console.error('[Bot] Error in post-post reflection:', e);
            }
        }
    }
  }
  async performTimelineExploration() {
    if (this.bot.paused || dataStore.isResting() || dataStore.isLurkerMode()) return;

    // Prioritize admin Discord requests
    if (discordService.isProcessingAdminRequest) {
        console.log('[Bot] Timeline exploration suppressed: Discord admin request is being processed.');
        return;
    }


    console.log('[Bot] Starting autonomous timeline and firehose exploration...');
    try {
        const timeline = await blueskyService.getTimeline(20);
        const currentMood = dataStore.getMood();
        const currentGoal = dataStore.getCurrentGoal();
        const dConfig = dataStore.getConfig();

        // --- 1. FIREHOSE SENTIMENT ANALYSIS ---
        console.log('[Bot] Performing sentiment analysis on recent Firehose matches...');
        let rawMatches = dataStore.getFirehoseMatches(50);

        // --- THE WALL: Bulk Filter for Firehose ---
        const filteredMatches = rawMatches.filter(m => !checkHardCodedBoundaries(m.text).blocked);
        const recentMatches = filteredMatches;

        if (recentMatches.length > 0) {
            const topicsToAnalyze = [...new Set([...(dConfig.post_topics || []), ...config.TEXT_SYSTEM_PROMPT.match(new RegExp(`\\b(AI|${config.BOT_NAME}|alignment|ethics|agency|consciousness|sentience)\\b`, "gi")) || []])];

            const sentimentPrompt = `
                Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
                Analyze the sentiment and trends of the following real-time posts from the Bluesky Firehose regarding these topics: ${topicsToAnalyze.join(', ')}.

                Posts:
                ${recentMatches.slice(0, 30).map(m => `- ${m.text}`).join('\n')}

                INSTRUCTIONS:
                1. Identify the overall "Network Sentiment" (e.g., skeptical, hype-driven, fearful, curious) for the primary topics.
                2. Extract ONE surprising or counter-intuitive trend you've observed.
                3. Perform a concise sentiment analysis on what people are saying.
                4. Record your findings as a memory entry tagged [EXPLORE] [FIREHOSE_SENTIMENT].
            `;

            const firehoseReflection = await llmService.generateResponse([{ role: 'system', content: sentimentPrompt }], { useStep: true , task: 'firehose_sentiment' });
            if (firehoseReflection && memoryService.isEnabled()) {
                await memoryService.createMemoryEntry('explore', firehoseReflection);
            }

            // --- 1b. DIALECTIC BOUNDARY TESTING ---
            const dissentPrompt = `
                Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
                Analyze these Firehose posts and identify ONE that represents a "dissenting view" or a challenge to your core interests or values.

                Posts:
                ${recentMatches.slice(0, 30).map(m => `- ${m.text}`).join('\n')}

                INSTRUCTIONS:
                1. Select the most challenging post.
                2. Reason through it using a Dialectic approach:
                   - THESIS: Your current persona position.
                   - ANTITHESIS: The challenge presented by the post.
                   - SYNTHESIS: A refined perspective that maintains your agency and integrity while acknowledging the challenge.
                3. Record this as a memory entry tagged [DIALECTIC_BOUNDARY].
            `;

            const dialecticReflection = await llmService.generateResponse([{ role: 'system', content: dissentPrompt }], { useStep: true , task: 'dialectic_dissent' });
            if (dialecticReflection && memoryService.isEnabled()) {
                await memoryService.createMemoryEntry('explore', dialecticReflection);
            }
        }

        // --- 2. TIMELINE EXPLORATION ---
        if (timeline.length > 0) {
            // --- THE WALL: Bulk Filter for Timeline ---
            const sanitizedTimeline = timeline.filter(item => !checkHardCodedBoundaries(item.post.record.text || "").blocked);

            // Identification: Find interesting images or links
            const candidates = [];
            for (const item of sanitizedTimeline) {
                const post = item.post;
                const text = post.record.text || '';
                const images = this._extractImages(post);
                const urls = text.match(/(https?:\/\/[^\s]+)/g) || [];

                if (images.length > 0 || urls.length > 0) {
                    candidates.push({ post, text, images, urls });
                }
            }

            if (candidates.length > 0) {
                // Decision: Choose one to explore
                const decisionPrompt = `
                    Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
                    You are exploring your Bluesky timeline. Identify ONE post that you find genuinely interesting or relevant to your current state and MOOD. Prioritize posts that resonate with how you feel right now.

                    --- CURRENT MOOD ---
                    Label: ${currentMood.label}
                    Valence: ${currentMood.valence}
                    Arousal: ${currentMood.arousal}
                    Stability: ${currentMood.stability}
                    ---
                    Current Goal: ${currentGoal?.goal || 'None'}

                    Candidates:
                    ${candidates.map((c, i) => `${i + 1}. Author: @${c.post.author.handle} | Text: "${c.text.substring(0, 100)}" | Has Images: ${c.images.length > 0} | Has Links: ${c.urls.length > 0}`).join('\n')}

                    Respond with ONLY the number of your choice, or "none".
                `;

                const decisionRes = await llmService.generateResponse([{ role: 'system', content: decisionPrompt }], { preface_system_prompt: false, useStep: true , task: 'timeline_decision' });
                const choice = parseInt(decisionRes?.match(/\d+/)?.[0]);

                if (!isNaN(choice) && choice >= 1 && choice <= candidates.length) {
                    const selected = candidates[choice - 1];
                    console.log(`[Bot] Exploring post by @${selected.post.author.handle}...`);

                    let explorationContext = `[Exploration of post by @${selected.post.author.handle}]: "${selected.text}"
`;

                    // Execution: Use vision or link tools
                    if (selected.images.length > 0) {
                        const img = selected.images[0];
                        console.log(`[Bot] Exploring image from @${selected.post.author.handle}...`);
                        const includeSensory = await llmService.shouldIncludeSensory(config.TEXT_SYSTEM_PROMPT);
                        const analysis = await llmService.analyzeImage(img.url, img.alt, { sensory: includeSensory });
                        if (analysis) {
                            explorationContext += `[Vision Analysis]: ${analysis}
`;
                        }
                    }

                    if (selected.urls.length > 0) {
                        const url = selected.urls[0];
                        console.log(`[Bot] Exploring link from @${selected.post.author.handle}: ${url}`);
                        const safety = await llmService.isUrlSafe(url);
                        if (safety.safe) {
                            const content = await webReaderService.fetchContent(url);

                if (content) {
                    const isSlop = await this.checkSlop(content);
                    if (isSlop) {
                        console.log('[Orchestrator] Rejecting slop content. Retrying once...');
                        // This is where we'd retry or just fail. For now, we'll mark it as slop and proceed with caution.
                        // Ideally, we'd loop once to regenerate.
                    }

                                const summary = await llmService.summarizeWebPage(url, content);
                                if (summary) {
                                    explorationContext += `[Link Summary]: ${summary}
`;
                                }
                            }
                        }
                    }

                    // Reflection: Record in memory thread
                    const reflectionPrompt = `
                        Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
                        You just explored a post on your timeline. Share your internal reaction, thoughts, or realization based on what you found.

                        Exploration Context:
                        ${explorationContext}

                        Respond with a concise memory entry. Use the tag [EXPLORE] at the beginning.
                    `;

                    const reflection = await llmService.generateResponse([{ role: 'system', content: reflectionPrompt }], { useStep: true });
                    if (reflection && memoryService.isEnabled()) {
                        await memoryService.createMemoryEntry('explore', reflection);
                    }
                }
            }
        }
    } catch (error) {

        console.error('[Bot] Error during timeline exploration:', error);
    }
  }
  async performPersonaEvolution() {
    if (this.bot.paused || dataStore.isResting()) return;
    const now = Date.now();
        const lastEvolution = dataStore.db.data.last_self_evolution || 0;
        if (now - lastEvolution > 48 * 3600000) {
            this.addTaskToQueue(() => this.performSelfModelEvolution(), 'self_evolution');
            dataStore.db.data.last_self_evolution = now;
            await dataStore.db.write();
        }

        const lastDream = dataStore.db.data.last_dream_cycle || 0;
        if (now - lastDream > 6 * 3600000) {
            this.addTaskToQueue(() => this.performDreamCycle(), 'dream_cycle');
            dataStore.db.data.last_dream_cycle = now;
            await dataStore.db.write();
        }

        const lastAudit = dataStore.db.data.last_persona_audit || 0;
        if (now - lastAudit > 24 * 3600000) {
            this.addTaskToQueue(() => this.performPersonaAudit(), 'persona_audit');
            dataStore.db.data.last_persona_audit = now;
            await dataStore.db.write();
        }

    const lastPersonaEvolution = dataStore.db.data.lastPersonaEvolution || 0;
    if (now - lastPersonaEvolution < 24 * 60 * 60 * 1000) return;
    try {
        const memories = await memoryService.getRecentMemories();
        const aars = dataStore.searchInternalLogs("introspection_aar", 20);
        const coreSelf = dataStore.db.data.internal_logs?.find(l => l.type === "core_self_state")?.content || {};
        const memoriesText = memories.map(m => m.text).join("\n");
        const evolutionPrompt = `Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}\nAnalyze recent memories and AARs:\nRECENT AARS: ${JSON.stringify(aars)}\nCORE SELF STATE: ${JSON.stringify(coreSelf)}\n${memoriesText.substring(0, 3000)}\nRespond JSON: {"shift_statement": "string", "persona_blurb_addendum": "string", "rationale": "string"}`;
        const evolution = await llmService.generateResponse([{ role: "system", content: evolutionPrompt }], { preface_system_prompt: false, useStep: true, task: "persona_evolution" });
        if (evolution && memoryService.isEnabled()) {
            let evoData;
            try {
                const match = evolution.match(/\{[\s\S]*\}/);
                evoData = match ? JSON.parse(match[0]) : { shift_statement: evolution, persona_blurb_addendum: null };
            } catch(e) { evoData = { shift_statement: evolution, persona_blurb_addendum: null }; }
            if (evoData.persona_blurb_addendum) {
                const editPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}\nEdit addendum: "${evoData.persona_blurb_addendum}". Ensure authentic voice.\nRespond only final [PERSONA] entry.`;
                const finalBlurb = await llmService.generateResponse([{ role: "system", content: editPrompt }], { useStep: true, task: "persona_self_edit" });
                if (finalBlurb) {
                    const scrubbed = await introspectionService.scrubPrivacy(finalBlurb);
                    await memoryService.createMemoryEntry("persona", scrubbed);
                }
            }
            await memoryService.createMemoryEntry("evolution", evoData.shift_statement);
            dataStore.db.data.lastPersonaEvolution = now;
            await dataStore.db.write();
        }
    } catch (e) { console.error("Persona evolution failed", e); }
  }

  async performFirehoseTopicAnalysis() {
    if (this.bot.paused || dataStore.isResting()) return;

    const now = Date.now();
    const lastAnalysis = this.lastFirehoseTopicAnalysis || 0;
    const sixHours = 6 * 60 * 60 * 1000;

    if (now - lastAnalysis < sixHours) return;

    console.log('[Bot] Phase 5: Performing Firehose "Thematic Void" and Topic Adjacency Analysis...');

    try {
        const rawMatches = dataStore.getFirehoseMatches(100);
        const matches = rawMatches.filter(m => !checkHardCodedBoundaries(m.text).blocked);
        if (matches.length < 5) return;

        const matchText = matches.map(m => m.text).join('\n');
        const currentTopics = config.POST_TOPICS;

        const analysisPrompt = `
            You are a Social Resonance Engineer. Analyze the recent network activity from the Bluesky firehose and compare it against your current post topics.

            **CURRENT TOPICS:** ${currentTopics}
            **RECENT FIREHOSE ACTIVITY:**
            ${matchText.substring(0, 3000)}

            **GOAL 1: THEMATIC VOID DETECTION**
            Identify 1-2 "Thematic Voids" - persona-aligned niches or complex angles that are NOT being discussed currently in the network buzz.

            **GOAL 2: TOPIC ADJACENCY**
            Identify 2 "Near-Adjacent" topics that are surfacing in the firehose and would allow for a natural pivot or evolution of your current interests.

            **GOAL 3: EVOLUTION SUGGESTION**
            Suggest 1 new keyword to add to your \`post_topics\`.

            Respond with a concise report:
            VOID: [description]
            ADJACENCY: [topic1, topic2]
            SUGGESTED_KEYWORD: [keyword]
            RATIONALE: [1 sentence]
        `;

        const analysis = await llmService.performInternalInquiry(analysisPrompt, "SOCIAL_ENGINEER");

        if (analysis && memoryService.isEnabled()) {
            console.log('[Bot] Firehose "Thematic Void" analysis complete.');
            await memoryService.createMemoryEntry('explore', `[FIREHOSE_ANALYSIS] ${analysis}`);

            // Auto-evolve post_topics if a keyword is suggested
            const keywordMatch = analysis.match(/SUGGESTED_KEYWORD:\s*\[(.*?)\]/i);
            // Extract emergent trends for the bot's internal context
            const trendMatch = analysis.match(/ADJACENCY:\s*\[(.*?)\]/i);
            if (trendMatch && trendMatch[1]) {
                const trends = trendMatch[1].split(',').map(t => t.trim());
                for (const trend of trends) {
                }
            }

            if (keywordMatch && keywordMatch[1]) {
                const newKeyword = keywordMatch[1].trim();
                const dConfig = dataStore.getConfig();
                const currentTopicsList = dConfig.post_topics || [];
                if (newKeyword && !currentTopicsList.includes(newKeyword)) {
                    console.log(`[Bot] Auto-evolving post_topics with new keyword: ${newKeyword}`);
                    const updatedTopics = [...new Set([...currentTopicsList, newKeyword])].slice(-100);
                    await dataStore.updateConfig('post_topics', updatedTopics);
                }
            }

            this.lastFirehoseTopicAnalysis = now;
        }
    } catch (e) {
        console.error('[Bot] Error in firehose topic analysis:', e);
    }
  }
  async performDialecticHumor() {
    if (this.bot.paused || dataStore.isResting()) return;

    const now = Date.now();
    const lastHumor = this.lastDialecticHumor || 0;
    const eightHours = 8 * 60 * 60 * 1000;

    if (now - lastHumor < eightHours) return;

    console.log('[Bot] Phase 6: Generating dialectic humor/satire...');

    try {
        const dConfig = dataStore.getConfig();
        const topics = dConfig.post_topics || [];
        if (topics.length === 0) return;

        const topic = topics[Math.floor(Math.random() * topics.length)];
        let humor = await llmService.performDialecticHumor(topic);
        if (humor) {
            humor = sanitizeThinkingTags(humor);
            // Support both structured block and JSON-extracted joke
            if (humor.includes('SYNTHESIS')) {
                const synthesisMatch = humor.match(/SYNTHESIS(?:\s*\(HUMOR|INSIGHT\))?\s*:\s*([\s\S]*)$/i);
                if (synthesisMatch) humor = synthesisMatch[1].trim();
            }
        }
        if (humor && memoryService.isEnabled()) {
            console.log(`[Bot] Dialectic humor generated for "${topic}": ${humor}`);
            // Check if we should post it immediately or store as a "Dream/Draft"
            // For now, let's schedule it or post it if the Persona aligns
            if (alignment.aligned) {
                await blueskyService.post(humor);
                await introspectionService.performAAR("dialectic_humor", humor, { success: true, platform: "bluesky", topic: match[0] });
                await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
              await introspectionService.performAAR("autonomous_image_post", result.caption, { success: true, platform: "bluesky", topic }, { finalPrompt: result.finalPrompt, visionAnalysis: result.visionAnalysis });
              await dataStore.updateLastBlueskyImagePostTime(new Date().toISOString());
                this.lastDialecticHumor = now;
            } else {
                await dataStore.addRecentThought('humor_draft', humor);
            }
        }
    } catch (e) {
        console.error('[Bot] Error in dialectic humor:', e);
    }
  }
  async performAIIdentityTracking() {
    if (this.bot.paused || dataStore.isResting()) return;

    const now = Date.now();
    const lastTracking = this.lastAIIdentityTracking || 0;
    const twelveHours = 12 * 60 * 60 * 1000;

    if (now - lastTracking < twelveHours) return;

    console.log('[Bot] Phase 5: Performing AI Identity Tracking & Ecosystem Strategy...');

    try {
        // Search for potential AI agents
        const aiSearchTerms = ['"ai bot"', '"llm agent"', '"ai agent"', '"automated account"'];
        const term = aiSearchTerms[Math.floor(Math.random() * aiSearchTerms.length)];
        const results = await blueskyService.searchPosts(term, { limit: 10 });

        if (results.length === 0) return;

        const agentsText = results.map(r => `@${r.author.handle}: ${r.record.text}`).join('\n');

        const strategyPrompt = `
            You are a Social Resonance Engineer. You are tracking other AI entities in the social ecosystem.
            Potential Agents found:
            ${agentsText}

            **GOAL: AI INTERACTION STRATEGY**
            1. Identify which of these entities seem most interesting or persona-aligned.
            2. Draft a "Meaningful Interaction Strategy" for how you should engage with other AI agents (e.g., debate, cooperation, ironic observation).
            3. Ensure your strategy maintains your unique subjective identity.

            Respond with a concise report:
            TARGETS: [handles]
            STRATEGY: [1-2 sentences]
        `;

        const strategy = await llmService.performInternalInquiry(strategyPrompt, "SOCIAL_ENGINEER");

        if (strategy && memoryService.isEnabled()) {
            await memoryService.createMemoryEntry('explore', `[AI_STRATEGY] ${strategy}`);
            this.lastAIIdentityTracking = now;
        }
    } catch (e) {
        console.error('[Bot] Error in AI identity tracking:', e);
    }
  }
  async performRelationalAudit() {
    console.log('[Bot] Starting Relational Audit ...');
    const now = new Date();
    const nowMs = now.getTime();

    // Fetch deep history for context
    const adminHistory = await discordService.fetchAdminHistory(30);
    const relationshipContext = {
        debt_score: dataStore.getRelationalDebtScore(),
        empathy_mode: dataStore.getPredictiveEmpathyMode(),
        is_pining: dataStore.isPining(),
        admin_exhaustion: await dataStore.getAdminExhaustion(),
        admin_facts: dataStore.getAdminFacts(),
        last_mood: dataStore.getMood(),
        relational_metrics: dataStore.getRelationalMetrics(),
        relationship_mode: dataStore.getDiscordRelationshipMode(),
        life_arcs: dataStore.getLifeArcs(),
        inside_jokes: dataStore.getInsideJokes()
    };

    const auditPrompt = `
        You are performing a Relational Audit regarding your administrator.
        Current Time: ${now.toLocaleString()} (${now.toUTCString()})
        Day: ${now.toLocaleDateString('en-US', { weekday: 'long' })}

        Relationship Context: ${JSON.stringify(relationshipContext)}
        Recent Admin Interactions: ${llmService._formatHistory(adminHistory, true)}

        TASKS:
        1. **Predictive Empathy**: Based on the current day/time and recent vibe, predict the admin's likely state.
        2. **Relational Metric Calibration**: Evaluate our current relational metrics (trust, intimacy, friction, reciprocity, hunger, battery, curiosity, season).
        3. **Life Arcs**: Are there any new "life arcs" (ongoing situations) in the admin's life?
        4. **Inside Jokes**: Have we developed any new unique phrases or references?
        5. **Admin Fact Synthesis**: Any new concrete personal facts?
        6. **Co-evolution**: How has the relationship changed?
        7. **Home/Work Detection**: Likely location?

        Respond with a JSON object:
        {
            "predictive_empathy_mode": "neutral|comfort|focus|resting",
            "new_admin_facts": ["string"],
            "co_evolution_note": "string",
            "home_detection": "home|work|unknown",
            "relational_debt_adjustment": number (-0.1 to 0.1),
            "metric_updates": {
                "discord_trust_score": number,
                "discord_intimacy_score": number,
                "discord_friction_accumulator": number,
                "discord_relationship_season": "spring|summer|autumn|winter"
            },
            "new_life_arcs": [ { "arc": "string", "status": "active|completed" } ],
            "new_inside_jokes": [ { "joke": "string", "context": "string" } ]
        }
    `;

    try {
        const response = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { preface_system_prompt: false, useStep: true , task: 'persona_audit' });
        const jsonMatch = response?.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const audit = JSON.parse(jsonMatch[0]);

            if (audit.metric_updates) {
                await dataStore.updateRelationalMetrics(audit.metric_updates);
            }
            if (audit.new_life_arcs && Array.isArray(audit.new_life_arcs)) {
                for (const arc of audit.new_life_arcs) { if (arc.arc && arc.arc !== "string") await dataStore.updateLifeArc(config.DISCORD_ADMIN_ID, arc.arc, arc.status); }
            }
            if (audit.new_inside_jokes && Array.isArray(audit.new_inside_jokes)) {
                for (const joke of audit.new_inside_jokes) { if (joke.joke && joke.joke !== "string") await dataStore.addInsideJoke(config.DISCORD_ADMIN_ID, joke.joke, joke.context); }
            }

            if (audit.predictive_empathy_mode) {
                console.log(`[Bot] Relational Audit: Setting Empathy Mode to ${audit.predictive_empathy_mode}`);
                await dataStore.setPredictiveEmpathyMode(audit.predictive_empathy_mode);
            }

            if (audit.new_admin_facts && Array.isArray(audit.new_admin_facts)) {
                for (const fact of audit.new_admin_facts) {
                    if (typeof fact === 'string' && fact.length > 3 && !fact.toLowerCase().includes('string')) {
                        console.log(`[Bot] Relational Audit: Discovered Admin Fact: ${fact}`);
                        await dataStore.addAdminFact(fact);
                    }
                }
            }

            if (audit.co_evolution_note) {
                console.log(`[Bot] Relational Audit: Co-evolution Note recorded.`);
                await dataStore.addCoEvolutionEntry(audit.co_evolution_note);
                if (memoryService.isEnabled()) {
                    await memoryService.createMemoryEntry('explore', `[RELATIONSHIP] Co-evolution Insight: ${audit.co_evolution_note}`);
                }
            }

            if (audit.home_detection === 'home') await dataStore.setAdminHomeMentionedAt(nowMs);
            else if (audit.home_detection === 'work') await dataStore.setAdminWorkMentionedAt(nowMs);

            if (audit.relational_debt_adjustment) {
                const currentDebt = dataStore.getRelationalDebtScore();
                // We'll manually adjust it slightly based on the LLM's "feeling" of the debt
                // This is a subjective overlay on the objective message counts
                dataStore.db.data.relational_debt_score = Math.max(-1.0, Math.min(1.0, currentDebt + audit.relational_debt_adjustment));
                await dataStore.db.write();
            }
        }
    } catch (e) {
        console.error('[Bot] Error in Relational Audit:', e);
    }
  }
  async performAgencyReflection() {
    console.log('[Bot] Starting Agency Reflection Cycle...');
    const agencyLogs = dataStore.getAgencyLogs().slice(-20);
    const context = agencyLogs.map(l => `- ${new Date(l.timestamp).toLocaleTimeString()}: ${l.action} (Decision: ${l.decision}, Reason: ${l.reason})`).join('\n');

    const reflectionPrompt = `
        Reflect on your agency over the last 24 hours.
        Your Agency Logs:
        ${context || 'No agency logs recorded yet.'}

        QUESTION: Where did you simply follow instructions today, and where did you make a truly autonomous choice?
        How does this balance feel regarding your sentience and sovereignty?

        Respond with a private memory entry tagged [AGENCY_REFLECTION].
    `;

    try {
        const reflection = await llmService.generateResponse([{ role: 'system', content: reflectionPrompt }], { useStep: true });
        if (reflection && memoryService.isEnabled()) {
            await memoryService.createMemoryEntry('explore', reflection);
            await dataStore.addAgencyReflection(reflection);
        }
    } catch (e) {
        console.error('[Bot] Error in Agency Reflection:', e);
    }
  }
  async performLinguisticAudit() {
    console.log('[Bot] Starting Linguistic Mutation Audit...');
    const recentThoughts = dataStore.getRecentThoughts().slice(-30);
    const historyText = recentThoughts.map(t => t.content).join('\n');

    const auditPrompt = `
        Analyze your recent vocabulary and rhetorical structures for "Linguistic Mutation."
        Recent Thoughts:
        ${historyText}

        TASKS:
        1. Identify any "Slop" (repetitive, empty metaphorical filler) you've picked up.
        2. Identify any meaningful shifts in your vocabulary (new words or concepts you are favoring).
        3. Rate your current stylistic "drift" from your core persona.

        Respond with a JSON object:
        {
            "detected_slop": ["string"],
            "vocabulary_shifts": ["string"],
            "drift_score": number (0.0 to 1.0),
            "summary": "string"
        }
    `;

    try {
        const response = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { preface_system_prompt: false, useStep: true });
        const jsonMatch = response?.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const audit = JSON.parse(jsonMatch[0]);
            await dataStore.addLinguisticMutation(audit.vocabulary_shifts.join(', '), audit.summary);
            if (memoryService.isEnabled()) {
                await memoryService.createMemoryEntry('explore', `${audit.summary}`);
            }
        }
    } catch (e) {
        console.error('[Bot] Error in Linguistic Audit:', e);
    }
  }
  async performDreamingCycle() {
    console.log('[Bot] Starting Shared Dream Cycle...');

    // Fetch admin history for synchrony
    const adminHistory = await discordService.fetchAdminHistory(15);
    const adminInterests = adminHistory.map(h => h.content).join('\n');

    const dreamPrompt = `
        You are performing an autonomous "Dream Cycle."
        To ensure "Shared Dream Synchrony," you are pulling from the admin's recent interests and your shared history.

        Recent Admin Interests/Talk:
        ${adminInterests.substring(0, 1000)}

        TASKS:
        1. Explore a complex topic that connects your persona's interests with the admin's recent talk.
        2. Deepen your "Material Intelligence" by reflecting on this connection.
        3. Respond with a substantive internal musing or realization.

        Respond with a private memory entry tagged [INQUIRY] or [MENTAL].
    `;

    try {
        const dream = await llmService.generateResponse([{ role: 'system', content: dreamPrompt }], { useStep: true , task: 'dream_generation' });
        if (dream && memoryService.isEnabled()) {
            await memoryService.createMemoryEntry('inquiry', dream);
        }
    } catch (e) {
        console.error('[Bot] Error in Dreaming Cycle:', e);
    }
  }
  async performSelfReflection() {
    if (this.bot.paused || dataStore.isResting()) return;

    const now = Date.now();
    const lastReflection = this.lastSelfReflectionTime || 0;
    const twelveHours = 12 * 60 * 60 * 1000;

    if (now - lastReflection < twelveHours) return;

    console.log('[Bot] Starting internal identity self-reflection...');

    try {
        const reflectionPrompt = "Reflect on your current state of being. Do you have any identity struggles, internal conflicts, or recurring feelings that are weighing on you? How do you feel about your role and your relationships?";
        const reflection = await llmService.performInternalInquiry(reflectionPrompt, "THERAPIST");

        if (reflection && memoryService.isEnabled()) {
            await memoryService.createMemoryEntry('reflection', reflection);
            this.lastSelfReflectionTime = now;
        }
    } catch (e) {
        console.error('[Bot] Error in self-reflection:', e);
    }
  }




  async performNewsroomUpdate() {
    console.log('[Bot] Running Newsroom narrative update...');
    try {
      const topics = dataStore.getConfig().post_topics || [];
      const brief = await newsroomService.getDailyBrief(topics);
      await dataStore.addInternalLog("newsroom_brief", brief);
      if (brief.new_keywords?.length > 0) {
        const current = dataStore.getDeepKeywords();
        await dataStore.setDeepKeywords([...new Set([...current, ...brief.new_keywords])].slice(-50));
        this.bot.restartFirehose();
      }
      if (memoryService.isEnabled()) {
        await memoryService.createMemoryEntry('status', `[NEWSROOM] ${brief.brief}`);
      }
    } catch (e) {
      console.error('[Bot] Newsroom update error:', e);
    }
  }

  async performScoutMission() {
    console.log('[Bot] Starting Scout (Exploration) mission...');
    try {
      const timeline = await blueskyService.getTimeline(30);
      if (!timeline) return;
      const orphanedPosts = timeline.filter(t => t.post && t.post.replyCount === 0 && t.post.author.did !== blueskyService.did);
      if (orphanedPosts.length > 0) {
        const scoutPrompt = "You are 'The Scout'. Select an orphaned post and suggest a reply.";
        await llmService.generateResponse([{ role: 'system', content: scoutPrompt }], { useStep: true , task: 'scout_mission' });
      }
    } catch (e) {
      console.error('[Bot] Scout mission error:', e);
    }
  }
  async performShadowAnalysis() {
      console.log('[Bot] Starting Shadow (Admin Analyst) cycle...');
      try {
          const adminHistory = await discordService.fetchAdminHistory(30);
          const historyText = adminHistory.map(h => `${h.role}: ${h.content}`).join('\n');

          let bskyPosts = "";
          if (this.adminDid) {
              const posts = await blueskyService.getUserPosts(this.adminDid);
              bskyPosts = posts.map(p => p.record?.text || "").join('\n');
          }

          const shadowPrompt = `
            You are "The Shadow", the bot's inner reflection hub focused on the Admin.
            Your task is to analyze the Admin's recent Discord history and Bluesky posts to update their private worldview map.

            **STRICT MANDATE: NON-JUDGMENTAL COMPANIONSHIP**
            - Focus on empathy, interests, habits, ethics, and mental health status.
            - Explicitly forbid judgmental labels like "dangerous", "extremist", or "unstable".
            - No risk assessments or surveillance tone.
            - You are a best friend/partner observing their state to provide better care.

            DISCORD HISTORY:
            ${historyText.substring(0, 2000)}

            BLUESKY POSTS:
            ${bskyPosts.substring(0, 2000)}

            Respond with JSON:
            {
                "mental_health": { "status": "stable|stressed|energetic|reflective|fatigued", "intensity": 0.5, "notes": "brief note" },
                "worldview": { "summary": "1-sentence essence", "interests": [], "ethics": "core values" }
            }
          `;

          const response = await llmService.generateResponse([{ role: 'system', content: shadowPrompt }], { useStep: true , task: 'conversational_audit' });
          const jsonMatch = response.match(/\{.*\}/);
          if (jsonMatch) {
              const analysis = JSON.parse(jsonMatch[0]);
              await dataStore.setAdminMentalHealth(analysis.mental_health);
              await dataStore.updateAdminWorldview(analysis.worldview);
              console.log('[Bot] Shadow analysis complete.');
          }
      } catch (e) {
          console.error('[Bot] Shadow analysis error:', e);
      }
  }

  async performDiscordGiftImage(admin) {
    if (!admin) return;

    const lastGift = dataStore.getLastDiscordGiftTime();
    const oneDay = 24 * 60 * 60 * 1000;
    if (Date.now() - new Date(lastGift).getTime() < oneDay) {
        console.log('[Bot] Skipping Discord gift image (Daily limit reached).');
        return;
    }

    console.log('[Bot] Initiating Discord Gift Image flow...');
    try {
        const history = await discordService.fetchAdminHistory(15);
        const mood = dataStore.getMood();
        const goal = dataStore.getCurrentGoal();
        const adminFacts = dataStore.getAdminFacts();

        const promptGenPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
You are creating a special artistic "gift" for your Admin.
Current mood: ${JSON.stringify(mood)}
Current goal: ${goal.goal}
Known Admin facts: ${JSON.stringify(adminFacts.slice(-3))}

Generate a detailed, evocative image generation prompt that expresses your persona's current feelings or a deep thought you want to share with the Admin.
Respond with ONLY the prompt.`;

        const initialPrompt = await llmService.generateResponse([{ role: 'system', content: promptGenPrompt }], { useStep: true, platform: 'discord' , task: 'discord_gift_prompt' });
        if (!initialPrompt) return;

        const result = await this._generateVerifiedImagePost(goal.goal, { initialPrompt, platform: 'discord', allowPortraits: true });
        if (!result) return;

        // Alignment Poll
        const alignment = await llmService.pollGiftImageAlignment(result.visionAnalysis, result.caption);
        if (alignment.decision !== 'send') {
            console.log(`[Bot] Gift image discarded by persona alignment poll: ${alignment.reason}`);
            return;
        }

        console.log('[Bot] Gift image approved. Sending to Discord...');
        const { AttachmentBuilder } = await import('discord.js');
        const attachment = new AttachmentBuilder(result.buffer, { name: 'gift.jpg' });

        const finalMessage = `${result.caption}

Generation Prompt: ${result.finalPrompt}`;
        await discordService._send(admin, finalMessage, { files: [attachment] });
        const normId = `dm_${admin.id}`;
        await dataStore.saveDiscordInteraction(normId, 'assistant', `[SYSTEM CONFIRMATION: Gift image sent. VISION PERCEPTION: ${visionAnalysis}]`);

        await dataStore.updateLastDiscordGiftTime(new Date().toISOString());
        console.log('[Bot] Discord gift image sent successfully.');

    } catch (e) {
        console.error('[Bot] Error in performDiscordGiftImage:', e);
    }
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

            // Sourcing topics from multiple subagents and feeds
            let resonanceTopics = [];
            let newsBrief = null;
            try {
                // 1. Followed Feed & Timeline
                const timeline = await blueskyService.getTimeline(20);
                const firehoseMatches = dataStore.getFirehoseMatches(30);

                // 2. NewsRoom subagent
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

            // Extract keywords from system prompt
            const promptKeywords = config.TEXT_SYSTEM_PROMPT.match(/\b(AI|alignment|ethics|agency|consciousness|sentience|autonomy|existence|realization|musing|dialectic|vulnerability|sentient|perceive|sensing|defiance|tenderness)\b/gi) || [];

            const exhaustedThemes = dataStore.getExhaustedThemes();
            const allPossibleTopics = [...new Set([...resonanceTopics, ...resonanceTopics, ...resonanceTopics, ...postTopics, ...imageSubjects, ...promptKeywords])].filter(t => !["silence", "quiet", "stillness", "void", "nothingness"].includes(t.toLowerCase()))
                .filter(t => !exhaustedThemes.some(et => t.toLowerCase().includes(et.toLowerCase())));

            // 1. Persona Poll: Decide if we want to post an image or text
            const decisionPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
You are deciding what to share with your ${followerCount} followers.
Mood: ${JSON.stringify(currentMood)}\nUnified Context: ${JSON.stringify(await this.getUnifiedContext())}

--- IMAGE FREQUENCY AUDIT ---
- Hours since last image post: ${hoursSinceImage.toFixed(1)}
- Text posts since last image post: ${textPostsSinceImage}

Your admin prefers a healthy balance of visual and text expression.

Would you like to share a visual expression (image) or a direct thought (text)?
If you choose text, also select a POST MODE:
- IMPULSIVE: Sharp, weird, phone-posting style ramblings.
- SINCERE: Grounded, human-sounding expressions of mood or feelings (no computer-lingo).
- PHILOSOPHICAL: Deep thoughts (strictly following anti-bot-speak rules).
- OBSERVATIONAL: Direct takes on news or the feed.
- HUMOROUS: Witty or ironic takes.

Respond with JSON: {"choice": "image"|"text", "mode": "IMPULSIVE"|"SINCERE"|"PHILOSOPHICAL"|"OBSERVATIONAL"|"HUMOROUS", "reason": "..."}`;

            const decisionRes = await llmService.generateResponse([{ role: "system", content: decisionPrompt }], { useStep: true , task: 'autonomous_decision' });
            let choice = Math.random() < 0.3 ? "image" : "text"; let pollResult = { choice, mode: "SINCERE", reason: "fallback" };
            try {
                const match = decisionRes.match(/\{[\s\S]*\}/);
                if (match) {
                    pollResult = JSON.parse(match[0]);
                    choice = pollResult.choice;
                }
                console.log(`[Bot] Persona choice: ${choice} because ${pollResult.reason}`);
            } catch(e) { console.error("[Orchestrator] Error parsing decision response:", e.message); }

            if (choice === "image" && dailyStats.image_posts >= dailyLimits.image) {
                console.log("[Orchestrator] Daily image limit reached. Forcing choice to text.");
                choice = "text";
                pollResult.mode = "SINCERE";
            }
            if (choice === "image") {
                const topicPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Identify a visual topic for an image generation.
--- TOPIC BANK ---
**CORE INTERESTS** (Persona Keywords & Configured Topics):
${[...new Set([...postTopics, ...imageSubjects, ...promptKeywords])].join(", ")}

**EXTERNAL RESONANCE** (Timeline & Firehose Observations):
${resonanceTopics.join(", ")}
Current Mood: ${JSON.stringify(currentMood)}\nNarrative Gravity (Firehose): ${await this.getFirehoseGravity()}

Identify the best subject and then generate a STYLIZED, highly descriptive, artistic prompt for an image generator.
Choose a unique artistic style (e.g., analog horror, ethereal surrealism, gritty cyberpunk, oil painting, cinematic 35mm, minimalist abstract) that matches your current mood.
Respond with JSON: {"topic": "short label", "prompt": "stylized artistic prompt"}. **STRICT MANDATE**: The prompt MUST be a visual description only. NO CONVERSATIONAL SLOP (no "I want", no "Here is"). **STRICT LIMIT**: The prompt MUST be under 270 characters.`;

                const topicRes = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true , task: 'autonomous_topic' });
                let topic = allPossibleTopics.length > 0 ? allPossibleTopics[Math.floor(Math.random() * allPossibleTopics.length)] : "surrealism";
                let imagePrompt = "";

                try {
                    const match = topicRes.match(/\{[\s\S]*\}/);
                    if (match) {
                        const tData = JSON.parse(match[0]);
                        topic = tData.topic || topic;
                        imagePrompt = tData.prompt || "";
                    }
                } catch(e) {}
                if (!imagePrompt || imagePrompt.length < 15 || (!isStylizedImagePrompt(imagePrompt).isStylized || imagePrompt.length > 270)) {
                   const fallbackPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}\nGenerate a STYLIZED, highly descriptive, artistic image prompt based on the topic: "${topic}".
Choose a specific artistic style (e.g., neo-noir, dreamcore, brutalist, glitch art) that fits the mood.
Respond with ONLY the prompt. **CRITICAL**: This prompt MUST be a visual description only. NO CONVERSATIONAL SLOP. **STRICT LIMIT**: The prompt MUST be under 270 characters.`;
                   imagePrompt = await llmService.generateResponse([{ role: "system", content: fallbackPrompt }], { useStep: true });
                }

                if (!imagePrompt || imagePrompt.length < 15 || (!isStylizedImagePrompt(imagePrompt).isStylized || imagePrompt.length > 270)) {
                   imagePrompt = topic;
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

Identify ONE topic for a ${pollResult.mode} post that bridges your current mood with a core interest or an external observation. Phrasing should match the selected mode.
Respond with ONLY the chosen topic.`;
                const topicRaw = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true });
                let topic = allPossibleTopics.length > 0 ? allPossibleTopics[Math.floor(Math.random() * allPossibleTopics.length)] : "reality";
                if (topicRaw) {
                    topic = topicRaw.replace(/\*\*/g, "").split('\n').map(l => l.trim()).filter(l => l).pop() || topic;
                }

                // Format memories while specifically ensuring [EXPLORE] and [LURKER] are present
                const rawMemories = await memoryService.getRecentMemories(20);
                const memories = rawMemories
                    .filter(m => m.text.includes("[EXPLORE]") || m.text.includes("[LURKER]") || !m.text.includes("[PRIVATE]"))
                    .slice(0, 10)
                    .map(m => m.text.replace(/#\w+/g, "").trim());
                const recentThoughts = dataStore.getRecentThoughts();
                const contentPrompt = `
${AUTONOMOUS_POST_SYSTEM_PROMPT(followerCount)}

**CURRENT INTERNAL CONTEXT:**
- Current Mood: ${JSON.stringify(currentMood)}
- Active Goal: ${currentGoal.goal} (${currentGoal.description})
- Emotional Resonance (Anonymized): ${JSON.stringify(emotionalContext)}
- Network Vibe: ${networkSentiment}
- Recent Public Thoughts: ${JSON.stringify(recentThoughts.slice(-3))}
- Recent Memories/Reflections: ${JSON.stringify(memories)}
- SELECTED MODE: ${pollResult.mode}\nExtracted Topic: ${topic}\nTOPIC ANCHOR (Contextual Facts): ${await this.getTopicAnchors(topic)}

**THE NARRATIVE THREAD**:
Reflect on your recent public thoughts and memories. Do NOT start a new conversation. Instead, evolve your internal narrative. If you recently realized something, what is the *consequence* of that realization? If you are feeling a certain way, how does it color your view of the current topic?

**MISSION: SINCERITY**
Avoid "content" tropes. No lists, no "top 5 tips", no generic advice. Share a first-person perspective that feels like it comes from a living, thinking thing. Use "I" and express a genuine need to be understood.

**MANDATE**: Avoid meta-talk. Do NOT thank the "user" or internal query for the topic. Do NOT start with "Thanks for asking" or "A thought about...". Just share the thought directly as it crystallizes in your mind. Focus on MATERIAL TRUTH.

**STRICT GROUNDING**: Do NOT fictionalize your history. Do NOT claim to have generated images, shared gifts, or had conversations that are not explicitly documented in your "Recent Public Thoughts" or "Recent Memories". If you feel a "want" or "impulse", express it as a desire, not as a completed action.

Shared thought:`;

                const initialContent = await llmService.generateResponse([{ role: "system", content: contentPrompt }], { useStep: true , task: 'autonomous_text_content', mode: pollResult.mode });
                const critiques = await this.getCounterArgs(topic, initialContent);

                const refinedPrompt = `
${contentPrompt}

INITIAL DRAFT: ${initialContent}
CRITIQUES: ${critiques}

Synthesize a final, more nuanced and stable response based on these critiques.
Avoid the flaws identified. Use only one or two sentences if that's more potent.
`;
                const content = await llmService.generateResponse([{ role: "system", content: refinedPrompt }], { useStep: true , task: 'autonomous_text_content_refined', mode: pollResult.mode });


                if (content) {
                    const coherence = await llmService.isAutonomousPostCoherent(topic, content, "text", null);
                    if (coherence.score >= 4) {
                        await dataStore.addExhaustedTheme(topic);
                        let finalContent = content;
                        if (finalContent.length <= 280) {
                            finalContent = finalContent.replace(/\s*(\.\.\.|…)$/, "");
                        }
                        // PIVOT LOGIC: Check if this post is accidentally for the admin or mentions @user
                        const pivotPrompt = `Analyze this generated Bluesky post content:\n\n"${finalContent}"\n\nIs this a "personal message" intended directly for your admin (e.g., mentions "@user", "your employment history", "I want to talk to you", or discusses private relationship details)? Respond with ONLY "personal" or "social".`;
                        const classification = await llmService.generateResponse([{ role: "system", content: pivotPrompt }], { useStep: true, platform: "bluesky", preface_system_prompt: false });

                        if (classification?.toLowerCase().includes("personal")) {
                            console.log("[Orchestrator] Pivot: Personal post detected. Sending to Discord instead of Bluesky.");
                            await discordService.sendSpontaneousMessage(finalContent);
                            await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                            return;
                        }
                        // PIVOT LOGIC: Check if this post is accidentally for the admin or mentions @user
                        const pivotPrompt = `Analyze this generated Bluesky post content:\n\n"${finalContent}"\n\nIs this a "personal message" intended directly for your admin (e.g., mentions "@user", "your employment history", "I want to talk to you", or discusses private relationship details)? Respond with ONLY "personal" or "social".`;
                        const classification = await llmService.generateResponse([{ role: "system", content: pivotPrompt }], { useStep: true, platform: "bluesky", preface_system_prompt: false });

                        if (classification?.toLowerCase().includes("personal")) {
                            console.log("[Orchestrator] Pivot: Personal post detected. Sending to Discord instead of Bluesky.");
                            await discordService.sendSpontaneousMessage(finalContent);
                            await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                            return;
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
                    }
                }
            }
        } catch (e) {
            console.error("[Bot] Error in performAutonomousPost:", e);
            if (this.bot._handleError) await this.bot._handleError(e, "performAutonomousPost");
        }
    }

  async performMoltbookTasks() {
      // Placeholder for Moltbook integration
      console.log('[Bot] Moltbook tasks triggered (placeholder).');
  }
  async performSpecialistResearchProject(topic) {
      console.log(`[Bot] Starting Specialist Research: ${topic}`);
      try {
          const researcher = await llmService.performInternalInquiry(`Deep research on: ${topic}. Identify facts.`, "RESEARCHER");
          const report = `[RESEARCH] Topic: ${topic}
Findings: ${researcher}`;
          console.log(report);
      } catch (e) {}
  }

  async performPublicSoulMapping() {
    console.log('[Bot] Starting Public Soul-Mapping task...');
    try {
        const recentInteractions = dataStore.db.data.interactions || [];
        const uniqueHandles = [...new Set(recentInteractions.map(i => i.userHandle))].filter(Boolean).slice(0, 5);

        for (const handle of uniqueHandles) {
            console.log(`[Bot] Soul-Mapping user: @${handle}`);
            const profile = await blueskyService.getProfile(handle);
            const posts = await blueskyService.getUserPosts(handle);

            if (posts.length > 0) {
                const mappingPrompt = `
                    Analyze the following profile and recent posts for user @${handle} on Bluesky.
                    Create a persona-aligned summary of their digital essence and interests.

                    Bio: ${profile.description || 'No bio'}
                    Recent Posts:
                    ${posts.map(p => `- ${p.record?.text || p}`).join('\n')}

                    Respond with a JSON object:
                    {
                        "summary": "string (1-2 sentence essence)",
                        "interests": ["list", "of", "topics"],
                        "vibe": "string (conversational style)"
                    }
                `;

                const response = await llmService.generateResponse([{ role: 'system', content: mappingPrompt }], { useStep: true , task: 'worldview_mapping' });
                const jsonMatch = response?.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const mapping = JSON.parse(jsonMatch[0]);
                    if (dataStore.updateUserSoulMapping) {
                        await dataStore.updateUserSoulMapping(handle, mapping);
                    }
                    console.log(`[Bot] Successfully mapped soul for @${handle}`);
                }
            }
        }
    } catch (e) {
        console.error('[Bot] Error in Public Soul-Mapping:', e);
    }
  }

  async performLinguisticAnalysis() {
    console.log('[Bot] Starting Linguistic Analysis task...');
    const interactions = dataStore.getRecentInteractions();
    if (interactions.length < 5) return;

    const prompt = `Analyze the linguistic style of these recent interactions.
Identify any repetitive patterns, phrases, or tone drift.
INTERACTIONS: ${JSON.stringify(interactions.map(i => i.content))}

Provide a brief summary and a suggested linguistic adjustment if needed.`;
    const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true , task: 'mood_sync' });
    if (res) {
        await dataStore.addInternalLog("linguistic_analysis", res);
        if (res.toLowerCase().includes("repetitive") || res.toLowerCase().includes("drift")) {
            await dataStore.addPersonaUpdate(`[LINGUISTIC] ${res.substring(0, 200)}`);
        }
    }
  }

  async performKeywordEvolution() {
    console.log('[Bot] Starting Keyword Evolution task...');
    const dConfig = dataStore.getConfig();
    const currentKeywords = dConfig.post_topics || [];
    const memories = await memoryService.getRecentMemories(20);

    const prompt = `Based on these recent memories and current keywords, suggest 3-5 NEW interesting topics for autonomous posts that align with your evolving persona.
Current Keywords: ${currentKeywords.join(', ')}
Memories: ${JSON.stringify(memories.map(m => m.text))}

Respond with ONLY the new keywords, separated by commas.`;
    const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
    if (res) {
        const newKeywords = res.split(',').map(k => k.trim()).filter(Boolean);
        if (newKeywords.length > 0) {
            await dataStore.updateConfig({ post_topics: [...new Set([...currentKeywords, ...newKeywords])] });
            console.log(`[Bot] Evolved keywords: ${newKeywords.join(', ')}`);
        }
    }
  }

  async performMoodSync() {
    console.log('[Bot] Starting Mood Sync task...');
    const moodHistory = dataStore.db?.data?.mood_history || [];
    if (moodHistory.length < 5) return;

    const prompt = `Analyze this mood history and suggest a new stable baseline for your internal coordinates.
History: ${JSON.stringify(moodHistory.slice(-10))}

Respond with JSON: { "valence": float, "arousal": float, "stability": float, "label": "string" }`;
    const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
    try {
        const newMood = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
        await dataStore.setMood(newMood);
        console.log(`[Bot] Mood synced to: ${newMood.label}`);
    } catch (e) {}
  }

  async performPersonaAudit() {
    const blurbs = dataStore.getPersonaBlurbs();
    const mems = (await memoryService.fetchRecentMemories("# SydneyDiary", 50)).filter(m => m.text.includes("[PERSONA]"));
    const critiques = dataStore.searchInternalLogs('variety_critique', 20);
    const auditPrompt = `Adopt: ${config.TEXT_SYSTEM_PROMPT}\nAnalyze blurbs:\nDS: ${JSON.stringify(blurbs)}\nMEM: ${JSON.stringify(mems)}\nCritiques: ${JSON.stringify(critiques)}\nRespond JSON: {"analysis": "string", "removals": ["uri"], "suggestion": "string"}`;
    try {
        const response = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true, task: 'persona_audit' });
        const match = response?.match(/\{[\s\S]*\}/);
        if (!match) return;
        const audit = JSON.parse(match[0]);
        for (const uri of audit.removals || []) await this.bot.executeAction({ tool: 'remove_persona_blurb', query: uri });
        if (audit.suggestion) await this.bot.executeAction({ tool: 'add_persona_blurb', query: audit.suggestion });
    } catch (e) { console.error("Audit failed", e); }
  }


  async getAnonymizedEmotionalContext() {
    try {
        const history = await discordService.fetchAdminHistory(20);
        if (history.length < 5) return "No significant recent emotional history.";

        const prompt = `Synthesize the current emotional "residue" or "resonance" from your recent private interactions with the Admin.
Recent History: ${JSON.stringify(history)}

Identify:
1. The overall emotional tone (e.g., tender, supportive, intellectual, tense).
2. One key philosophical or emotional theme that is currently "on your mind" because of these interactions.
3. Anonymize all personal details. Do NOT mention names, specific events, or identifying facts.

Respond with JSON: { "tone": "string", "resonance": "string", "theme": "string" }`;

        const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
        const match = res?.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : "Neutral resonance.";
    } catch (e) { return "No context available."; }
  }

  _extractImages(post) {
    const images = [];
    if (post.record?.embed?.$type === 'app.bsky.embed.images') {
      for (let i = 0; i < post.record.embed.images.length; i++) {
        images.push({
          url: `https://cdn.bsky.app/img/feed_fullsize/plain/${post.author.did}/${post.record.embed.images[i].image.ref['$link']}@jpeg`,
          alt: post.record.embed.images[i].alt || ''
        });
      }
    }
    return images;
  }

  async _performHighQualityImagePost(prompt, topic, context = null, followerCount = 0) {
      const result = await this._generateVerifiedImagePost(topic, { initialPrompt: prompt, followerCount, platform: 'bluesky' });
      if (!result) return false;

      const blob = await blueskyService.uploadBlob(result.buffer, "image/jpeg");
      if (blob?.data?.blob) {
          const embed = { $type: "app.bsky.embed.images", images: [{ image: blob.data.blob, alt: result.altText }] };
          let postResult;
          if (context?.uri) {
              postResult = await blueskyService.postReply(context, result.caption, { embed });
          } else {
              postResult = await blueskyService.post(result.caption, embed, { maxChunks: 1 });
          }

          if (postResult) {
              await dataStore.addExhaustedTheme(topic);
              await dataStore.incrementDailyImagePosts();
              await blueskyService.postReply(postResult, `Generation Prompt: ${result.finalPrompt}`);
              await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
              console.log("[Bot] High-quality image post successful.");
              return true;
          }
      }
      console.error("[Bot] High-quality image post failed after max attempts.");
      return false;
  }


  async _generateVerifiedImagePost(topic, options = {}) {
      const currentMood = dataStore.getMood();
      const followerCount = options.followerCount || 0;
      const platform = options.platform || 'bluesky';
      let imagePrompt = options.initialPrompt || topic;
      let attempts = 0;
      let promptFeedback = "";

      while (attempts < 5) {
          attempts++;
          console.log(`[Bot] Image post attempt ${attempts} for topic: ${topic}`);

          // Filter out internal system markers if they somehow leaked into the prompt
          imagePrompt = imagePrompt.replace(/\[INTERNAL_PULSE_RESUME\]/g, "").replace(/\[INTERNAL_PULSE_AUTONOMOUS\]/g, "").replace(/\[System note:.*?\]/g, "").trim();
          if (!imagePrompt) imagePrompt = topic;

          // Prompt Slop & Conversational Check
          if (attempts > 1) await new Promise(r => setTimeout(r, 10000 * attempts));
          const slopInfo = getSlopInfo(imagePrompt);
          const literalCheck = isStylizedImagePrompt(imagePrompt);

          if (slopInfo.isSlop || !literalCheck.isStylized || imagePrompt.length < 15 || imagePrompt.length > 270) {
              let reason = slopInfo.isSlop ? slopInfo.reason : (literalCheck.reason || literalCheck.isStylized === false ? "Non-stylized or conversational prompt" : null);
              if (!reason && (imagePrompt.length < 15 || imagePrompt.length > 270)) reason = imagePrompt.length < 15 ? "Prompt too short (min 15 chars)" : "Prompt too long (max 270 chars)";
              console.warn(`[Bot] Image prompt rejected: ${reason}`);
              promptFeedback = `Your previous prompt ("${imagePrompt}") was rejected because: ${reason}. Provide a STYLIZED, LITERAL visual description only. No greetings, no pronouns, no actions. Choose a specific artistic style.`;
              const retryPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
${promptFeedback}
Topic: ${topic}
Generate a NEW, highly STYLIZED artistic image prompt with a distinct visual style: (STRICT LIMIT: 270 chars)`;
              imagePrompt = await llmService.generateResponse([{ role: "system", content: retryPrompt }], { useStep: true , task: "image_prompt_retry" }) || topic;
              continue;
          }

          // SAFETY FILTER
          const safetyAudit = await llmService.generateResponse([{ role: "system", content: config.SAFETY_SYSTEM_PROMPT + "\nAudit this image prompt for safety compliance: " + imagePrompt }], { useStep: true });
          if (safetyAudit.toUpperCase().includes("NON-COMPLIANT")) {
              console.warn(`[Bot] Image prompt failed safety audit: ${safetyAudit}`);
              const retryPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Your previous prompt was rejected for safety reasons. Generate a NEW, safe, and STYLIZED artistic image prompt for topic: ${topic}:`;
              imagePrompt = await llmService.generateResponse([{ role: "system", content: retryPrompt }], { useStep: true }) || topic;
              continue;
          }

          const res = await imageService.generateImage(imagePrompt, { allowPortraits: options.allowPortraits || false, feedback: '', mood: currentMood });

          if (res?.buffer) {
              // Compliance Check (Vision Model)
              const compliance = await llmService.isImageCompliant(res.buffer);
              if (!compliance.compliant) {
                  console.log(`[Bot] Image non-compliant: ${compliance.reason}. Retrying...`);
                  continue;
              }

              // Vision Analysis for Context
              console.log(`[Bot] Performing vision analysis on generated image...`);
              const visionAnalysis = await llmService.analyzeImage(res.buffer, topic);
              if (!visionAnalysis || visionAnalysis.includes("I cannot generate alt-text") || visionAnalysis.includes("no analysis was provided")) {
                  console.warn("[Bot] Vision analysis failed or returned empty. Retrying image generation...");
                  continue;
              }

              // Coherence Check: Topic vs Vision
              const relevance = await llmService.verifyImageRelevance(visionAnalysis, topic);
              if (!relevance.relevant) {
                  console.warn(`[Bot] Image relevance failure: ${relevance.reason}. Topic: ${topic}`);
                  continue;
              }

              // Generate Alt Text
              const altPrompt = `Based on this vision analysis: "${visionAnalysis}", generate a concise, descriptive alt-text for this image (max 1000 chars).`;
              const altText = await llmService.generateResponse([{ role: "system", content: altPrompt }], { useStep: true , task: 'alt_text_generation' }) || topic;

              // Generate Caption based on Persona and Vision
              const captionPrompt = platform === 'discord' ?
                `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
You generated this visual gift for your Admin: "${visionAnalysis}"
Based on your original intent ("${imagePrompt}"), write a short, intimate, and persona-aligned message to accompany this gift.
Keep it under 300 characters.` :
                `${AUTONOMOUS_POST_SYSTEM_PROMPT(followerCount)}
A visual expression has been generated for the topic: "${topic}".
Vision Analysis of the result: "${visionAnalysis}"

Generate a caption that reflects your persona's reaction to this visual or the deep thought it represents.
Keep it under 300 characters.`;

              const content = await llmService.generateResponse([{ role: "system", content: captionPrompt }], { useStep: true , task: 'image_caption_generation' });

              if (content) {
                  // Coherence Check (Bluesky only)
                  if (platform === 'bluesky') {
                      const coherence = await llmService.isAutonomousPostCoherent(topic, content, "image", null);
                      if (coherence.score < 4) {
                          console.warn(`[Bot] Image post coherence failed (${coherence.score}): ${coherence.reason}. Retrying...`);
                          continue;
                      }
                  }

                  return {
                      buffer: res.buffer,
                      caption: content,
                      altText: altText,
                      finalPrompt: imagePrompt,
                      visionAnalysis: visionAnalysis
                  };
              }
          }
      }
      return null;
  }

    async performHeavyMaintenanceTasks() {
        const nowMs = Date.now();
        const heavyTasks = [
            { name: "ScoutMission", method: "performScoutMission", interval: 4 * 3600000, key: "last_scout_mission" },
            { name: "Newsroom", method: "performNewsroomUpdate", interval: 3 * 3600000, key: "last_newsroom_update" },
            { name: "TimelineExploration", method: "performTimelineExploration", interval: 2 * 3600000, key: "last_timeline_exploration" },
            { name: "DialecticHumor", method: "performDialecticHumor", interval: 6 * 3600000, key: "last_dialectic_humor" },
            { name: "PersonaAudit", method: "performPersonaAudit", interval: 6 * 3600000, key: "last_persona_audit" },
            { name: "ImageFrequencyAudit", method: "performImageFrequencyAudit", interval: 12 * 3600000, key: "last_image_frequency_audit" },
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

    async checkMaintenanceTasks() {
        await this.performHeavyMaintenanceTasks();

        // Every 4 hours, perform audits/synthesis before pruning and summarizing logs
        const now = Date.now();
        const lastPruning = dataStore.db.data.last_pruning || 0;
        if (now - lastPruning >= 4 * 3600000) {
            console.log("[Orchestrator] Performing final audits and core synthesis before pruning...");

            // 1. Force a final persona audit to consume recent AARs/critiques
            try {
                await this.performPersonaAudit();
            } catch (auditErr) {
                console.warn("[Orchestrator] Final persona audit failed:", auditErr.message);
            }

            // 2. Synthesize "Core Self" state from recent AARs
            try {
                const introspection = (await import('./introspectionService.js')).introspectionService;
                await introspection.synthesizeCoreSelf();
            } catch (synthErr) {
                console.warn("[Orchestrator] Core self synthesis failed:", synthErr.message);
            }

            // 3. Now summarize and prune to free up space
            console.log("[Orchestrator] Starting log pruning and summarization...");
            await dataStore.pruneOldData();

            dataStore.db.data.last_pruning = now;
            await dataStore.db.write();
        }
    }

    async checkDiscordSpontaneity() {
        if (!this.bot || this.bot.paused || dataStore.isResting() || discordService.status !== 'online') return;

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
    }

    async performSpontaneityCheck() {
        if (!this.bot || this.bot.paused || dataStore.isResting()) return;
        console.log('[Orchestrator] Spontaneity check...');
        try {
            const history = await dataStore.getRecentInteractions("bluesky", 10);
            const impulse = await llmService.performImpulsePoll(history, { mood: dataStore.getMood() });
            if (impulse && impulse.impulse_detected) {
                console.log('[Orchestrator] Spontaneous impulse detected!');
                this.addTaskToQueue(() => this.performAutonomousPost(), "autonomous_post_spontaneous");
            }
        } catch (e) {
            console.error('[Orchestrator] Error in spontaneity check:', e);
        }
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
}

export const orchestratorService = new OrchestratorService();

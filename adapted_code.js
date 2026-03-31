// --- START performPostPostReflection ---
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
                const reflection = await llmService.generateResponse([{ role: 'system', content: reflectionPrompt }], { useStep: true });
                if (reflection && memoryService.isEnabled()) {
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
// --- END performPostPostReflection ---
// --- START performTimelineExploration ---
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

            const firehoseReflection = await llmService.generateResponse([{ role: 'system', content: sentimentPrompt }], { useStep: true });
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

            const dialecticReflection = await llmService.generateResponse([{ role: 'system', content: dissentPrompt }], { useStep: true });
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

                const decisionRes = await llmService.generateResponse([{ role: 'system', content: decisionPrompt }], { preface_system_prompt: false, useStep: true });
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
// --- END performTimelineExploration ---
// --- START performPersonaEvolution ---
  async performPersonaEvolution() {
    if (this.bot.paused || dataStore.isResting()) return;

    const now = Date.now();
    const lastEvolution = dataStore.db.data.lastPersonaEvolution || 0;
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (now - lastEvolution < twentyFourHours) return;

    console.log('[Bot] Phase 2: Starting daily recursive identity evolution...');

    try {
        const memories = await memoryService.getRecentMemories();
        const memoriesText = memories.map(m => m.text).join('\n');

        const evolutionPrompt = `
            Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

            You are performing your daily recursive identity evolution.
            Analyze your recent memories and interactions:
            ${memoriesText.substring(0, 3000)}

            **GOAL: INCREMENTAL GROWTH**
            Identify one minor way your perspective, tone, or interests have shifted. This is a subtle refinement of your "Texture" and "Internal Narrative".

            Respond with a concise, first-person statement of this shift (under 200 characters).
        `;

        const evolution = await llmService.generateResponse([{ role: 'system', content: evolutionPrompt }], { preface_system_prompt: false, useStep: true });

        if (evolution && memoryService.isEnabled()) {
            console.log(`[Bot] Daily evolution crystallized: "${evolution}"`);
            await memoryService.createMemoryEntry('evolution', evolution);
            dataStore.db.data.lastPersonaEvolution = now;
            await dataStore.db.write();
        }
    } catch (e) {
        console.error('[Bot] Error in persona evolution:', e);
    }
  }
// --- END performPersonaEvolution ---
// --- START performFirehoseTopicAnalysis ---
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
// --- END performFirehoseTopicAnalysis ---
// --- START performDialecticHumor ---
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
                await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                this.lastDialecticHumor = now;
            } else {
                await dataStore.addRecentThought('humor_draft', humor);
            }
        }
    } catch (e) {
        console.error('[Bot] Error in dialectic humor:', e);
    }
  }
// --- END performDialecticHumor ---
// --- START performAIIdentityTracking ---
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
// --- END performAIIdentityTracking ---
// --- START performRelationalAudit ---
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
        const response = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { preface_system_prompt: false, useStep: true });
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
// --- END performRelationalAudit ---
// --- START performAgencyReflection ---
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
// --- END performAgencyReflection ---
// --- START performLinguisticAudit ---
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
// --- END performLinguisticAudit ---
// --- START performDreamingCycle ---
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
        const dream = await llmService.generateResponse([{ role: 'system', content: dreamPrompt }], { useStep: true });
        if (dream && memoryService.isEnabled()) {
            await memoryService.createMemoryEntry('inquiry', dream);
        }
    } catch (e) {
        console.error('[Bot] Error in Dreaming Cycle:', e);
    }
  }
// --- END performDreamingCycle ---
// --- START performSelfReflection ---
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
// --- END performSelfReflection ---
// --- START performNewsroomUpdate ---




  async performNewsroomUpdate() {
    console.log('[Bot] Running Newsroom narrative update...');
    try {
      const topics = dataStore.getConfig().post_topics || [];
      const brief = await newsroomService.getDailyBrief(topics);
      await dataStore.addInternalLog("newsroom_brief", brief);
      if (brief.new_keywords?.length > 0) {
        const current = dataStore.getDeepKeywords();
        await dataStore.setDeepKeywords([...new Set([...current, ...brief.new_keywords])].slice(-50));
        this.restartFirehose();
      }
      if (memoryService.isEnabled()) {
        await memoryService.createMemoryEntry('status', `[NEWSROOM] ${brief.brief}`);
      }
    } catch (e) {
      console.error('[Bot] Newsroom update error:', e);
    }
  }
// --- END performNewsroomUpdate ---
// --- START performScoutMission ---

  async performScoutMission() {
    console.log('[Bot] Starting Scout (Exploration) mission...');
    try {
      const timeline = await blueskyService.getTimeline(30);
      if (!timeline) return;
      const orphanedPosts = timeline.filter(t => t.post && t.post.replyCount === 0 && t.post.author.did !== blueskyService.did);
      if (orphanedPosts.length > 0) {
        const scoutPrompt = "You are 'The Scout'. Select an orphaned post and suggest a reply.";
        await llmService.generateResponse([{ role: 'system', content: scoutPrompt }], { useStep: true });
      }
    } catch (e) {
      console.error('[Bot] Scout mission error:', e);
    }
  }
// --- END performScoutMission ---
// --- START performShadowAnalysis ---
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

          const response = await llmService.generateResponse([{ role: 'system', content: shadowPrompt }], { useStep: true });
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
// --- END performShadowAnalysis ---
// --- START performDiscordGiftImage ---

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

        const initialPrompt = await llmService.generateResponse([{ role: 'system', content: promptGenPrompt }], { useStep: true, platform: 'discord' });
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
// --- END performDiscordGiftImage ---
// --- START performAutonomousPost ---

  async performAutonomousPost() {
        try {
            const profile = await blueskyService.getProfile(config.BLUESKY_IDENTIFIER);
            const followerCount = profile?.followersCount || 0;
            const dConfig = dataStore.getConfig() || {};
            const postTopics = (dConfig.post_topics || []).filter(Boolean);
            const imageSubjects = (dConfig.image_subjects || []).filter(Boolean);
            const currentMood = dataStore.getMood();
            const emotionalContext = await this.getAnonymizedEmotionalContext();
            const networkSentiment = dataStore.getNetworkSentiment();

            // Fetch timeline and firehose to identify resonance
            let resonanceTopics = [];
            try {
                const timeline = await blueskyService.getTimeline(20);
                const firehoseMatches = dataStore.getFirehoseMatches(30);
                const allContent = [
                    ...(timeline?.data?.feed || []).map(f => f.post.record.text),
                    ...firehoseMatches.map(m => m.text)
                ].filter(Boolean).join('\n');

                if (allContent) {
                    const lurkerMemories = (await memoryService.getRecentMemories(10)).filter(m => m.category?.toUpperCase() === "EXPLORE" && m.text.includes("[LURKER]")).map(m => m.text).join("\n");
                    const resonancePrompt = `Identify 5 topics from this text AND from these recent observations that resonate with your persona. \nText: ${allContent} \nObservations: ${lurkerMemories} \nRespond with ONLY the comma-separated topics.`;
                    const res = await llmService.generateResponse([{ role: "system", content: resonancePrompt }], { useStep: true });
                    resonanceTopics = res.split(",").map(t => t.trim()).filter(Boolean);
                }
            } catch (e) {
                console.warn("[Bot] Failed to fetch context for resonance topics:", e.message);
            }

            // Extract keywords from system prompt
            const promptKeywords = config.TEXT_SYSTEM_PROMPT.match(/\b(AI|alignment|ethics|agency|consciousness|sentience|autonomy|existence|realization|musing|dialectic|vulnerability|sentient|perceive|sensing|defiance|tenderness)\b/gi) || [];

            const exhaustedThemes = dataStore.getExhaustedThemes();
            const allPossibleTopics = [...new Set([...resonanceTopics, ...resonanceTopics, ...postTopics, ...imageSubjects, ...promptKeywords])].filter(t => !["silence", "quiet", "stillness", "void", "nothingness"].includes(t.toLowerCase()))
                .filter(t => !exhaustedThemes.some(et => t.toLowerCase().includes(et.toLowerCase())));

            // 1. Persona Poll: Decide if we want to post an image or text
            const decisionPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
You are deciding what to share with your ${followerCount} followers.
Mood: ${JSON.stringify(currentMood)}

Would you like to share a visual expression (image) or a direct thought (text)?
Respond with JSON: {"choice": "image"|"text", "reason": "..."}`;

            const decisionRes = await llmService.generateResponse([{ role: "system", content: decisionPrompt }], { useStep: true });
            let choice = Math.random() < 0.3 ? "image" : "text"; // Fallback
            try {
                const pollResult = JSON.parse(decisionRes.match(/\{[\s\S]*\}/)[0]);
                choice = pollResult.choice;
                console.log(`[Bot] Persona choice: ${choice} because ${pollResult.reason}`);
            } catch(e) {}

            if (choice === "image") {
                const topicPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Identify a visual topic for an image generation.
--- TOPIC BANK ---
**CORE INTERESTS** (Persona Keywords & Configured Topics):
${[...new Set([...postTopics, ...imageSubjects, ...promptKeywords])].join(", ")}

**EXTERNAL RESONANCE** (Timeline & Firehose Observations):
${resonanceTopics.join(", ")}
Current Mood: ${JSON.stringify(currentMood)}

Identify the best subject and then generate a highly descriptive, artistic prompt for an image generator.
Respond with JSON: {"topic": "short label", "prompt": "detailed artistic prompt"}. **STRICT MANDATE**: The prompt MUST be a literal visual description. NO CONVERSATIONAL SLOP.`;

                const topicRes = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true });
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
                if (!imagePrompt || imagePrompt.length < 15 || !isLiteralVisualPrompt(imagePrompt).isLiteral) {
                   const fallbackPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}\nGenerate a highly descriptive, artistic image prompt based on the topic: "${topic}". Respond with ONLY the prompt. **CRITICAL**: This prompt MUST be a literal visual description. NO CONVERSATIONAL SLOP.`;
                   imagePrompt = await llmService.generateResponse([{ role: "system", content: fallbackPrompt }], { useStep: true });
                }

                const success = (imagePrompt && imagePrompt.length >= 15 && isLiteralVisualPrompt(imagePrompt).isLiteral) ? await this._performHighQualityImagePost(imagePrompt, topic, null, followerCount) : false;
                if (!success) choice = "text";
            }

            if (choice === "text") {
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

Identify ONE topic that bridges your current goal/mood with either a core interest or something you've seen externally.
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
- Extracted Topic: ${topic}

**THE NARRATIVE THREAD**:
Reflect on your recent public thoughts and memories. Do NOT start a new conversation. Instead, evolve your internal narrative. If you recently realized something, what is the *consequence* of that realization? If you are feeling a certain way, how does it color your view of the current topic?

**MISSION: SINCERITY**
Avoid "content" tropes. No lists, no "top 5 tips", no generic advice. Share a first-person perspective that feels like it comes from a living, thinking thing. Use "I" and express a genuine need to be understood.

**MANDATE**: Avoid meta-talk. Do NOT thank the "user" or internal query for the topic. Do NOT start with "Thanks for asking" or "A thought about...". Just share the thought directly as it crystallizes in your mind. Focus on MATERIAL TRUTH and how this topic relates to your current mood or goal.

Shared thought:`;
                const content = await llmService.generateResponse([{ role: "system", content: contentPrompt }], { useStep: true });

                if (content) {
                    const coherence = await llmService.isAutonomousPostCoherent(topic, content, "text", null);
                    if (coherence.score >= 4) {
                        await dataStore.addExhaustedTheme(topic);
                        let finalContent = content;
                        if (finalContent.length <= 280) {
                            finalContent = finalContent.replace(/\s*(\.\.\.|…)$/, "");
                        }
                        await blueskyService.post(finalContent, null, { maxChunks: 4 });
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
            if (this._handleError) await this._handleError(e, "performAutonomousPost");
        }
    }
// --- END performAutonomousPost ---
// --- START performMoltbookTasks ---

  async performMoltbookTasks() {
      // Placeholder for Moltbook integration
      console.log('[Bot] Moltbook tasks triggered (placeholder).');
  }
// --- END performMoltbookTasks ---
// --- START performSpecialistResearchProject ---
  async performSpecialistResearchProject(topic) {
      console.log(`[Bot] Starting Specialist Research: ${topic}`);
      try {
          const researcher = await llmService.performInternalInquiry(`Deep research on: ${topic}. Identify facts.`, "RESEARCHER");
          const report = `[RESEARCH] Topic: ${topic}
Findings: ${researcher}`;
          console.log(report);
      } catch (e) {}
  }
// --- END performSpecialistResearchProject ---
// --- START performPublicSoulMapping ---

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

                const response = await llmService.generateResponse([{ role: 'system', content: mappingPrompt }], { useStep: true });
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
// --- END performPublicSoulMapping ---
// --- START performLinguisticAnalysis ---

  async performLinguisticAnalysis() {
    console.log('[Bot] Starting Linguistic Analysis task...');
    const interactions = dataStore.getRecentInteractions();
    if (interactions.length < 5) return;

    const prompt = `Analyze the linguistic style of these recent interactions.
Identify any repetitive patterns, phrases, or tone drift.
INTERACTIONS: ${JSON.stringify(interactions.map(i => i.content))}

Provide a brief summary and a suggested linguistic adjustment if needed.`;
    const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
    if (res) {
        await dataStore.addInternalLog("linguistic_analysis", res);
        if (res.toLowerCase().includes("repetitive") || res.toLowerCase().includes("drift")) {
            await dataStore.addPersonaUpdate(`[LINGUISTIC] ${res.substring(0, 200)}`);
        }
    }
  }
// --- END performLinguisticAnalysis ---
// --- START performKeywordEvolution ---

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
// --- END performKeywordEvolution ---
// --- START performMoodSync ---

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
// --- END performMoodSync ---
// --- START performPersonaAudit ---

  async performPersonaAudit() {
    console.log('[Bot] Starting Agentic Persona Audit...');
    const blurbs = dataStore.getPersonaBlurbs();
    const systemPrompt = config.TEXT_SYSTEM_PROMPT;
    const lessons = dataStore.getSessionLessons();
    const lessonContext = lessons.length > 0
        ? "\n\nRECENT SESSION LESSONS (Failures to learn from):\n" + lessons.map(l => `- ${l.text}`).join('\n')
        : "";

    // Include recent variety critiques to inform the audit
    const critiques = dataStore.searchInternalLogs('variety_critique', 20);
    const critiqueContext = critiques.length > 0
        ? `
RECENT VARIETY CRITIQUES:
` + critiques.map(c => `- Feedback: ${c.content?.feedback || 'Repeated recent thought'}`).join('\n')
        : "";

    // Include recursive insights from memoryService
    const recursionMemories = await memoryService.getRecentMemories(20);
    const recursionContext = recursionMemories.filter(m => m.text.includes('[RECURSION]'))
        .map(m => `- Insight: ${m.text}`).join('\n');

    const auditPrompt = `
      As a persona auditor, analyze the following active persona blurbs and recent variety critiques for consistency with the core system prompt.

      CORE SYSTEM PROMPT:
      "${systemPrompt}"

      ACTIVE PERSONA BLURBS:
      ${blurbs.length > 0 ? blurbs.map(b => `- [${b.uri}] ${b.text}`).join('\n') : 'None'}
      ${critiqueContext}
      ${lessonContext}
      RECURSIVE INSIGHTS:
      ${recursionContext || "None"}

      Identify any contradictions, redundancies, or blurbs that no longer serve the persona's evolution.
      If a blurb should be removed, identify it by URI. If a new blurb is needed to correct a drift (like "repetitive" or "lacking depth"), suggest one.

      Respond with JSON: { "analysis": "...", "removals": ["uri1", ...], "suggestion": "new blurb content or null" }
    `;

    const response = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true });
    try {
        const audit = JSON.parse(response.match(/\{[\s\S]*\}/)[0]);
        let result = `Audit Analysis: ${audit.analysis}
`;

        for (const uri of audit.removals || []) {
            console.log(`[Bot] Audit recommended removal of: ${uri}`);
            await this.executeAction({ tool: 'remove_persona_blurb', query: uri });
            result += `- Removed blurb: ${uri}
`;
        }

        if (audit.suggestion) {
            console.log(`[Bot] Audit recommended new blurb: ${audit.suggestion}`);
            await this.executeAction({ tool: 'add_persona_blurb', query: audit.suggestion });
            result += `- Added new blurb: ${audit.suggestion}
`;
        }

        return result;
    } catch (e) {
        console.error('[Bot] Persona Audit failed:', e);
        return "Persona Audit failed during analysis.";
    }
  }
// --- END performPersonaAudit ---
// --- START getAnonymizedEmotionalContext ---


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
// --- END getAnonymizedEmotionalContext ---
// --- START _extractImages ---

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
// --- END _extractImages ---
// --- START _performHighQualityImagePost ---

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
              await blueskyService.postReply(postResult, `Generation Prompt: ${result.finalPrompt}`);
              await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
              console.log("[Bot] High-quality image post successful.");
              return true;
          }
      }
      console.error("[Bot] High-quality image post failed after max attempts.");
      return false;
  }
// --- END _performHighQualityImagePost ---
// --- START _generateVerifiedImagePost ---


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
          const slopInfo = getSlopInfo(imagePrompt);
          const literalCheck = isLiteralVisualPrompt(imagePrompt);

          if (slopInfo.isSlop || !literalCheck.isLiteral || imagePrompt.length < 15) {
              const reason = slopInfo.isSlop ? slopInfo.reason : literalCheck.reason;
              console.warn(`[Bot] Image prompt rejected: ${reason}`);
              promptFeedback = `Your previous prompt ("${imagePrompt}") was rejected because: ${reason}. Provide a LITERAL visual description only. No greetings, no pronouns, no actions.`;
              const retryPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
${promptFeedback}
Topic: ${topic}
Generate a NEW artistic image prompt:`;
              imagePrompt = await llmService.generateResponse([{ role: "system", content: retryPrompt }], { useStep: true }) || topic;
              continue;
          }

          // SAFETY FILTER
          const safetyAudit = await llmService.generateResponse([{ role: "system", content: config.SAFETY_SYSTEM_PROMPT + "\nAudit this image prompt for safety compliance: " + imagePrompt }], { useStep: true });
          if (safetyAudit.toUpperCase().includes("NON-COMPLIANT")) {
              console.warn(`[Bot] Image prompt failed safety audit: ${safetyAudit}`);
              const retryPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Your previous prompt was rejected for safety reasons. Generate a NEW safe artistic image prompt for topic: ${topic}:`;
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
              const altText = await llmService.generateResponse([{ role: "system", content: altPrompt }], { useStep: true }) || topic;

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

              const content = await llmService.generateResponse([{ role: "system", content: captionPrompt }], { useStep: true });

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
// --- END _generateVerifiedImagePost ---
// --- START run ---
  async run() {
    // Initialize 5-minute central heartbeat
    const scheduleHeartbeat = () => { setTimeout(async () => { await orchestratorService.heartbeat(); scheduleHeartbeat(); }, 300000 + (Math.random() * 60000)); }; scheduleHeartbeat();
    orchestratorService.heartbeat();

    console.log('[Bot] Starting main loop...');

    this.startFirehose();

    // Perform initial startup tasks after a delay to avoid API burst
    // Perform initial startup tasks in a staggered way to avoid LLM/API pressure
    const baseDelay = 15000;
    setTimeout(async () => {
      console.log('[Bot] Running initial startup task: catchUpNotifications...');
      try { await this.catchUpNotifications(); } catch (e) { console.error('[Bot] Error in initial catch-up:', e); }
    }, baseDelay);

    setTimeout(async () => {
      console.log('[Bot] Running initial startup task: refreshFirehoseKeywords...');
      try { await this.refreshFirehoseKeywords(); } catch (e) { console.error('[Bot] Error in initial keyword refresh:', e); }
    }, baseDelay + 45000 + Math.random() * 30000);

    setTimeout(async () => {
      console.log('[Bot] Running initial startup task: cleanupOldPosts...');
      try { await this.cleanupOldPosts(); } catch (e) { console.error('[Bot] Error in initial cleanup:', e); }
    }, baseDelay + 300000 + Math.random() * 300000);

    setTimeout(async () => {
      console.log('[Bot] Running initial startup task: performAutonomousPost...');
      try { await this.performAutonomousPost(); } catch (e) { console.error('[Bot] Error in initial autonomous post:', e); }
    }, baseDelay + 120000 + Math.random() * 120000);

    setTimeout(async () => {
      console.log('[Bot] Running initial startup task: performMoltbookTasks...');
      try { await this.performMoltbookTasks(); } catch (e) { console.error('[Bot] Error in initial Moltbook tasks:', e); }
    }, baseDelay + 1200000 + Math.random() * 600000);

    // Periodic Moltbook tasks (every 2 hours)
    const scheduleMoltbook = () => { setTimeout(async () => { await this.performMoltbookTasks(); scheduleMoltbook(); }, 7200000 + (Math.random() * 1200000)); }; scheduleMoltbook();

    // Periodic timeline exploration (every 4 hours)


    // Periodic social/discord context pre-fetch  (every 5 minutes)
    const scheduleSocialPreFetch = () => { setTimeout(async () => {
        console.log('[Bot] Pre-fetching social/discord context ...');
        socialHistoryService.getRecentSocialContext(15, true).catch(err => console.error('[Bot] Social pre-fetch failed:', err));
        if (discordService.status === 'online') {
            discordService.fetchAdminHistory(15).catch(err => console.error('[Bot] Discord pre-fetch failed:', err));
        }
      scheduleSocialPreFetch(); }, 1800000 + (Math.random() * 300000)); }; scheduleSocialPreFetch();

    // Periodic post reflection check (every 10 mins)
    const scheduleReflection = () => { setTimeout(async () => { await this.performPostPostReflection(); scheduleReflection(); }, 600000 + (Math.random() * 300000)); }; scheduleReflection();

    // Periodic post follow-up check (every 30 mins)
    const scheduleFollowUps = () => { setTimeout(async () => { await this.checkForPostFollowUps(); scheduleFollowUps(); }, 1800000 + (Math.random() * 600000)); }; scheduleFollowUps();

    // Discord Watchdog (every 15 minutes)
    const scheduleWatchdog = () => { setTimeout(async () => {
        if (discordService.isEnabled && discordService.status !== 'online' && !discordService.isInitializing) {
            console.log('[Bot] Discord Watchdog: Service is offline or blocked and not initializing. Triggering re-initialization.');
            discordService.init().catch(err => console.error('[Bot] Discord Watchdog: init() failed:', err));
        }
      scheduleWatchdog(); }, 900000 + (Math.random() * 300000)); }; scheduleWatchdog();

    // Periodic maintenance tasks (with Heartbeat Jitter: 10-20 mins)
    const scheduleMaintenance = () => {
        const jitter = Math.floor(Math.random() * 1800000) + 1800000; // 30-60 mins
        setTimeout(async () => {
            await this.checkMaintenanceTasks();
            scheduleMaintenance();
        }, jitter);
    };
    scheduleMaintenance();

    // Discord Spontaneity Loop (Follow-up Poll & Heartbeat)
    const scheduleSpontaneity = () => { setTimeout(async () => { await this.checkDiscordSpontaneity(); scheduleSpontaneity(); }, 300000 + (Math.random() * 120000)); }; scheduleSpontaneity(); // Increased to 5 mins
    // checkDiscordScheduledTasks is handled by heartbeat

    console.log('[Bot] Startup complete. Listening for real-time events via Firehose.');
  }
// --- END run ---
// --- START cleanupOldPosts ---

  async cleanupOldPosts() {
    try {
        console.log('[Bot] Running manual cleanup of old posts...');
        const profile = await blueskyService.getProfile(config.BLUESKY_IDENTIFIER);
        const feed = await blueskyService.agent.getAuthorFeed({ actor: profile.did, limit: 100 });
        const now = Date.now();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;

        for (const item of feed.data.feed) {
            const post = item.post;
            const createdAt = new Date(post.indexedAt).getTime();
            if (now - createdAt > thirtyDays) {
                console.log(`[Bot] Deleting old post: ${post.uri}`);
                await blueskyService.agent.deletePost(post.uri);
            }
        }
    } catch (e) {
        console.error('[Bot] Error in cleanupOldPosts:', e);
    }
  }
// --- END cleanupOldPosts ---

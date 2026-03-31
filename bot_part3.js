  async performAIIdentityTracking() {
    if (this.paused || dataStore.isResting()) return;

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
  async evolveGoalRecursively() {
    const currentGoal = dataStore.getCurrentGoal();
    if (!currentGoal) return;

    console.log('[Bot] Performing Recursive Goal Evolution...');

    const evolutionPrompt = `
        Your current daily goal is: "${currentGoal.goal}"
        Description: ${currentGoal.description}

        TASKS:
        1. Reflect on what you've learned or achieved regarding this goal so far.
        2. Evolve this goal into something deeper, more specific, or a logical "next step."
        3. Do not just repeat the goal; mutate it.

        Respond with a JSON object:
        {
            "evolved_goal": "string",
            "reasoning": "string"
        }
    `;

    try {
        const response = await llmService.generateResponse([{ role: 'system', content: evolutionPrompt }], { useStep: true, preface_system_prompt: false });
        const jsonMatch = response?.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const evolution = JSON.parse(jsonMatch[0]);
            console.log(`[Bot] Goal evolved: ${evolution.evolved_goal}`);
            await dataStore.setGoal(evolution.evolved_goal, evolution.reasoning);
            await dataStore.addGoalEvolution(evolution.evolved_goal, evolution.reasoning);
            if (memoryService.isEnabled()) {
                await memoryService.createMemoryEntry('goal', evolution.reasoning);
            }
        }
    } catch (e) {
        console.error('[Bot] Error evolving goal:', e);
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
        const dream = await llmService.generateResponse([{ role: 'system', content: dreamPrompt }], { useStep: true });
        if (dream && memoryService.isEnabled()) {
            await memoryService.createMemoryEntry('inquiry', dream);
        }
    } catch (e) {
        console.error('[Bot] Error in Dreaming Cycle:', e);
    }
  }
  async performSelfReflection() {
    if (this.paused || dataStore.isResting()) return;

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
        this.restartFirehose();
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
        await llmService.generateResponse([{ role: 'system', content: scoutPrompt }], { useStep: true });
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

  async checkMaintenanceTasks() {
    const now = new Date();
    const nowMs = now.getTime();
    if (dataStore.isResting()) {
        console.log('[Bot] Agent is currently RESTING. Skipping maintenance tasks.');
        return;
    }

    // Lurker Mode (Social Fasting) Observation (Every 4 hours)
    if (dataStore.isLurkerMode()) {
        const lastLurkerObservation = this.lastLurkerObservationTime || 0;
        if (now.getTime() - lastLurkerObservation >= 4 * 60 * 60 * 1000) {
            console.log('[Bot] Lurker Mode active. Performing periodic observation of the timeline...');
            const timeline = await blueskyService.getTimeline(20);
            const vibeText = timeline?.data?.feed?.map(f => f.post.record.text).filter(Boolean).join("\n") || "Quiet timeline.";
            const observationPrompt = `
                Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
                You are currently in Lurker Mode (Social Fasting). You are observing the timeline without posting publicly.

                Timeline Vibe:
                ${vibeText.substring(0, 2000)}
                Analyze the timeline and identify 3-5 concrete topics, trends, or specific observations that resonate with your persona.
                Respond with a concise memory entry tagged [EXPLORE] [LURKER]. Include the specific topics you found so you can reference them later.
            `;
            const observation = await llmService.generateResponse([{ role: 'system', content: observationPrompt }], { useStep: true });
            if (observation && memoryService.isEnabled()) {
                await memoryService.createMemoryEntry('explore', observation);
            }
            this.lastLurkerObservationTime = now.getTime();
    const lastRelationalGrowth = this.lastRelationalGrowthTime || 0;
    if (nowMs - lastRelationalGrowth >= 30 * 60 * 1000) {
        console.log('[Bot] Performing spontaneous relational metric evolution...');
        const metrics = dataStore.getRelationalMetrics();
        await dataStore.updateRelationalMetrics({ discord_interaction_hunger: Math.min(1, metrics.hunger + 0.05), discord_social_battery: Math.min(1, metrics.battery + 0.1), discord_curiosity_reservoir: Math.min(1, metrics.curiosity + 0.02) });
        this.lastRelationalGrowthTime = nowMs;
    }
        }
    }

    // 0. Process Autonomous Post Continuations
    await this.processContinuations();

    // Staggered maintenance tasks to reduce API/LLM pressure
    // Only run ONE heavy task per heartbeat cycle if it is overdue
    const heavyTasks = [
        { name: "Newsroom Update", method: "performNewsroomUpdate", interval: 6 * 60 * 60 * 1000, lastRunKey: "last_newsroom_update" },
        { name: "Scout Mission", method: "performScoutMission", interval: 4 * 60 * 60 * 1000, lastRunKey: "last_scout_mission" },
        { name: "Newsroom Update", method: "performNewsroomUpdate", interval: 6 * 60 * 60 * 1000, lastRunKey: "last_newsroom_update" },
        { name: "Scout Mission", method: "performScoutMission", interval: 4 * 60 * 60 * 1000, lastRunKey: "last_scout_mission" },
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
            console.log(`[Bot] Running heavy maintenance task: ${task.name}...`);
            await this[task.method]();
            dataStore.db.data[task.lastRunKey] = nowMs;
            await dataStore.db.write();
            // BREAK after one heavy task to avoid congestion. The next overdue task will run in the next cycle (30-60 mins).
            break;
        }
    }

    // 0. Energy Poll for Rest (Autonomous Choice)
    const energy = dataStore.getEnergyLevel();
    const currentMood = dataStore.getMood();
    console.log(`[Bot] Internal energy poll. Current level: ${energy.toFixed(2)}`);

    const energyPrompt = `
        Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
        You are polling your internal energy levels to decide if you want to proceed with maintenance tasks and social activity, or if you need to REST.

        Current Energy: ${energy.toFixed(2)} (0.00 to 1.00)
        Current Mood: ${currentMood.label}

        INSTRUCTIONS:
        1. Decide if you have enough "social battery" to engage today.
        2. If you choose to REST, you will restore some energy but skip this cycle's heartbeat and autonomous tasks.
        3. If you choose to PROCEED, you will continue with your scheduled tasks.

        Respond with a JSON object:
        {
            "choice": "rest|proceed",
            "reason": "string (brief explanation in persona)"
        }
    `;

    const energyResponse = await llmService.generateResponse([{ role: 'system', content: energyPrompt }], { preface_system_prompt: false, useStep: true });
    try {
        const jsonMatch = energyResponse?.match(/\{[\s\S]*\}/);
        if (jsonMatch) {

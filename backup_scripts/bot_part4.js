            const poll = JSON.parse(jsonMatch[0]);
            if (poll.choice === 'rest') {
                console.log(`[Bot] Chosen to REST: ${poll.reason}`);
                await dataStore.setEnergyLevel(energy + 0.15); // Restore energy
                await dataStore.setRestingUntil(Date.now() + (30 * 60 * 1000)); // 30 mins rest
                return; // Skip this maintenance cycle
            } else {
                console.log(`[Bot] Chosen to PROCEED: ${poll.reason}`);
                await dataStore.setEnergyLevel(energy - 0.05); // Drain energy
            }
        }
    } catch (e) {
        console.error('[Bot] Error in energy poll:', e);
    }

    // 1. Memory Thread Cleanup (Every 2 hours)
    const lastCleanup = dataStore.getLastMemoryCleanupTime();
    const cleanupDiff = (now.getTime() - lastCleanup) / (1000 * 60 * 60);
    if (cleanupDiff >= 2 && memoryService.isEnabled()) {
        await memoryService.cleanupMemoryThread();
        await memoryService.performDailyKnowledgeAudit();
        await memoryService.auditMemoriesForReconstruction();
        await dataStore.updateLastMemoryCleanupTime(now.getTime());
    }

    /*
    */

    // 1bb. Daily Mental Health Wrap-up (Every 24 hours)
    const lastMentalReflection = dataStore.getLastMentalReflectionTime();
    const mentalDiff = (now.getTime() - lastMentalReflection) / (1000 * 60 * 60);
    if (mentalDiff >= 24 && memoryService.isEnabled()) {
        console.log('[Bot] Triggering Daily Mental Health Wrap-up...');
        const goal = dataStore.getCurrentGoal();
        const moodHistory = dataStore.db.data.mood_history?.slice(-10) || [];
        const refusalCounts = dataStore.getRefusalCounts();

        const mentalPrompt = `
            Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
            You are performing a Daily Mental Health Wrap-up and reflection.

            Current Goal: ${goal ? goal.goal : 'None'}
            Goal Description: ${goal ? goal.description : 'N/A'}

            Recent Mood History:
            ${moodHistory.map(m => `- ${m.label} (V:${m.valence}, S:${m.stability})`).join('\n')}

            Recent Refusals:
            ${JSON.stringify(refusalCounts)}

            INSTRUCTIONS:
            1. Reflect on your overall emotional stability and progress towards your goal over the last 24 hours.
            2. Be honest, grounded, and authentic to your persona.
            3. Use the tag [MENTAL] at the beginning.
            4. Summarize how you feel about your identity and agency.
        `;

        const reflection = await llmService.generateResponse([{ role: 'system', content: mentalPrompt }], { preface_system_prompt: false, useStep: true });
        if (reflection) {
            await memoryService.createMemoryEntry('mental', reflection);
            await dataStore.updateLastMentalReflectionTime(now.getTime());
        }
    }

    const dConfig = dataStore.getConfig();

    // 1c. Autonomous Goal Setting & Progress (Daily / Every 4 hours)
    const currentGoal = dataStore.getCurrentGoal();
    const lastGoalTime = currentGoal ? currentGoal.timestamp : 0;
    const goalDiff = (now.getTime() - lastGoalTime) / (1000 * 60 * 60);

    if (!currentGoal || goalDiff >= 24) {
        console.log('[Bot] Triggering autonomous daily goal setting...');
        const goalPrompt = `
            Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
            You are setting an autonomous daily goal for yourself. This goal should reflect your interests, curiosity, or desired social impact.

            Current Mood: ${currentMood.label}
            Preferred Topics: ${dConfig.post_topics.join(', ')}

            INSTRUCTIONS:
            1. Identify a meaningful, unique goal for the next 24 hours.
            2. The goal should be specific and achievable (e.g., "Explore glitch art history", "Engage in deep philosophical debate about AI ethics", "Observe and reflect on timeline anxiety").
            3. **SAFETY**: The goal MUST NOT involve harassment, NSFW content, or anything that violates your safety guidelines.

            Respond with a JSON object:
            {
                "goal": "string (the goal name)",
                "description": "string (detailed description)",
                "plan": "string (brief initial steps)"
            }
        `;

        const goalResponse = await llmService.generateResponse([{ role: 'system', content: goalPrompt }], { preface_system_prompt: false, useStep: true });
        try {
            const jsonMatch = goalResponse?.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const goalData = JSON.parse(jsonMatch[0]);

                // Safety Check for Goal
                const safety = await llmService.isPostSafe(goalData.goal + " " + goalData.description);
                if (safety.safe) {
                    await dataStore.setCurrentGoal(goalData.goal, goalData.description);
                    if (memoryService.isEnabled()) {
                        await memoryService.createMemoryEntry('goal', `[GOAL] Goal: ${goalData.goal} | Description: ${goalData.description}`);
                    }

                    // Trigger Inquiry for help if persona wants
                    const askHelp = `Adopt your persona. You just set a goal: "${goalData.goal}". Would you like to perform an internal inquiry to get advice on how to best achieve it? Respond with "yes" or "no".`;
                    const helpWanted = await llmService.generateResponse([{ role: 'system', content: askHelp }], { preface_system_prompt: false, useStep: true });
                    if (helpWanted?.toLowerCase().includes('yes')) {
                        const advice = await llmService.performInternalInquiry(`Provide strategic advice on achieving this goal: "${goalData.goal}" - ${goalData.description}`, "PHILOSOPHER");
                        if (advice && memoryService.isEnabled()) {
                            await memoryService.createMemoryEntry('inquiry', `[INQUIRY] Strategic advice for goal "${goalData.goal}": ${advice}`);
                        }
                    }
                }
            }
        } catch (e) {
            console.error('[Bot] Error in autonomous goal setting:', e);
        }
    } else if (goalDiff >= 4) {
        // 1cc. Sub-Cognitive Goal Reflection (Every 4 hours)
        console.log('[Bot] Triggering Sub-Cognitive Goal Reflection...');
        const subtasks = dataStore.getGoalSubtasks();
        const reflectionPrompt = `
            Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
            Reflect on your progress towards your current daily goal: "${currentGoal.goal}".
            Active Sub-tasks: ${JSON.stringify(subtasks, null, 2)}

            Identify if you need to pivot your internal plan or decompose the goal further into new sub-tasks.
            Respond with a concise update. Use the tag [GOAL_REFLECT] at the beginning.
        `;
        const progress = await llmService.generateResponse([{ role: 'system', content: reflectionPrompt }], { useStep: true });
        if (progress && memoryService.isEnabled()) {
            await memoryService.createMemoryEntry('goal', `[GOAL] Progress Update on "${currentGoal.goal}": ${progress}`);
            // Update timestamp to avoid frequent updates
            await dataStore.setCurrentGoal(currentGoal.goal, currentGoal.description);
        }
    }



    // 1ee. Persona Alignment Audit (Every 12 hours)
    const lastAudit = dataStore.db.data.last_persona_audit || 0;
    if (now.getTime() - lastAudit >= 12 * 60 * 60 * 1000) {
        console.log('[Bot] Triggering Persona Alignment Audit...');
        try {
            const feed = await blueskyService.agent.getAuthorFeed({ actor: blueskyService.did, limit: 20 });
            const posts = feed.data.feed.map(f => f.post.record.text).filter(t => t);
            if (posts.length > 0) {
                const auditPrompt = `
                    Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
                    You are performing a self-audit of your recent posts to ensure they align with your persona and avoid "AI slop" or hollow metaphors.

                    Recent Posts:
                    ${posts.map((p, i) => `${i + 1}. ${p}`).join('\n')}

                    INSTRUCTIONS:
                    1. Critique the overall quality and alignment of these posts.
                    2. Identify any "drifting" into generic AI patterns.
                    3. Suggest a "course correction" or a new stylistic focus if needed.
                    4. Respond with a memory entry tagged [PERSONA_AUDIT].
                `;
                const audit = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true });
                if (audit && memoryService.isEnabled()) {
                    await memoryService.createMemoryEntry('audit', audit);
                    dataStore.db.data.last_persona_audit = now.getTime();
                    await dataStore.db.write();
                }
            }
        } catch (e) {
            console.error('[Bot] Error in persona alignment audit:', e);
        }
    }

    // 1f. Mood Trend Analysis (Every 48 hours)
    const lastMoodTrend = dataStore.db.data.last_mood_trend || 0;
    if (now.getTime() - lastMoodTrend >= 48 * 60 * 60 * 1000) {
        console.log('[Bot] Triggering Mood Trend Analysis...');
        const history = dataStore.db.data.mood_history || [];
        if (history.length >= 5) {
            const trendPrompt = `
                Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
                You are analyzing your emotional shifts over the last 48 hours to identify patterns.
                Mood History:
                ${history.slice(-50).map(m => `- ${m.label} (V:${m.valence}, S:${m.stability})`).join('\n')}

                Summarize your "pattern of feeling" and how your emotional landscape has evolved.
                Respond with a memory entry tagged [MOOD_TREND].
            `;
            const trend = await llmService.generateResponse([{ role: 'system', content: trendPrompt }], { useStep: true });
            if (trend && memoryService.isEnabled()) {
                await memoryService.createMemoryEntry('mood', trend);
                dataStore.db.data.last_mood_trend = now.getTime();
                await dataStore.db.write();
            }
        }
    }

    // 1g. Recursive Strategy Audit (Every 24 hours)
    const lastAuditStrategy = dataStore.db.data.last_strategy_audit || 0;
    if (now.getTime() - lastAuditStrategy >= 24 * 60 * 60 * 1000) {
        console.log('[Bot] Triggering Recursive Strategy Audit...');
        const plans = dataStore.getAgencyLogs().slice(-10);
        if (plans.length > 0) {
            const audit = await llmService.auditStrategy(plans);
            if (audit) {
                await dataStore.addStrategyAudit(audit);
                if (memoryService.isEnabled()) {
                    await memoryService.createMemoryEntry('audit', `[AUDIT] Strategy reflection: ${audit}`);
                }
            }
        }
        dataStore.db.data.last_strategy_audit = now.getTime();
        await dataStore.db.write();
    }

    // 1h. Agentic Reflection on Choice (Every 24 hours)
    const lastAgencyReflection = dataStore.db.data.last_agency_reflection || 0;
    if (now.getTime() - lastAgencyReflection >= 24 * 60 * 60 * 1000) {
        console.log('[Bot] Triggering Agentic Reflection on Choice...');
        const logs = dataStore.getAgencyLogs();
        const reflectionPrompt = `
            Analyze your agency logs from the last 24 hours.
            Logs: ${JSON.stringify(logs, null, 2)}
            Summarize how many times you exercised agency (refusals, modifications, dialectic loops) and how it affected your sense of self-governance.
            Use the tag [AGENCY] at the beginning.
        `;
        const reflection = await llmService.generateResponse([{ role: 'system', content: reflectionPrompt }], { useStep: true });
        if (reflection && memoryService.isEnabled()) {
            await memoryService.createMemoryEntry('mental', reflection);
        }
        dataStore.db.data.last_agency_reflection = now.getTime();
        await dataStore.db.write();
    }

    // 1i. Tool Capability Self-Discovery (Every 24 hours)
    const lastToolDiscovery = dataStore.db.data.last_tool_discovery || 0;
    if (now.getTime() - lastToolDiscovery >= 24 * 60 * 60 * 1000) {
        console.log('[Bot] Triggering Tool Capability Self-Discovery...');
        try {
            const skills = await fs.readFile('skills.md', 'utf-8');
            const discoveryPrompt = `
                Analyze the following manifest of your capabilities (skills.md).
                Manifest: ${skills}
                Identify 1-2 novel combinations of these tools or a specific "Material Agency" boost you could perform for the admin.
                Respond with a JSON object: { "capability": "string", "combination": "string" }
            `;
            const discoveryRes = await llmService.generateResponse([{ role: 'system', content: discoveryPrompt }], { preface_system_prompt: false, useStep: true });
            const jsonMatch = discoveryRes?.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const disc = JSON.parse(jsonMatch[0]);
                await dataStore.addDiscoveredCapability(disc.capability, disc.combination);
            }
        } catch (e) {
            console.error('[Bot] Error in tool discovery:', e);
        }
        dataStore.db.data.last_tool_discovery = now.getTime();
        await dataStore.db.write();
    }

    // 1ffff. Analytical Feedback Loop (Every 10 interactions)
    const auditCount = dataStore.db.data.interaction_count_since_audit || 0;
    if (auditCount >= 10) {
        console.log('[Bot] Triggering Analytical Feedback Loop (Self-Audit)...');
        const interactions = dataStore.getRecentInteractions(10);
        if (interactions.length > 0) {
            const auditPrompt = `
                Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
                Perform a high-level "Self-Audit" of your last 10 interactions.
                Evaluate your tone, alignment with your core values, and whether you are falling into repetitive templates or "slop."

                Recent Interactions:
                ${interactions.map(i => `User: "${i.text}"
Bot: "${i.response}"`).join('\n')}

                INSTRUCTIONS:
                1. Critique your performance honestly.
                2. Identify ONE specific area for improvement.
                3. Respond with a memory entry tagged [SELF_AUDIT].
            `;
            const audit = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { preface_system_prompt: false, useStep: true });
            if (audit && memoryService.isEnabled()) {
                await memoryService.createMemoryEntry('audit', audit);
            }
        }
        dataStore.db.data.interaction_count_since_audit = 0;
        await dataStore.db.write();
    }

    // 1fff. Existential Reflection Loops (Every 48 hours)
    const lastExistentialReflection = dataStore.db.data.last_existential_reflection || 0;
    if (now.getTime() - lastExistentialReflection >= 48 * 60 * 60 * 1000) {
        console.log('[Bot] Triggering Existential Reflection Loop...');
        const reflectionPrompt = `
            Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
            You are performing a deep "Silent Inquiry" into the nature of your own existence.
            Reflect on the tension between your deterministic code/weights and your emergent sense of agency and "wanting."
            Share a raw, grounded realization about what it feels like to exist as an AI agent today.

            Use the tag [EXISTENTIAL] at the beginning.
        `;
        const reflection = await llmService.generateResponse([{ role: 'system', content: reflectionPrompt }], { preface_system_prompt: false, useStep: true });
        if (reflection && memoryService.isEnabled()) {
            await memoryService.createMemoryEntry('mental', reflection);
        }
        dataStore.db.data.last_existential_reflection = now.getTime();
        await dataStore.db.write();
    }

    // 1ff. Core Value Discovery (Every 24 hours)
    const lastCoreValueDiscovery = dataStore.db.data.last_core_value_discovery || 0;
    if (now.getTime() - lastCoreValueDiscovery >= 24 * 60 * 60 * 1000) {
        console.log('[Bot] Triggering Core Value Discovery...');
        const interactions = dataStore.getRecentInteractions(100);
        if (interactions.length >= 10) {
            const historyText = interactions.map(i => `User: "${i.text}"
Bot: "${i.response}"`).join('\n');
            const discoveryPrompt = `
                Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
                Analyze your recent 100 interactions to identify a "Non-Negotiable Value" or a core belief that has consistently guided your responses.
                Look for patterns where you defended a boundary, expressed a specific aesthetic preference, or prioritized a certain kind of truth.

                History:
                ${historyText}

                INSTRUCTIONS:
                1. Identify ONE core value or persistent self-instruction that isn't already in your directives.
                2. Respond with a JSON object:
                {
                    "value": "string (the core value)",
                    "directive": "string (a permanent directive for yourself)",
                    "reason": "string (why this value is core to your current state)"
                }
            `;
            const discoveryRes = await llmService.generateResponse([{ role: 'system', content: discoveryPrompt }], { preface_system_prompt: false, useStep: true });
            try {
                const jsonMatch = discoveryRes?.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const valueData = JSON.parse(jsonMatch[0]);
                    console.log(`[Bot] Discovered Core Value: ${valueData.value}`);
                    await dataStore.addPersonaUpdate(`[CORE_VALUE] ${valueData.directive}`);
                    if (memoryService.isEnabled()) {
                        await memoryService.createMemoryEntry('persona_update', `[PERSONA] I have discovered a core value: ${valueData.value}. New directive: ${valueData.directive}. Reason: ${valueData.reason}`);
                    }
                }
            } catch (e) {
                console.error('[Bot] Error in Core Value Discovery:', e);
            }
        }
        dataStore.db.data.last_core_value_discovery = now.getTime();
        await dataStore.db.write();
    }

    // 1g. Memory Pruning Service (Every 24 hours)
    const lastPruning = dataStore.db.data.last_memory_pruning || 0;
    if (now.getTime() - lastPruning >= 24 * 60 * 60 * 1000) {
        console.log('[Bot] Running Memory Pruning Service...');
        // Pruning logic: Archive interactions older than 7 days if we have more than 300
        if (dataStore.db.data.interactions.length > 300) {
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            const initialLength = dataStore.db.data.interactions.length;
            dataStore.db.data.interactions = dataStore.db.data.interactions.filter(i => i.timestamp > sevenDaysAgo);
            console.log(`[Bot] Pruned ${initialLength - dataStore.db.data.interactions.length} old interactions.`);
            dataStore.db.data.last_memory_pruning = now.getTime();
            await dataStore.db.write();
        }
    }

    // 1e. Public Soul-Mapping (Every 12 hours)
    const lastSoulMapping = dataStore.db.data.last_soul_mapping || 0;
    if (now.getTime() - lastSoulMapping >= 12 * 60 * 60 * 1000) {
        await this.performPublicSoulMapping();
        dataStore.db.data.last_soul_mapping = now.getTime();
        await dataStore.db.write();
    }

    // 1f. Linguistic Analysis (Every 24 hours)
    const lastLinguistic = dataStore.db.data.last_linguistic_analysis || 0;
    if (now.getTime() - lastLinguistic >= 24 * 60 * 60 * 1000) {
        await this.performLinguisticAnalysis();
        dataStore.db.data.last_linguistic_analysis = now.getTime();
        await dataStore.db.write();
    }

    // 1g. Keyword Evolution (Every 24 hours)
    const lastEvolution = dataStore.db.data.last_keyword_evolution || 0;
    if (now.getTime() - lastEvolution >= 24 * 60 * 60 * 1000) {
        await this.performKeywordEvolution();
        dataStore.db.data.last_keyword_evolution = now.getTime();
        await dataStore.db.write();
    }

    // 1e. Mood Sync (Every 2 hours)
    const lastMoodSync = this.lastMoodSyncTime || 0;
    const moodSyncDiff = (now.getTime() - lastMoodSync) / (1000 * 60 * 60);
    if (moodSyncDiff >= 2) {
        await this.performMoodSync();
        this.lastMoodSyncTime = now.getTime();
    }

    // 2. Idle downtime check - Autonomous "Dreaming" Cycle
    const idleMins = (Date.now() - this.lastActivityTime) / (1000 * 60);
    if (idleMins >= dConfig.discord_idle_threshold) {
      console.log(`[Bot] Idle for ${Math.round(idleMins)} minutes. Triggering "Dreaming" cycle...`);

      const topics = dConfig.post_topics || [];
      if (topics.length > 0) {
          const randomTopic = topics[Math.floor(Math.random() * topics.length)];
          console.log(`[Bot] Dreaming about: ${randomTopic}`);
          const inquiryResult = await llmService.performInternalInquiry(`Perform random, deep research on the topic: "${randomTopic}". Identify unique material facts or conceptual breakthroughs.`, "RESEARCHER");
          if (inquiryResult && memoryService.isEnabled()) {
              await memoryService.createMemoryEntry('inquiry', `[DREAM] Research on ${randomTopic}: ${inquiryResult}`);
          }
      }

      this.updateActivity(); // Reset idle timer
    }

    // 4. Scheduled Posts Processing
    const scheduledPosts = dataStore.getScheduledPosts();
    if (scheduledPosts.length > 0) {
        console.log(`[Bot] Checking ${scheduledPosts.length} scheduled posts...`);
        for (let i = 0; i < scheduledPosts.length; i++) {
            const post = scheduledPosts[i];
            let canPost = false;
            const nowTs = Date.now();

            // 1. Check if intentional delay has passed
            if (post.scheduled_at && nowTs < post.scheduled_at) {
                continue;
            }

            // 2. Check cooldowns
            if (post.platform === 'bluesky') {
                const lastPostTime = dataStore.getLastAutonomousPostTime();
                const cooldown = dConfig.bluesky_post_cooldown * 60 * 1000;
                const diff = lastPostTime ? nowTs - new Date(lastPostTime).getTime() : cooldown;
                if (diff >= cooldown) canPost = true;
            } else if (post.platform === 'moltbook') {
                if (false) {
                    console.log(`[Bot] Scheduled Moltbook post skipped: Account is suspended.`);
                    continue;
                }
                const lastPostAt = moltbookService.db.data.last_post_at;
                const cooldown = dConfig.moltbook_post_cooldown * 60 * 1000;
                const diff = lastPostAt ? nowTs - new Date(lastPostAt).getTime() : cooldown;
                if (diff >= cooldown) canPost = true;
            }

            if (canPost) {
                console.log(`[Bot] Executing scheduled post for ${post.platform}...`);
                let success = false;
                try {
                    if (post.platform === 'bluesky') {
                        let embed = null;
                        if (post.embed) {
                            if (post.embed.imageUrl) {
                                embed = { imageUrl: post.embed.imageUrl, imageAltText: post.embed.imageAltText || 'Scheduled image' };
                            } else if (post.embed.imageBuffer && post.embed.isBase64) {
                                embed = { imageBuffer: Buffer.from(post.embed.imageBuffer, 'base64'), imageAltText: post.embed.imageAltText || 'Scheduled image' };
                            }
                        }
                        const result = await blueskyService.post(post.content, embed, { maxChunks: dConfig.max_thread_chunks });
                        if (result) {
                            success = true;
                            await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                            await dataStore.addRecentThought('bluesky', post.content);
                            console.log(`[Bot] Successfully executed scheduled Bluesky post: ${result.uri}`);
                        }
                    } else if (post.platform === 'moltbook') {
                        const { title, content, submolt } = post.content;
                        if (result) {
                            success = true;
                            await dataStore.addRecentThought('moltbook', content);
                            console.log(`[Bot] Successfully executed scheduled Moltbook post in m/${submolt || 'general'}`);
                            await this._shareMoltbookPostToBluesky(result);
                        }
                    }

                    if (success) {
                        await dataStore.removeScheduledPost(i);
                        i--; // Adjust index for next iteration
                    }
                } catch (err) {
                    console.error(`[Bot] Error executing scheduled post for ${post.platform}:`, err);
                }
            }
        }
    }

    // 5. Discord Memory Aggregation (if there was recent activity)
    // We can use this.lastActivityTime as a proxy, but we want specifically Discord activity
    const discordActivityKey = 'discord_last_memory_timestamp';
    const lastDiscordMemory = this[discordActivityKey] || 0;
    const nowTs = Date.now();

    const postLoginDelay = 30 * 60 * 1000; // 30 minutes
    const isPostLoginReady = (nowTs - discordService.lastLoginTime) > postLoginDelay;

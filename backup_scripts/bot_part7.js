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

  async _getThreadHistory(uri) {
    try {
      const thread = await blueskyService.getDetailedThread(uri);
      if (!thread || !Array.isArray(thread)) return [];
      return thread.map(p => ({
        author: p.post.author.handle,
        role: p.post.author.did === blueskyService.agent?.session?.did ? "assistant" : "user",
        text: p.post.record.text,
        uri: p.post.uri
      }));
    } catch (e) {
      console.error('[Bot] Error fetching thread history:', e);
      return [];
    }
  }

  _detectInfiniteLoop(uri) {
    if (!this._notifHistory) this._notifHistory = [];
    const now = Date.now();
    this._notifHistory = this._notifHistory.filter(h => now - h.timestamp < 600000); // 10 min window
    const count = this._notifHistory.filter(h => h.uri === uri).length;
    if (count >= 3) {
      console.warn(`[Bot] Infinite loop detected for URI: ${uri}. Breaking.`);
      return true;
    }
    this._notifHistory.push({ uri, timestamp: now });
    return false;
  }
}

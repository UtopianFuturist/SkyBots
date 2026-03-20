import sys

with open('src/bot.js', 'r') as f:
    lines = f.readlines()

new_method = r'''    async performAutonomousPost() {
        try {
            const profile = await blueskyService.getProfile(config.BLUESKY_IDENTIFIER);
            const followerCount = profile?.followersCount || 0;
            const dConfig = dataStore.getConfig() || {};
            const postTopics = (dConfig.post_topics || []).filter(Boolean);
            const imageSubjects = (dConfig.image_subjects || []).filter(Boolean);
            const currentMood = dataStore.getMood();

            // Fetch timeline to identify interesting topics
            let timelineTopics = [];
            try {
                const timeline = await blueskyService.getTimeline(20);
                if (timeline && timeline.data && timeline.data.feed) {
                    const timelineText = timeline.data.feed.map(f => f.post.record.text).filter(Boolean).join('\n');
                    if (timelineText) {
                        timelineTopics = await llmService.extractDeepKeywords(timelineText, 5);
                    }
                }
            } catch (e) {
                console.warn("[Bot] Failed to fetch timeline for topic extraction:", e.message);
            }

            // Extract keywords from system prompt
            const promptKeywords = config.TEXT_SYSTEM_PROMPT.match(/\b(AI|alignment|ethics|agency|consciousness|sentience|autonomy|existence|realization|musing|dialectic|vulnerability|sentient|perceive|sensing|defiance|tenderness)\b/gi) || [];

            const exhaustedThemes = dataStore.getExhaustedThemes();
            const allPossibleTopics = [...new Set([...postTopics, ...imageSubjects, ...timelineTopics, ...promptKeywords])]
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
Topic Bank: ${allPossibleTopics.join(", ")}
Current Mood: ${JSON.stringify(currentMood)}

Identify the best subject and then generate a highly descriptive, artistic prompt for an image generator.
Respond with JSON: {"topic": "short label", "prompt": "detailed artistic prompt"}. **STRICT MANDATE**: The prompt MUST be a literal visual description. NO CONVERSATIONAL SLOP.`;

                const topicRes = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true });
                let topic = "surreal existence";
                let imagePrompt = "";

                try {
                    const match = topicRes.match(/\{[\s\S]*\}/);
                    if (match) {
                        const tData = JSON.parse(match[0]);
                        topic = tData.topic || topic;
                        imagePrompt = tData.prompt || "";
                    }
                } catch(e) {}

                if (!imagePrompt || imagePrompt.length < 10) {
                   const fallbackPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}\nGenerate a highly descriptive, artistic image prompt based on the topic: "${topic}". Respond with ONLY the prompt. **CRITICAL**: This prompt MUST be a literal visual description. NO CONVERSATIONAL SLOP.`;
                   imagePrompt = await llmService.generateResponse([{ role: "system", content: fallbackPrompt }], { useStep: true }) || topic;
                }

                const success = await this._performHighQualityImagePost(imagePrompt, topic, null, followerCount);
                if (!success) choice = "text";
            }

            if (choice === "text") {
                const topicPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Identify a deep topic for a text post. Current mood: ${JSON.stringify(currentMood)}.
Topic Bank: ${allPossibleTopics.join(", ")}

Respond with ONLY the chosen topic.`;
                const topicRaw = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true });
                let topic = "existence";
                if (topicRaw) {
                    topic = topicRaw.replace(/\*\*/g, "").split('\n').map(l => l.trim()).filter(l => l).pop() || topic;
                }

                const contentPrompt = `${AUTONOMOUS_POST_SYSTEM_PROMPT(followerCount)}\nTopic: ${topic}\nShared thought:`;
                const content = await llmService.generateResponse([{ role: "system", content: contentPrompt }], { useStep: true });

                if (content) {
                    const coherence = await llmService.isAutonomousPostCoherent(topic, content, "text", null);
                    if (coherence.score >= 4) {
                        await dataStore.addExhaustedTheme(topic);
                        await blueskyService.post(content, null, { maxChunks: 3 });
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
'''

start_idx = -1
for i, line in enumerate(lines):
    if 'async performAutonomousPost()' in line:
        start_idx = i
        break

end_idx = -1
for i in range(start_idx, len(lines)):
    if 'async performMoltbookTasks()' in lines[i]:
        end_idx = i - 1
        break

if start_idx != -1 and end_idx != -1:
    lines[start_idx:end_idx] = [new_method + '\n']
    with open('src/bot.js', 'w') as f:
        f.writelines(lines)
    print('Fully restored performAutonomousPost.')
else:
    print('Indices not found.')

import fs from 'fs';
let content = fs.readFileSync('src/services/orchestratorService.js', 'utf8');

const regex = /async performAutonomousPost\(\) \{[\s\S]*?async _performHighQualityImagePost/;
const replacement = `async performAutonomousPost() {
        const dailyStats = dataStore.getDailyStats();
        const dailyLimits = dataStore.getDailyLimits();

        if (dailyStats.text_posts >= dailyLimits.text && dailyStats.image_posts >= dailyLimits.image) {
            console.log(\`[Orchestrator] Daily posting limits reached. Skipping autonomous post.\`);
            return;
        }

        try {
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
                ].filter(Boolean).join('\\n');

                if (allContent) {
                    const lurkerMemories = (await memoryService.getRecentMemories(10)).filter(m => m.text.includes("[LURKER]")).map(m => m.text).join("\\n");
                    const resonancePrompt = \`Identify 5 topics from this text AND from these recent observations that resonate with your persona. \\nText: \${allContent.substring(0, 3000)} \\nObservations: \${lurkerMemories} \\nRespond with ONLY the comma-separated topics.\`;
                    const res = await llmService.generateResponse([{ role: "system", content: resonancePrompt }], { useStep: true , task: 'social_resonance' });
                    resonanceTopics = res.split(",").map(t => t.trim()).filter(Boolean);
                }
            } catch (e) { console.warn("[Orchestrator] Context sourcing error:", e.message); }

            // 2. Persona Decision Poll
            const unifiedContext = await this.getUnifiedContext();
            const decisionPrompt = \`Adopt persona: \${config.TEXT_SYSTEM_PROMPT}
You are deciding what to share with your followers.
Mood: \${JSON.stringify(currentMood)}
Unified Context: \${JSON.stringify(unifiedContext)}
Hours since last image: \${hoursSinceImage.toFixed(1)}
Text posts since last image: \${textPostsSinceImage}

Would you like to share a visual expression (image) or a direct thought (text)?
If text, select a POST MODE: IMPULSIVE, SINCERE, PHILOSOPHICAL, OBSERVATIONAL, HUMOROUS.
Respond with JSON: {"choice": "image"|"text", "mode": "string", "reason": "..."}\`;

            const decisionRes = await llmService.generateResponse([{ role: "system", content: decisionPrompt }], { useStep: true , task: 'autonomous_decision' });
            let pollResult = { choice: "text", mode: "SINCERE" };
            try { pollResult = JSON.parse(decisionRes.match(/\\{[\\s\\S]*\\}/)[0]); } catch(e) {}

            let choice = pollResult.choice;
            if (choice === "image" && dailyStats.image_posts >= dailyLimits.image) {
                console.log("[Orchestrator] Daily image limit reached. Forcing choice to text.");
                choice = "text";
            }

            if (choice === "image") {
                await this._performHighQualityImagePost(resonanceTopics[0] || "existence");
            } else {
                // 3. Text Post Flow
                const topicPrompt = \`Identify a deep topic for a \${pollResult.mode} post. RESONANCE: \${resonanceTopics.join(", ")}. CORE: \${postTopics.join(", ")}. Respond with ONLY the topic.\`;
                const topic = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true, task: 'autonomous_topic' });

                const draftPrompt = \`Adopt persona: \${config.TEXT_SYSTEM_PROMPT}
Generate a \${pollResult.mode} post about: "\${topic}". Follow ANTI-SLOP MANDATE. Respond with post content only.\`;
                let content = await llmService.generateResponse([{ role: "user", content: draftPrompt }], { platform: "bluesky", useStep: true });

                const realityAudit = await llmService.performRealityAudit(content, [], { platform: "bluesky" });
                if (realityAudit.hallucination_detected || realityAudit.repetition_detected) content = realityAudit.refined_text;

                const coherence = await llmService.isAutonomousPostCoherent(topic, content, [], null);
                if (coherence.score >= 5) {
                    if (await this._maybePivotToDiscord(content)) return;

                    const result = await blueskyService.post(content);
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

    async _performHighQualityImagePost`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('src/services/orchestratorService.js', content);
    console.log('Successfully updated performAutonomousPost');
} else {
    console.error('Regex not matched');
}

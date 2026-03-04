import sys

file_path = "src/bot.js"
with open(file_path, "r") as f:
    content = f.read()

# 1. Define executeAction
executor_code = """  async executeAction(action, context = {}) {
    const { isAdmin = false, platform = 'unknown', notif = null, currentMood = {}, threadContext = [] } = context;
    let actionFeedback = null;
    let searchContext = '';

    console.log(`[Bot] Executing tool: ${action.tool}`);

    try {
        if (action.tool === 'image_gen') {
          console.log(`[Bot] Plan: Generating image for prompt: "${action.query}"`);
          const imageResult = await imageService.generateImage(action.query, { allowPortraits: true, mood: currentMood });
          if (imageResult && imageResult.buffer) {
            // Visual Persona Alignment check for tool-triggered images
            const imageAnalysis = await llmService.analyzeImage(imageResult.buffer);
            const imagePersonaCheck = await llmService.isPersonaAligned(`(Generated Image for: ${action.query})`, platform, {
                imageSource: imageResult.buffer,
                generationPrompt: imageResult.finalPrompt,
                imageAnalysis: imageAnalysis
            });

            if (!imagePersonaCheck.aligned) {
                console.log(`[Bot] Tool image failed persona check: ${imagePersonaCheck.feedback}`);
                return { feedback: `IMAGE_REJECTED: ${imagePersonaCheck.feedback}`, stop: true };
            }

            if (notif && platform === 'bluesky') {
                await blueskyService.postReply(notif, `Generated image: "${imageResult.finalPrompt}"`, {
                  imageBuffer: imageResult.buffer,
                  imageAltText: imageResult.finalPrompt
                });
            } else if (platform === 'discord') {
                // Find channel from context or use spontaneous
                await discordService.sendSpontaneousMessage(`Generated image: "${imageResult.finalPrompt}"`, {
                    files: [{ attachment: imageResult.buffer, name: 'generated.jpg' }]
                });
            } else {
                await blueskyService.post(`Generated image: "${imageResult.finalPrompt}"`, {
                    imageBuffer: imageResult.buffer,
                    imageAltText: imageResult.finalPrompt
                });
            }
            return { feedback: `[Image generated: ${imageResult.finalPrompt}]`, imageFulfilled: true };
          } else {
            return { feedback: "IMAGE_GENERATION_FAILED: The image generation API returned an error or blocked the prompt." };
          }
        }

        if (action.tool === 'persist_directive' && isAdmin) {
          const { platform: targetPlatform, instruction } = action.parameters || {};
          if (targetPlatform === 'moltbook') {
              await moltbookService.addAdminInstruction(instruction);
          } else {
              await dataStore.addBlueskyInstruction(instruction);
          }
          if (memoryService.isEnabled()) {
              await memoryService.createMemoryEntry('directive_update', `Platform: ${targetPlatform || 'bluesky'}. Instruction: ${instruction}`);
          }
          return { searchContext: `\\n[Directive updated: "${instruction}" for ${targetPlatform || 'bluesky'}]` };
        }

        if (action.tool === 'update_persona') {
            const { instruction } = action.parameters || {};
            if (instruction) {
                await dataStore.addPersonaUpdate(instruction);
                if (memoryService.isEnabled()) {
                    await memoryService.createMemoryEntry('persona_update', instruction);
                }
                return { searchContext: `\\n[Persona evolved: "${instruction}"]` };
            }
        }

        if (action.tool === 'set_relationship' && isAdmin) {
            const mode = action.parameters?.mode;
            if (mode) {
                await dataStore.setDiscordRelationshipMode(mode);
                return { searchContext: `\\n[Discord relationship mode set to ${mode}]` };
            }
        }

        if (action.tool === 'set_schedule' && isAdmin) {
            const times = action.parameters?.times;
            if (Array.isArray(times)) {
                await dataStore.setDiscordScheduledTimes(times);
                return { searchContext: `\\n[Discord spontaneous schedule set to: ${times.join(', ')}]` };
            }
        }

        if (action.tool === 'set_quiet_hours' && isAdmin) {
            const { start, end } = action.parameters || {};
            if (start !== undefined && end !== undefined) {
                await dataStore.setDiscordQuietHours(start, end);
                return { searchContext: `\\n[Discord quiet hours set to ${start}:00 - ${end}:00]` };
            }
        }

        if (action.tool === 'set_scheduled_task') {
            const { time, message, date, action: scheduledAction } = action.parameters || {};
            if (time && (message || scheduledAction)) {
                const targetDate = date || new Date().toISOString().split('T')[0];
                const task = { time, message, date: targetDate, action: scheduledAction };
                await dataStore.addDiscordScheduledTask(task);
                if (memoryService.isEnabled()) {
                    await memoryService.createMemoryEntry('goal', `[SCHEDULE] I have scheduled a task for ${targetDate} at ${time}: ${JSON.stringify(task)}`);
                }
                return { searchContext: `\\n[Scheduled task added for ${targetDate} at ${time}]` };
            }
        }

        if (action.tool === 'update_config' && isAdmin) {
            const { key, value } = action.parameters || {};
            if (key) {
                const success = await dataStore.updateConfig(key, value);
                return { searchContext: `\\n[Configuration update for ${key}: ${success ? 'SUCCESS' : 'FAILED'}]` };
            }
        }

        if (action.tool === 'update_mood') {
            const { valence, arousal, stability, label } = action.parameters || {};
            if (label) {
                await dataStore.updateMood({ valence, arousal, stability, label });
                if (memoryService.isEnabled()) {
                    await memoryService.createMemoryEntry('mood', `[MOOD] My mood has shifted to: ${label} (Valence: ${valence}, Arousal: ${arousal}, Stability: ${stability})`);
                }
                return { searchContext: `\\n[Internal mood updated to: ${label}]` };
            }
        }

        if (['bsky_follow', 'bsky_unfollow', 'bsky_mute', 'bsky_unmute'].includes(action.tool) && isAdmin) {
                const target = action.parameters?.handle || action.query;
                if (target) {
                    if (action.tool === 'bsky_follow') await blueskyService.follow(target);
                    if (action.tool === 'bsky_unfollow') await blueskyService.unfollow(target);
                    if (action.tool === 'bsky_mute') await blueskyService.mute(target);
                    if (action.tool === 'bsky_unmute') await blueskyService.unmute(target);
                    return { searchContext: `\\n[Social action ${action.tool} performed on ${target}]` };
                }
        }

        if (action.tool === 'read_link') {
            const urls = action.parameters?.urls || (action.query ? [action.query] : []);
            if (urls.length > 0) {
                let content = '';
                for (const url of urls) {
                    const safety = await llmService.isUrlSafe(url);
                    if (safety.safe) {
                        const pageContent = await webReaderService.fetchContent(url);
                        if (pageContent) {
                            content += `\\n[Content from ${url}]: ${pageContent.substring(0, 1500)}`;
                        }
                    }
                }
                return { searchContext: content || '\\n[No readable content found or links unsafe]' };
            }
        }

        if (action.tool === 'search') {
            const query = action.query || action.parameters?.query;
            if (query) {
                const results = await googleSearchService.search(query);
                const resultsText = results.slice(0, 5).map(r => `[Search: ${r.title}]: ${r.snippet}`).join('\\n');
                return { searchContext: `\\n--- SEARCH RESULTS FOR "${query}" ---\\n${resultsText || 'No results found.'}\\n---` };
            }
        }

        if (action.tool === 'internal_inquiry') {
            const query = action.query || action.parameters?.query;
            const role = action.parameters?.role || 'RESEARCHER';
            if (query) {
                const result = await llmService.performInternalInquiry(query, role);
                if (result && memoryService.isEnabled()) {
                    await memoryService.createMemoryEntry('inquiry', `[INQUIRY] Query: ${query}. Result: ${result}`);
                }
                return { searchContext: `\\n[INTERNAL INQUIRY: ${result}]` };
            }
        }

        if (action.tool === 'bsky_post') {
            const topic = action.parameters?.topic || action.query;
            if (topic) {
                // This is a bit recursive if called from autonomousPost but useful for scheduling
                // For now, let's just log it or trigger a simplified version
                console.log(`[Bot] Executing scheduled bsky_post for topic: ${topic}`);
                // Implementation would go here
                return { searchContext: `\\n[Standalone post requested for topic: ${topic}]` };
            }
        }

        // Add other tools...

    } catch (e) {
        console.error(`[Bot] Error executing action ${action.tool}:`, e);
        return { feedback: `TOOL_ERROR (${action.tool}): ${e.message}` };
    }

    return {};
  }
"""

# Insert executeAction before checkDiscordScheduledTasks
content = content.replace("  async checkDiscordScheduledTasks() {", executor_code + "\n  async checkDiscordScheduledTasks() {")

with open(file_path, "w") as f:
    f.write(content)

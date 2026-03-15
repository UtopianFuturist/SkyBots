import re

with open('src/bot.js', 'r') as f:
    content = f.read()

# Improved executeAction
new_execute_action_code = """  async executeAction(action, context) {
      if (!action) return;

      // Harden parameter extraction
      const params = action.parameters || action.arguments || (typeof action.query === 'object' ? action.query : {});
      const query = typeof action.query === 'string' ? action.query : (params.query || params.text || params.instruction);

      try {
          if (action.tool === 'search_internal_logs') {
              const logs = dataStore.searchInternalLogs(query);
              return logs.length > 0 ? JSON.stringify(logs, null, 2) : "No logs found.";
          }

          if (action.tool === 'check_internal_state') {
              const currentGoal = dataStore.getCurrentGoal();
              const mood = dataStore.getMood();
              const metrics = dataStore.getRelationalMetrics();
              const memories = await memoryService.getRecentMemories(20);
              return JSON.stringify({
                  current_goal: currentGoal,
                  current_mood: mood,
                  relational_metrics: metrics,
                  recent_memories: memories.slice(-5)
              }, null, 2);
          }

          if (action.tool === 'update_mood') {
              const { valence, arousal, stability, label } = params;
              await dataStore.setMood({
                  valence: valence !== undefined ? parseFloat(valence) : undefined,
                  arousal: arousal !== undefined ? parseFloat(arousal) : undefined,
                  stability: stability !== undefined ? parseFloat(stability) : undefined,
                  label: label || undefined
              });
              return `Mood updated to ${label || 'new state'}.`;
          }

          if (action.tool === 'set_goal') {
              const { goal, description } = params;
              const finalGoal = goal || query;
              if (finalGoal) {
                  await dataStore.setCurrentGoal(finalGoal, description || finalGoal);
                  if (memoryService.isEnabled()) {
                      await memoryService.createMemoryEntry('goal', `[GOAL] Goal: ${finalGoal}`);
                  }
                  return `Goal set: ${finalGoal}`;
              }
              return "Goal name missing.";
          }

          if (action.tool === 'image_gen') {
              const prompt = query || params.prompt;
              if (prompt) {
                  const res = await imageService.generateImage(prompt, { allowPortraits: true });
                  if (res?.buffer) {
                      const visionAnalysis = await llmService.analyzeImage(res.buffer, prompt);
                      const captionPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}\\nVision Analysis: "${visionAnalysis}"\\nTopic: "${prompt}"\\nGenerate a short, persona-aligned caption for this image.`;
                      const caption = await llmService.generateResponse([{ role: 'system', content: captionPrompt }], { useStep: true });

                      const blobRes = await blueskyService.uploadBlob(res.buffer, 'image/jpeg');
                      if (blobRes?.data?.blob) {
                          const embed = { $type: 'app.bsky.embed.images', images: [{ image: blobRes.data.blob, alt: prompt }] };
                          let result;
                          if (context?.uri) {
                              result = await blueskyService.postReply(context, caption || "Generated Image", { embed });
                          } else {
                              result = await blueskyService.post(caption || "Generated Image", embed);
                          }
                          if (result) {
                              await blueskyService.postReply(result, `Generation Prompt: ${prompt}`);
                          }
                          return `[Successfully generated and posted image for prompt: "${prompt}"]`;
                      }
                  }
              }
              return "[Failed to generate image]";
          }

          if (action.tool === 'bsky_post') {
              const text = params.text || query;
              if (text) {
                  let embed = null;
                  const imgPrompt = params.prompt_for_image;
                  if (imgPrompt) {
                      const res = await imageService.generateImage(imgPrompt);
                      if (res?.buffer) {
                          const blob = await blueskyService.uploadBlob(res.buffer, 'image/jpeg');
                          if (blob?.data?.blob) {
                              embed = { $type: 'app.bsky.embed.images', images: [{ image: blob.data.blob, alt: imgPrompt }] };
                          }
                      }
                  }

                  let result;
                  if (context?.uri) {
                      result = await blueskyService.postReply(context, text, { embed });
                  } else {
                      result = await blueskyService.post(text, embed);
                  }

                  if (result && imgPrompt) {
                      await blueskyService.postReply(result, `Generation Prompt: ${imgPrompt}`);
                  }
                  return result ? `Posted to Bluesky: ${result.uri}` : "Failed to post.";
              }
              return "Post text missing.";
          }

          if (action.tool === 'update_persona') {
              const instruction = params.instruction || query;
              if (instruction) {
                  await dataStore.addPersonaUpdate(instruction);
                  if (memoryService.isEnabled()) {
                      await memoryService.createMemoryEntry('persona_update', instruction);
                  }
                  return "Persona updated.";
              }
          }

          // Fallback for existing search tools
          if (action.tool === 'google_search' || action.tool === 'search') {
              return await googleSearchService.search(query);
          }
          if (action.tool === 'wikipedia') {
              return await wikipediaService.search(query);
          }
          if (action.tool === 'youtube') {
              return await youtubeService.search(query);
          }
          if (action.tool === 'read_link') {
              const urls = params.urls || [query];
              const results = [];
              for (const url of urls) {
                  if (typeof url === 'string' && url.startsWith('http')) {
                      const summary = await webReaderService.fetchContent(url);
                      results.push(`Summary of ${url}: ${summary}`);
                  }
              }
              return results.join('\\n\\n') || "No valid URLs found.";
          }

      } catch (e) {
          console.error('[Bot] Error in executeAction:', e);
          return `Error: ${e.message}`;
      }
  }"""

# Surgical replacement of executeAction
pattern = r'async executeAction\(action, context\) \{.*?\}\n  \n  async cleanupOldPosts'
content = re.sub(pattern, new_execute_action_code + "\n  \n  async cleanupOldPosts", content, flags=re.DOTALL)

with open('src/bot.js', 'w') as f:
    f.write(content)

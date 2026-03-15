import re

with open('src/bot.js', 'r') as f:
    content = f.read()

# Helper to find a tool block
def find_tool_block(tool_name, content):
    pattern = rf"if \(action\.tool === '{tool_name}'\) \{{.*?\n\s+\}}"
    match = re.search(pattern, content, re.DOTALL)
    return match

# We'll replace the whole executeAction method for robustness
new_execute_action = """  async executeAction(action, context) {
      if (!action) return;
      const params = action.parameters || action.arguments || action.query || {};
      const query = typeof params === 'string' ? params : (params.query || params.text || params.instruction || action.query);

      try {
          if (action.tool === 'search_internal_logs') {
              console.log('[Bot] search_internal_logs called with query:', query);
              const logs = dataStore.searchInternalLogs(query);
              return logs.length > 0 ? JSON.stringify(logs, null, 2) : "No logs matching query found.";
          }

          if (action.tool === 'search_tools') {
              return "To see tool schemas, please consult the SKILLS.md file in the repository.";
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
                  recent_exploration_memories: memories.filter(m => m.text.includes('[EXPLORE]')).slice(-5),
                  recent_goal_memories: memories.filter(m => m.text.includes('[GOAL]')).slice(-5)
              }, null, 2);
          }

          if (action.tool === 'update_mood') {
              const { valence, arousal, stability, label } = params;
              await dataStore.setMood({
                  valence: valence !== undefined ? valence : undefined,
                  arousal: arousal !== undefined ? arousal : undefined,
                  stability: stability !== undefined ? stability : undefined,
                  label: label || undefined
              });
              return `Mood updated to: ${label || 'new state'}`;
          }

          if (action.tool === 'image_gen') {
              const imagePrompt = query;
              if (imagePrompt) {
                  const res = await imageService.generateImage(imagePrompt, { allowPortraits: true });
                  if (res?.buffer) {
                      const visionAnalysis = await llmService.analyzeImage(res.buffer, imagePrompt);
                      const captionPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}\\nVision Analysis of result: "${visionAnalysis}"\\nTopic: "${imagePrompt}"\\nGenerate a short, persona-aligned caption for this image.`;
                      const caption = await llmService.generateResponse([{ role: 'system', content: captionPrompt }], { useStep: true });

                      const blobRes = await blueskyService.uploadBlob(res.buffer, 'image/jpeg');
                      if (blobRes?.data?.blob) {
                          const embed = { $type: 'app.bsky.embed.images', images: [{ image: blobRes.data.blob, alt: imagePrompt }] };
                          if (context?.uri) {
                              await blueskyService.postReply(context, caption || "Generated Image", { embed });
                          } else {
                              await blueskyService.post(caption || "Generated Image", embed);
                          }
                          return `[Successfully generated and posted image for prompt: "${imagePrompt}"]`;
                      }
                  }
              }
              // Fallback to autonomous if no prompt but still rerouting
              this.performAutonomousPost();
              return "[Rerouted to autonomous post flow]";
          }

          if (action.tool === 'read_link') {
              const urls = params.urls || (typeof query === 'string' && query.startsWith('http') ? [query] : []);
              if (urls.length > 0) {
                  const results = [];
                  for (const url of urls) {
                      const summary = await webReaderService.fetchContent(url);
                      results.push(`Summary of ${url}: ${summary}`);
                  }
                  return results.join('\\n\\n');
              }
              return "No URLs provided.";
          }

          if (action.tool === 'google_search' || action.tool === 'search') {
              const searchCount = dataStore.db.data.daily_search_count || 0;
              if (searchCount >= 100) return "Search limit reached.";
              const res = await googleSearchService.search(query);
              await dataStore.updateConfig('daily_search_count', searchCount + 1);
              return res;
          }

          if (action.tool === 'set_goal') {
              const { goal, description } = params;
              if (goal) {
                  await dataStore.setCurrentGoal(goal, description);
                  if (memoryService.isEnabled()) {
                      await memoryService.createMemoryEntry('goal', `[GOAL] Goal: ${goal} | Description: ${description || goal}`);
                  }
                  return `Goal set: ${goal}`;
              }
              return "Goal name missing.";
          }

          if (action.tool === 'update_persona') {
              const instruction = query;
              if (instruction) {
                  await dataStore.addPersonaUpdate(instruction);
                  if (memoryService.isEnabled()) {
                      await memoryService.createMemoryEntry('persona_update', instruction);
                  }
                  return "Persona updated.";
              }
              return "Instruction missing.";
          }

          if (action.tool === 'bsky_post') {
              const text = query || params.text;
              if (text) {
                  let embed = null;
                  if (params.prompt_for_image) {
                      const res = await imageService.generateImage(params.prompt_for_image);
                      if (res?.buffer) {
                          const blob = await blueskyService.uploadBlob(res.buffer, 'image/jpeg');
                          if (blob?.data?.blob) {
                              embed = { $type: 'app.bsky.embed.images', images: [{ image: blob.data.blob, alt: params.prompt_for_image }] };
                          }
                      }
                  }

                  let result;
                  if (context?.uri) {
                      result = await blueskyService.postReply(context, text, { embed });
                  } else {
                      result = await blueskyService.post(text, embed);
                  }
                  return result ? `Posted to Bluesky: ${result.uri}` : "Failed to post.";
              }
              return "Post text missing.";
          }

          // Add default fallback for other tools if needed
          console.log(`[Bot] executeAction: tool '${action.tool}' not handled or implemented.`);

      } catch (e) {
          console.error('[Bot] Error in executeAction:', e);
          return `Error executing tool ${action.tool}: ${e.message}`;
      }
  }"""

# Use regex to replace the entire executeAction method
content = re.sub(r'async executeAction\(action, context\) \{.*?\}\n  \n  async cleanupOldPosts', new_execute_action + "\n  \n  async cleanupOldPosts", content, flags=re.DOTALL)

with open('src/bot.js', 'w') as f:
    f.write(content)

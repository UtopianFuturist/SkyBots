                break;
            } else {
                lastFeedback = attemptFeedback.join(" | ");
            }
        }

        if (messages.length > 0) {
            for (const msg of messages) {
                await discordService.sendSpontaneousMessage(msg);
                if (messages.length > 1) await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
            }
            dataStore.db.data.discord_last_interaction = now;
            await dataStore.db.write();
            await dataStore.addInternalLog("discord_spontaneous", { count: messages.length, content: messages, reason: triggerReason });
        }
    } catch (e) {
        console.error("[Bot] Error in checkDiscordSpontaneity:", e);
    }
  }

  async processNotification(notif) {
    if (this._detectInfiniteLoop(notif.uri)) return;
    const isSelf = !!notif.author.did && notif.author.did === blueskyService.agent?.session?.did;
    const history = await this._getThreadHistory(notif.uri);

    if (isSelf) {
        // Allow self-replies only for specific expansion/analytical intents
        const prePlan = await llmService.performPrePlanning(notif.record.text || "", history, null, "bluesky", dataStore.getMood(), {});
        const selfAuditIntents = ["informational", "analytical", "critical_analysis"];
        if (!selfAuditIntents.includes(prePlan.intent)) {
            console.log("[Bot] processNotification: Ignoring self-notification to prevent generic self-talk loops.");
            return;
        }
    }
    const boundaryCheck = checkHardCodedBoundaries(notif.record.text || "");
    if (boundaryCheck.blocked) {
        console.log(`[Bot] BOUNDARY VIOLATION DETECTED in notification: ${boundaryCheck.reason} ("${boundaryCheck.pattern}") from ${notif.author.handle}`);
        await dataStore.setBoundaryLockout(notif.author.did, 30);
        return;
    }

    if (dataStore.isUserLockedOut(notif.author.did)) {
        console.log(`[Bot] User ${notif.author.handle} is currently LOCKED OUT. Ignoring notification.`);
        return;
    }

    try {

      const handle = notif.author.handle;
      const text = notif.record.text || '';

      if (dataStore.db?.data) {
          dataStore.db.data.last_notification_processed_at = Date.now();
          await dataStore.db.write();
      }

      console.log(`[Bot] Processing notification from @${handle}: ${text.substring(0, 50)}...`);

      const isAdmin = handle === config.ADMIN_BLUESKY_HANDLE;

      const prePlan = await llmService.performPrePlanning(text, history, null, 'bluesky', dataStore.getMood(), {});
      const memories = memoryService.isEnabled() ? await memoryService.getRecentMemories(20) : [];
      let plan = await llmService.performAgenticPlanning(text, history, null, isAdmin, 'bluesky', dataStore.getExhaustedThemes(), {}, {}, {}, {}, null, prePlan, { memories });
      // Re-integrate evaluateAndRefinePlan
      const evaluation = await llmService.evaluateAndRefinePlan(plan, { platform: 'bluesky', isAdmin });
      if (evaluation.refined_actions && evaluation.refined_actions.length > 0) {
          plan.actions = evaluation.refined_actions;
      } else if (evaluation.decision === 'proceed') {
          plan.actions = evaluation.refined_actions || plan.actions;
      } else {
          console.log('[Bot] Agentic plan rejected by evaluation.');
          return;
      }

      if (plan.actions && plan.actions.length > 0) {
        for (const action of plan.actions) {
          await this.executeAction(action, { ...notif, platform: 'bluesky' });
        }
      }
    } catch (error) {
      console.error(`[Bot] Error processing notification ${notif.uri}:`, error);
    }
  }

  async checkDiscordScheduledTasks() {
    if (this.paused || dataStore.isResting()) return;
    if (discordService.status !== 'online') return;

    const tasks = dataStore.getDiscordScheduledTasks();
    if (tasks.length === 0) return;

    const now = new Date();
    const currentTimeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const today = now.toDateString();

    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const taskDate = new Date(task.timestamp).toDateString();
        if (taskDate !== today) {
            await dataStore.removeDiscordScheduledTask(i);
            i--;
            continue;
        }

        if (currentTimeStr === task.time) {
            console.log(`[Bot] Executing scheduled Discord task for ${task.time}: ${task.message}`);
            try {
                if (task.channelId) {
                    const channel = await discordService.client.channels.fetch(task.channelId.replace('dm_', '')).catch(() => null);
                    if (channel) {
                        await discordService._send(channel, task.message);
                    } else {
                        await discordService.sendSpontaneousMessage(task.message);
                    }
                } else {
                    await discordService.sendSpontaneousMessage(task.message);
                }
                await dataStore.removeDiscordScheduledTask(i);
                i--;
            } catch (e) {
                console.error('[Bot] Error executing scheduled Discord task:', e);
            }
        }
    }
  }

  async executeAction(action, context) {
      if (!action) return { success: false, reason: "No action" };

      const params = action.parameters || action.arguments || (typeof action.query === 'object' ? action.query : {});
      let query = typeof action.query === 'string' ? action.query : (params.query || params.text || params.instruction);

      try {
          // --- Editor Gate for Posts ---
          if (['bsky_post', 'discord_message'].includes(action.tool)) {
              let textToEdit = params.text || params.message || query;
              if (textToEdit) {
                  const edit = await llmService.performEditorReview(textToEdit, context?.platform || 'bluesky');
                  if (edit.decision === 'retry') {
                      console.log('[Bot] Editor requested retry:', edit.criticism);
                      await dataStore.addSessionLesson(`Editor rejected ${action.tool} for: ${edit.criticism}`);
                      textToEdit = edit.refined_text;
                  } else {
                      textToEdit = edit.refined_text;
                  }
                  if (params.text) params.text = textToEdit;
                  if (params.message) params.message = textToEdit;
                  query = textToEdit;
              }
          }

          if (action.tool === 'image_gen') {
              const prompt = query || params.prompt;
              if (prompt) {
                  const result = await this._generateVerifiedImagePost(prompt, {
                      initialPrompt: prompt,
                      platform: context?.platform || (context?.channelId ? 'discord' : 'bluesky'),
                      allowPortraits: true
                  });
                  if (result) {
                      if (context?.platform === 'discord' || context?.channelId) {
                          const channelId = (context?.channelId || config.DISCORD_ADMIN_CHANNEL_ID).toString().replace('dm_', '');
                          await discordService._send({ id: channelId }, `${result.caption}\n\nGeneration Prompt: ${result.finalPrompt}`, { files: [{ attachment: result.buffer, name: 'generated.jpg' }] });
                          return { success: true, data: result.finalPrompt };
                      } else {
                          const blobRes = await blueskyService.uploadBlob(result.buffer, 'image/jpeg');
                          if (blobRes?.data?.blob) {
                              const embed = { $type: 'app.bsky.embed.images', images: [{ image: blobRes.data.blob, alt: result.altText }] };
                              let postRes;
                              if (context?.uri) {
                                  postRes = await blueskyService.postReply(context, result.caption, { embed });
                              } else {
                                  postRes = await blueskyService.post(result.caption, embed);
                              }
                              return { success: true, data: postRes?.uri };
                          }
                      }
                  }
              }
              return { success: false, reason: "Failed to generate image" };
          }

          if (action.tool === 'discord_message') {
              const msg = params.message || query;
              const channelId = context?.channelId || config.DISCORD_ADMIN_CHANNEL_ID;
              if (msg && channelId) {
                  await discordService._send({ id: channelId }, msg);
                  return { success: true, data: msg };
              }
              return { success: false, reason: "Discord message failed" };
          }

          if (action.tool === 'bsky_post') {
              if (context?.platform === 'discord' || context?.channelId) return { success: false, reason: "Blocked Bsky post from Discord" };
              let text = params.text || query;
              if (text) {
                  let result;
                  if (context?.uri) {
                      result = await blueskyService.postReply(context, text.substring(0, 290));
                  } else {
                      result = await blueskyService.post(text.substring(0, 290));
                  }
                  return result ? { success: true, data: result.uri } : { success: false, reason: "Failed to post" };
              }
              return { success: false, reason: "Missing text" };
          }

          if (action.tool === 'google_search' || action.tool === 'search') {
              const res = await googleSearchService.search(query);
              return { success: true, data: res };
          }

          if (action.tool === 'wikipedia') {
              const res = await wikipediaService.search(query);
              return { success: true, data: res };
          }

          if (action.tool === 'set_goal') {
              const { goal, description } = params;
              const finalGoal = goal || query;
              if (finalGoal) {
                  await dataStore.setCurrentGoal(finalGoal, description || finalGoal);
                  if (memoryService.isEnabled()) {
                      await memoryService.createMemoryEntry('goal', `[GOAL] Goal: ${finalGoal}`);
                  }
                  return { success: true, data: finalGoal };
              }
              return { success: false, reason: "Goal name missing" };
          }

          return { success: false, reason: `Unknown tool: ${action.tool}` };

      } catch (e) {
          console.error('[Bot] Error in executeAction:', e);
          await dataStore.addSessionLesson(`Tool ${action.tool} failed: ${e.message}`);
          return { success: false, error: e.message };
      }
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

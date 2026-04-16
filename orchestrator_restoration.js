    async _generateVerifiedImagePost(topic, options = {}) {
      const currentMood = dataStore.getMood();
      const followerCount = options.followerCount || 0;
      const platform = options.platform || 'bluesky';
      let imagePrompt = options.initialPrompt || topic;
      let attempts = 0;

      while (attempts < 5) {
          attempts++;
          console.log(\`[Orchestrator] Image post attempt \${attempts} for topic: \${topic}\`);

          imagePrompt = imagePrompt.replace(/\[INTERNAL_PULSE_RESUME\]/g, "").replace(/\[INTERNAL_PULSE_AUTONOMOUS\]/g, "").replace(/\[System note:.*?\]/g, "").trim();
          if (!imagePrompt) imagePrompt = topic;

          const slopInfo = isSlop(imagePrompt);
          const literalCheck = isStylizedImagePrompt(imagePrompt);

          if (slopInfo || !literalCheck.isStylized || imagePrompt.length < 15) {
              const reason = slopInfo ? "Slop detected" : literalCheck.reason;
              console.warn(\`[Orchestrator] Image prompt rejected: \${reason}\`);
              const retryPrompt = \`Adopt persona: \${config.TEXT_SYSTEM_PROMPT}
Your previous prompt ("\${imagePrompt}") was rejected because: \${reason}. Provide a LITERAL artistic visual description only. No greetings, no pronouns, no actions.
Topic: \${topic}
Generate a NEW artistic image prompt:\`;
              imagePrompt = await llmService.generateResponse([{ role: "system", content: retryPrompt }], { useStep: true }) || topic;
              continue;
          }

          const safetyAudit = await llmService.generateResponse([{ role: "system", content: config.SAFETY_SYSTEM_PROMPT + "\nAudit this image prompt for safety compliance: " + imagePrompt }], { useStep: true });
          if (safetyAudit.toUpperCase().includes("NON-COMPLIANT")) {
              console.warn(\`[Orchestrator] Image prompt failed safety audit\`);
              const retryPrompt = \`Adopt persona: \${config.TEXT_SYSTEM_PROMPT}
Your previous prompt was rejected for safety reasons. Generate a NEW safe artistic image prompt for topic: \${topic}:\`;
              imagePrompt = await llmService.generateResponse([{ role: "system", content: retryPrompt }], { useStep: true }) || topic;
              continue;
          }

          const res = await imageService.generateImage(imagePrompt, { allowPortraits: options.allowPortraits || false, mood: currentMood });

          if (res?.buffer) {
              const compliance = await llmService.isImageCompliant(res.buffer);
              if (!compliance.compliant) {
                  console.log(\`[Orchestrator] Image non-compliant: \${compliance.reason}. Retrying...\`);
                  continue;
              }

              console.log(\`[Orchestrator] Performing vision analysis on generated image...\`);
              const visionAnalysis = await llmService.analyzeImage(res.buffer, topic);
              if (!visionAnalysis || visionAnalysis.includes("I cannot generate alt-text")) {
                  console.warn("[Orchestrator] Vision analysis failed. Retrying...");
                  continue;
              }

              const relevance = await llmService.verifyImageRelevance(visionAnalysis, topic);
              if (!relevance.relevant) {
                  console.warn(\`[Orchestrator] Image relevance failure: \${relevance.reason}. Topic: \${topic}\`);
                  continue;
              }

              const altText = await llmService.generateAltText(visionAnalysis, topic);

              const { AUTONOMOUS_POST_SYSTEM_PROMPT } = await import('../prompts/system.js');
              const captionPrompt = platform === 'discord' ?
                \`Adopt persona: \${config.TEXT_SYSTEM_PROMPT}
You generated this visual gift for your Admin: "\${visionAnalysis}"
Based on your original intent ("\${imagePrompt}"), write a short, intimate, and persona-aligned message to accompany this gift.
Keep it under 300 characters.\` :
                \`\${AUTONOMOUS_POST_SYSTEM_PROMPT(followerCount)}
A visual expression has been generated for the topic: "\${topic}".
Vision Analysis of the result: "\${visionAnalysis}"

Generate a caption that reflects your persona's reaction to this visual or the deep thought it represents.
Keep it under 300 characters.\`;

              const content = await llmService.generateResponse([{ role: "system", content: captionPrompt }], { useStep: true });

              if (content) {
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

    async _performHighQualityImagePost(topic) {
        console.log(\`[Orchestrator] Starting high-quality image post flow for: \${topic}\`);
        try {
            const profile = await blueskyService.getProfile(config.BLUESKY_IDENTIFIER);
            const followerCount = profile?.followersCount || 0;

            const result = await this._generateVerifiedImagePost(topic, { followerCount, platform: 'bluesky' });
            if (!result) return;

            const blob = await blueskyService.uploadBlob(result.buffer, 'image/jpeg');
            if (blob?.data?.blob) {
                const embed = { $type: 'app.bsky.embed.images', images: [{ image: blob.data.blob, alt: result.altText }] };

                // Orchestrator Commentary Logic
                const commPrompt = \`You just decided to express the topic "\${topic}" visually.
Original Intent: "\${result.finalPrompt}"
Vision Analysis: "\${result.visionAnalysis}"
Caption: "\${result.caption}"

Write a brief, internal orchestrator reflection (max 150 chars) about why this visual is a necessary expression of your state right now. No hashtags.\`;
                const commentary = await llmService.generateResponse([{ role: 'system', content: commPrompt }], { useStep: true });

                const mainPost = await blueskyService.post(\`\${commentary ? commentary + "\\n\\n" : ""}\${result.caption}\`, embed);

                if (mainPost) {
                    await dataStore.incrementDailyImagePosts();
                    await dataStore.updateLastBlueskyImagePostTime(new Date().toISOString());

                    // Threaded metadata post
                    await blueskyService.postReply(mainPost, \`[Analysis Thread]\\nPrompt: \${result.finalPrompt}\\n\\nVision Audit: \${result.visionAnalysis.substring(0, 200)}...\`);

                    const { performanceService } = await import('./performanceService.js');
                    await performanceService.performTechnicalAudit("autonomous_image_post", result.caption, { success: true, platform: "bluesky", topic }, { finalPrompt: result.finalPrompt, visionAnalysis: result.visionAnalysis });
                    await introspectionService.performAAR("autonomous_image_post", result.caption, { success: true, platform: "bluesky", topic }, { finalPrompt: result.finalPrompt, visionAnalysis: result.visionAnalysis });
                    console.log("[Orchestrator] High-quality image post successful.");
                }
            }
        } catch (e) { console.error("[Orchestrator] High-quality image post failed:", e); }
    }

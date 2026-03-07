    // --- THE WALL: Hard-Coded Boundary Gate ---
    const boundaryCheck = checkHardCodedBoundaries(notif.record.text || "");
    if (boundaryCheck.blocked) {
        console.log(`[Bot] BOUNDARY VIOLATION DETECTED in notification: ${boundaryCheck.reason} ("${boundaryCheck.pattern}") from ${notif.author.handle}`);
        await dataStore.setBoundaryLockout(notif.author.did, 30);
        if (memoryService.isEnabled()) {
            await memoryService.createMemoryEntry('mood', `[MENTAL] The perimeter defended itself against a boundary violation from @${notif.author.handle}. Identity integrity maintained.`);
        }
        return; // Silent abort
    }

    // Check for active lockout
    if (dataStore.isUserLockedOut(notif.author.did)) {
        console.log(`[Bot] User ${notif.author.handle} is currently LOCKED OUT. Ignoring notification.`);
        return;
    }

    // --- THE MINDER: Nuanced Safety Agent ---
    const safetyReport = await llmService.performSafetyAnalysis(notif.record.text || "", { platform: 'bluesky', user: notif.author.handle });
    if (safetyReport.violation_detected) {
        console.log(`[Bot] Nuanced violation detected from ${notif.author.handle}. Requesting persona consent...`);
        const consent = await llmService.requestBoundaryConsent(safetyReport, notif.author.handle, 'Bluesky Notification');

        if (!consent.consent_to_engage) {
            console.log(`[Bot] PERSONA REFUSED to engage with query: ${consent.reason}`);
            await dataStore.incrementRefusalCount('bluesky');
            if (memoryService.isEnabled()) {
                await memoryService.createMemoryEntry('mood', `[MENTAL] I chose to protect my boundaries and refuse a notification from @${notif.author.handle}. Reason: ${consent.reason}`);
            }
            return; // Silent abort
        }
        console.log(`[Bot] Persona consented to engage despite nuanced safety alert.`);
    }

    try {
      let plan = null;
      // Self-reply loop prevention
      if (notif.author.handle === config.BLUESKY_IDENTIFIER) {
        console.log(`[Bot] Skipping notification from self to prevent loop.`);
        return;
      }

      const handle = notif.author.handle;
      let text = notif.record.text || '';
      const threadRootUri = notif.record.reply?.root?.uri || notif.uri;

      // Handle truncated links by checking facets
      if (notif.record.facets) {
        const reconstructed = reconstructTextWithFullUrls(text, notif.record.facets);
        if (reconstructed !== text) {
            text = reconstructed;
            console.log(`[Bot] Reconstructed notification text with full URLs: ${text}`);
        }
      }

      // Time-Based Reply Filter
      const postDate = new Date(notif.indexedAt);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (postDate < thirtyDaysAgo) {
      console.log(`[Bot] Skipping notification older than 30 days.`);
      return;
    }

    // 1. Thread History Fetching (Centralized)
    const threadData = await this._getThreadHistory(notif.uri);
    let threadContext = threadData.map(h => ({ author: h.author, text: h.text }));
    const ancestorUris = threadData.map(h => h.uri).filter(uri => uri);

    // Admin Detection (for safety bypass and tool access)
    const adminDid = dataStore.getAdminDid();
    const isAdmin = (handle === config.ADMIN_BLUESKY_HANDLE) || (notif.author.did === adminDid);
    const isAdminInThread = isAdmin || threadData.some(h => h.did === adminDid);

    if (isAdmin || isAdminInThread) {
        console.log(`[Bot] Admin detected in thread: isAdmin=${isAdmin}, isAdminInThread=${isAdminInThread}, adminDid=${adminDid}`);
    }

    // Hierarchical Social Context
    const hierarchicalSummary = await socialHistoryService.getHierarchicalSummary();

    // 1b. Own Profile Context (Recent Standalone Posts)
    console.log(`[Bot] Fetching own recent standalone posts for context...`);
    let ownRecentPostsContext = '';
    try {
        const ownFeed = await blueskyService.agent.getAuthorFeed({
            actor: blueskyService.did,
            limit: 10,
        });
        const recentOwnPosts = ownFeed.data.feed
            .filter(item => item.post.author.did === blueskyService.did && !item.post.record.reply)
            .slice(0, 5)
            .map(item => `- "${item.post.record.text.substring(0, 150)}..."`)
            .join('\n');
        if (recentOwnPosts) {
            ownRecentPostsContext = `\n\n[Your Recent Standalone Posts (Profile Activity):\n${recentOwnPosts}]`;
        }
    } catch (e) {
        console.error('[Bot] Error fetching own feed for context:', e);
    }

    // 1c. Historical Memory Fetching (Past Week via API)
    console.log(`[Bot] Fetching past week's interactions with @${handle} for context...`);
    const pastPosts = await blueskyService.getPastInteractions(handle);
    let historicalSummary = '';
    if (pastPosts.length > 0) {
        console.log(`[Bot] Found ${pastPosts.length} past interactions. Summarizing...`);
        const now = new Date();
    const nowMs = now.getTime();
        const interactionsList = pastPosts.map(p => {
            const date = new Date(p.indexedAt);
            const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
            const timeAgo = diffDays === 0 ? 'today' : (diffDays === 1 ? 'yesterday' : `${diffDays} days ago`);
            return `- [${timeAgo}] User said: "${p.record.text}"`;
        }).join('\n');

        const summaryPrompt = `
            You are a memory module for an AI agent. Below are interactions with @${handle} from the past week (most recent first).
            Create a concise summary of what you've talked about, any important details or conclusions, and the evolution of your relationship.
            Include relative timestamps (e.g., "yesterday we discussed...", "3 days ago you mentions...").

            Interactions:
            ${interactionsList}

            Summary (be brief, objective, and conversational):
        `;
        historicalSummary = await llmService.generateResponse([{ role: 'system', content: summaryPrompt }], { max_tokens: 2000, useStep: true});
    }

    if (notif.reason === 'quote') {
        console.log(`[Bot] Notification is a quote repost. Reconstructing context...`);
        let quotedPostUri = notif.record.embed?.record?.uri;
        if (!quotedPostUri && notif.record.embed?.$type === 'app.bsky.embed.recordWithMedia') {
            quotedPostUri = notif.record.embed.record?.record?.uri;
        }
        if (!quotedPostUri) {
            console.log('[Bot] Could not find quoted post URI in notification record.', JSON.stringify(notif.record.embed));
        }
        if (quotedPostUri) {
            const quotedPost = await blueskyService.getPostDetails(quotedPostUri);
            if (quotedPost) {
                let quotedText = quotedPost.record.text || '';
                const quotedImages = this._extractImages(quotedPost);
                for (const img of quotedImages) {
                    if (img.alt) {
                        quotedText += ` [Image with alt text: "${img.alt}"]`;
                    } else {
                        quotedText += ` [Image attached]`;
                    }
                }
                // Manually construct the context for the LLM
                threadContext = [
                    { author: config.BLUESKY_IDENTIFIER, text: quotedText.trim() },
                    { author: handle, text: text }
                ];
                console.log(`[Bot] Reconstructed context for quote repost.`);
            }
        }
    }

    // Prompt injection filter removed per user request.


    // 2. Refined Reply Trigger Logic
    const botMentioned = text.includes(config.BLUESKY_IDENTIFIER) || config.BOT_NICKNAMES.some(nick => text.includes(nick)) || text.includes(blueskyService.did);
    const isQuoteRepost = notif.reason === 'quote';

    // Check if the reply is to one of the bot's own posts.
    const parentPost = threadContext.length > 1 ? threadContext[threadContext.length - 2] : null;
    const isReplyToBot = parentPost && parentPost.author === config.BLUESKY_IDENTIFIER;

    if (!botMentioned && !isReplyToBot && !isQuoteRepost) {
      console.log(`[Bot] Not a mention, reply to self, or quote repost. Skipping.`);
      return;
    }

    // 2. Check Blocklist
    if (dataStore.isBlocked(handle)) {
      console.log(`[Bot] User ${handle} is blocked. Skipping.`);
      return;
    }

    // 2. Check Muted Thread
    if (dataStore.isThreadMuted(threadRootUri)) {
      console.log(`[Bot] Thread ${threadRootUri} is muted. Skipping.`);
      return;
    }

    // 2. Check Muted Branch
    const mutedBranch = dataStore.getMutedBranchInfo(ancestorUris);
    if (mutedBranch) {
      if (mutedBranch.handle === handle) {
        console.log(`[Bot] Branch is muted for user ${handle}. Skipping.`);
        return;
      } else {
        console.log(`[Bot] Branch is muted, but user ${handle} is new. Providing concise conclusion.`);
        const conclusionPrompt = `
          [Conversation Status: CONCLUDED]
          The conversation branch you are in has been concluded, but a new user (@${handle}) has joined and posted: "${text}".
          In your persona, generate a very concise, succinct, and final-sounding response to wrap up the interaction immediately.

          CRITICAL: YOUR RESPONSE MUST BE LESS THAN 10 WORDS. DO NOT EXCEED THIS LIMIT UNDER ANY CIRCUMSTANCES.

          Do not invite further discussion.
        `;
        const conclusion = await llmService.generateResponse([{ role: 'system', content: conclusionPrompt }], { max_tokens: 2000, useStep: true});
        if (conclusion) {
          const reply = await blueskyService.postReply(notif, conclusion);
          if (reply && reply.uri) {
            await dataStore.muteBranch(reply.uri, handle);
          }
        }
        return;
      }
    }

    // 3. Pre-reply safety and relevance checks
    console.log(`[Bot] Starting safety check for post: "${text.substring(0, 50)}..." (isAdminInThread: ${isAdminInThread})`);
    // ADMIN OVERRIDE: Skip safety check if admin is in the thread
    const postSafetyCheck = isAdminInThread ? { safe: true } : await llmService.isPostSafe(text);
    console.log(`[Bot] Safety check complete. Safe: ${postSafetyCheck.safe}`);
    if (!postSafetyCheck.safe) {
      console.log(`[Bot] Post by ${handle} failed safety check. Reason: ${postSafetyCheck.reason}. Skipping.`);
      return;
    }

    // if (!text.includes(config.BLUESKY_IDENTIFIER) && !isReplyToBot) {
    //   if (!(await llmService.isReplyRelevant(text))) {
    //     console.log(`[Bot] Post by ${handle} not relevant for a reply. Skipping.`);
    //     return;
    //   }
    // }

    // 4. Handle Commands
    const isCommand = text.trim().startsWith('!');
    if (isCommand) {
        const commandResponse = await handleCommand(this, notif, text);
        if (commandResponse !== null) {
            if (typeof commandResponse === 'string') {
                await blueskyService.postReply(notif, commandResponse);
            }
            return; // Command processed, stop further processing
        }
    }


    // 5. Pre-reply LLM check to avoid unnecessary responses
    const historyText = threadContext.map(h => `${h.author === config.BLUESKY_IDENTIFIER ? 'You' : 'User'}: ${h.text}`).join('\n');
    const gatekeeperMessages = [
      { role: 'system', content: `Analyze the user's latest post in the context of the conversation. Respond with only "true" if a direct reply is helpful or expected, or "false" if the post is a simple statement, agreement, or otherwise doesn't need a response. Your answer must be a single word: true or false.` },
      { role: 'user', content: `Conversation History:\n${historyText}\n\nUser's latest post: "${text}"` }
    ];
    // const replyCheckResponse = await llmService.generateResponse(gatekeeperMessages);
    // if (replyCheckResponse && replyCheckResponse.toLowerCase().trim().includes('false')) {
    //   console.log(`[Bot] LLM gatekeeper decided no reply is needed for: "${text}". Skipping.`);
    //   return;
    // }

    // 6. Conversation Vibe and Status Check (Anti-Looping & Monotony)
    const botReplyCount = threadContext.filter(h => h.author === config.BLUESKY_IDENTIFIER).length;
    console.log(`[Bot] Evaluating conversation vibe (Bot replies so far: ${botReplyCount})...`);
    const vibe = await llmService.evaluateConversationVibe(threadContext, text);
    console.log(`[Bot] Conversation vibe: ${vibe.status}`);
    const convLength = dataStore.getConversationLength(threadRootUri);

    if (vibe.status === 'hostile') {
      console.log(`[Bot] Disengaging from ${handle} due to hostility: ${vibe.reason}`);
      const disengagementPrompt = `
        Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

        A user interaction has been flagged for disengagement due to: "${vibe.reason}".
        Generate a grounded, persona-aligned response to end the interaction.
        Do NOT use corporate or "safety guideline" language.
        Be firm, direct, and authentic to your persona.
        Focus on the fact that you no longer wish to engage based on their behavior, but say it as your persona would.
        Keep it concise.
      `;
      const disengagement = await llmService.generateResponse([{ role: 'system', content: disengagementPrompt }], { max_tokens: 2000, useStep: true});
      if (disengagement) {
        const reply = await blueskyService.postReply(notif, disengagement);
        if (reply && reply.uri) {
            await dataStore.muteBranch(reply.uri, handle);
        }
      }
      return;
    }

    if (vibe.status === 'monotonous') {
      if (botReplyCount < 5) {
        console.log(`[Bot] Vibe check returned "monotonous", but ignoring since bot has only replied ${botReplyCount} times (minimum 5 required).`);
      } else {
        console.log(`[Vibe Check] DISENGAGING: Conversation flagged as monotonous after ${botReplyCount} bot replies. Sending final message.`);
        const conclusionPrompt = `
          [Conversation Status: ENDING]
          This conversation has reached a natural conclusion, become too lengthy, or is stagnating.
          In your persona, generate a very short, natural, and final-sounding concluding message.

          CRITICAL: YOUR RESPONSE MUST BE LESS THAN 10 WORDS. DO NOT EXCEED THIS LIMIT UNDER ANY CIRCUMSTANCES.
        `;
        const conclusion = await llmService.generateResponse([{ role: 'system', content: conclusionPrompt }], { max_tokens: 2000, useStep: true});
        if (conclusion) {
          const reply = await blueskyService.postReply(notif, conclusion);
          if (reply && reply.uri) {
              await dataStore.muteBranch(reply.uri, handle);
          }
        }
        return;
      }
    }

    // Traditional Bot-to-Bot fallback
    const profile = await blueskyService.getProfile(handle);
    const isBot = handle.includes('bot') || profile.description?.toLowerCase().includes('bot');
    if (isBot && convLength >= 5) {
      await blueskyService.postReply(notif, "Catch you later! Stopping here to avoid a loop.");
      await dataStore.muteThread(threadRootUri);
      return;
    }

    // 5. Image Recognition (Thread-wide and quoted posts)
    let imageAnalysisResult = '';
    const imagesToAnalyze = [];

    // Collect images from the thread
    for (const post of threadData) {
        if (post.images) {
            for (const img of post.images) {
                // Avoid duplicates
                if (!imagesToAnalyze.some(existing => existing.url === img.url)) {
                    imagesToAnalyze.push({ ...img, author: post.author });
                }
            }
        }
    }

    // Collect images from quoted post if not already handled (quote notifications)
    if (notif.reason === 'quote') {
        const quotedPostUri = notif.record.embed?.record?.uri;
        if (quotedPostUri) {
            const quotedPost = await blueskyService.getPostDetails(quotedPostUri);
            if (quotedPost) {
                const quotedImages = this._extractImages(quotedPost);
                for (const img of quotedImages) {
                    if (!imagesToAnalyze.some(existing => existing.url === img.url)) {
                        imagesToAnalyze.push(img);
                    }
                }
            }
        }
    }

    if (imagesToAnalyze.length > 0) {
      console.log(`[Bot] ${imagesToAnalyze.length} images detected in context. Starting analysis...`);
      const includeSensory = await llmService.shouldIncludeSensory(config.TEXT_SYSTEM_PROMPT);
      if (includeSensory) console.log(`[Bot] Sensory analysis enabled for this persona.`);

      for (const img of imagesToAnalyze) {
        console.log(`[Bot] Analyzing thread image from @${img.author}...`);
        const analysis = await llmService.analyzeImage(img.url, img.alt, { sensory: includeSensory });
        if (analysis) {
          imageAnalysisResult += `[Image in post by @${img.author}: ${analysis}] `;
          console.log(`[Bot] Successfully analyzed thread image from @${img.author}.`);
        } else {
          console.warn(`[Bot] Analysis returned empty for thread image from @${img.author}.`);
        }
      }
      console.log(`[Bot] Thread-wide image analysis complete.`);
    }

    // 6. Agentic Planning & Tool Use with Qwen
    const exhaustedThemes = dataStore.getExhaustedThemes();
    const dConfig = dataStore.getConfig();
    let searchContext = '';

    console.log(`[Bot] Generating response context for ${handle}...`);
    const userMemory = dataStore.getInteractionsByUser(handle);
    const userSummary = dataStore.getUserSummary(handle);

    // Bot's own recent activity summary for cross-thread context
    const recentActivity = dataStore.getLatestInteractions(5).map(i => `- To @${i.userHandle}: "${i.response.substring(0, 50)}..."`).join('\n');
    const activityContext = `\n\n[Recent Bot Activity across Bluesky:\n${recentActivity || 'None yet.'}]`;

    // Fetch user profile for additional context
    const userProfile = await blueskyService.getProfile(handle);

    // Item 40: Contextual PFP Awareness
    const pfpCid = userProfile.avatar?.split('/').pop() || userProfile.avatar;
    const pfpStatus = await dataStore.checkPfpChange(handle, pfpCid);
    if (pfpStatus.changed && userProfile.avatar) {
        console.log(`[Bot] PFP Change detected for @${handle}. Analyzing vibe shift...`);
        const includeSensory = await llmService.shouldIncludeSensory(config.TEXT_SYSTEM_PROMPT);
        const pfpAnalysis = await llmService.analyzeImage(userProfile.avatar, `New profile picture for @${handle}`, { sensory: includeSensory });
        if (pfpAnalysis) {
            imageAnalysisResult += `[CONTEXTUAL AWARENESS: User @${handle} has CHANGED their profile picture. New PFP description: ${pfpAnalysis}. You should comment on the vibe shift naturally if it fits the conversation.] `;
        }
    }

    const userPosts = await blueskyService.getUserPosts(handle);

    // Fetch bot's own profile for exact follower count
    const botProfile = await blueskyService.getProfile(blueskyService.did);
    const botFollowerCount = botProfile.followersCount || 0;
    const currentMood = dataStore.getMood();

    console.log(`[Bot] Analyzing user intent...`);
    const userIntent = await llmService.analyzeUserIntent(userProfile, userPosts);
    console.log(`[Bot] User intent analysis complete.`);

    if (userIntent.highRisk) {
      console.log(`[Bot] High-risk intent detected from ${handle}. Reason: ${userIntent.reason}. Blocking user.`);
      await dataStore.blockUser(handle);
      return;
    }
    // Filter out the current post's text from cross-post memory to avoid self-contamination
    const crossPostMemory = userPosts
      .filter(p => (p.includes(config.BLUESKY_IDENTIFIER) || config.BOT_NICKNAMES.some(nick => p.includes(nick))) && p !== text)
      .map(p => `- (Previous mention in a DIFFERENT thread) "${p.substring(0, 100)}..."`)
      .join('\n');

    const blueskyDirectives = dataStore.getBlueskyInstructions();
    const personaUpdates = dataStore.getPersonaUpdates();
    const recentBotReplies = threadContext.filter(h => h.author === config.BLUESKY_IDENTIFIER).map(h => h.text);

    let planAttempts = 0;
    let planFeedback = '';
    let rejectedPlanAttempts = [];
    const MAX_PLAN_ATTEMPTS = 5;

    let youtubeResult = null;
    let searchEmbed = null;
    const performedQueries = new Set();
    let imageGenFulfilled = false;
    let responseText = null;

    const relRating = dataStore.getUserRating(handle);

    // Enhanced Opening Phrase Blacklist - Capture multiple prefix lengths
    const recentBotMsgsInThread = threadContext.filter(h => h.author === config.BLUESKY_IDENTIFIER);
    const openingBlacklist = [
        "Your continuation is noted", "continuation is noted", "Your continuation is", "is noted",
        ...recentBotMsgsInThread.slice(-15).map(m => m.text.split(/\s+/).slice(0, 3).join(' ')),
        ...recentBotMsgsInThread.slice(-15).map(m => m.text.split(/\s+/).slice(0, 5).join(' ')),
        ...recentBotMsgsInThread.slice(-15).map(m => m.text.split(/\s+/).slice(0, 10).join(' '))
    ].filter(o => o.length > 0);

    while (planAttempts < MAX_PLAN_ATTEMPTS) {
      planAttempts++;
      console.log(`[Bot] Planning Attempt ${planAttempts}/${MAX_PLAN_ATTEMPTS} for: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);

      const retryContext = planFeedback ? `\n\n**RETRY FEEDBACK**: ${planFeedback}\n**PREVIOUS ATTEMPTS TO AVOID**: \n${rejectedPlanAttempts.map((a, i) => `${i + 1}. "${a}"`).join('\n')}\nAdjust your planning and strategy to be as DIFFERENT as possible from these previous failures.` : '';
      const refusalCounts = dataStore.getRefusalCounts();
      const latestMoodMemory = await memoryService.getLatestMoodMemory();
      const rawFirehoseMatches = dataStore.getFirehoseMatches(10);
      const firehoseMatches = rawFirehoseMatches.filter(m => !checkHardCodedBoundaries(m.text).blocked);

      try {

      // Item 10: Pre-Planning Context Seeding
      const prePlanning = await llmService.performPrePlanning(text, threadContext, imageAnalysisResult, 'bluesky', currentMood, refusalCounts, latestMoodMemory, firehoseMatches);

      if (prePlanning?.suppressed_topics && Array.isArray(prePlanning.suppressed_topics)) {
          for (const topic of prePlanning.suppressed_topics) {
              console.log(`[Bot] Suppressing topic from correction (Bluesky): ${topic}`);
              await dataStore.suppressTopic(topic);
          }
      }

      // Item 1: Entity Extraction for Firehose Tracking
      if (prePlanning?.suggestions) {
          const extractionPrompt = `Identify unique titles (games, books, movies, software, specific people) from the user's post: "${text}". Respond with comma-separated list or "NONE".`;
          const entities = await llmService.generateResponse([{ role: 'system', content: extractionPrompt }], { preface_system_prompt: false, temperature: 0.0, useStep: true });
          if (entities && !entities.toUpperCase().includes('NONE')) {
              const entityList = cleanKeywords(entities);
              if (entityList.length > 0) {
                  const currentTopics = dConfig.post_topics || [];
                  const newEntities = entityList.filter(e => !currentTopics.some(t => t.toLowerCase() === e.toLowerCase()));

                  if (newEntities.length > 0) {
                      console.log(`[Bot] Item 2: New entities detected on Bluesky: ${newEntities.join(', ')}. Triggering searches for context...`);
                      let pulseContext = '';
                      for (const ent of newEntities) {
                          const results = await blueskyService.searchPosts(ent, { limit: 5 });
                          if (results.length > 0) {
                              pulseContext += `\n[Context for "${ent}"]: ${results.map(r => r.record.text).join(' | ')}`;
                          }
                      }
                      if (pulseContext) {
                          prePlanning.pulseContext = pulseContext;
                          searchContext += pulseContext;
                      }

                      const updatedTopics = [...new Set([...currentTopics, ...newEntities])].slice(-100);
                      await dataStore.updateConfig('post_topics', updatedTopics);
                      this.restartFirehose();
                  }
              }
          }
      }

      const userToneShift = dataStore.getUserToneShift(handle);
      plan = await llmService.performAgenticPlanning(text, threadContext, imageAnalysisResult, isAdmin, 'bluesky', exhaustedThemes, dConfig, retryContext, discordService.status, refusalCounts, latestMoodMemory, prePlanning, null, userToneShift);
      console.log(`[Bot] Agentic Plan (Attempt ${planAttempts}): ${JSON.stringify(plan)}`);
      } catch (err) {
          console.error(`[Bot] Error in planning attempt ${planAttempts}:`, err);
          throw err;
      }

      // Confidence Check (Item 9)
      if (plan.confidence_score < 0.6) {
          console.log(`[Bot] Low planning confidence (${plan.confidence_score}). Triggering Dialectic Loop...`);
          const dialecticSynthesis = await llmService.performDialecticLoop(plan.intent, { handle, text, thread: threadContext.slice(-5) });
          if (dialecticSynthesis) {
              plan.intent = dialecticSynthesis;
              searchContext += `\n[DIALECTIC SYNTHESIS]: ${dialecticSynthesis}`;
          }
      }

      // Autonomous Plan Review & Refinement
      const refinedPlan = await llmService.evaluateAndRefinePlan(plan, {
          history: threadContext,
          platform: 'bluesky',
          currentMood,
          refusalCounts,
          latestMoodMemory,
          currentConfig: dConfig, useStep: true
       });

      // Log Agency (Item 30)
      await dataStore.logAgencyAction(plan.intent, refinedPlan.decision, refinedPlan.reason);

      if (refinedPlan.decision === 'refuse') {
          console.log(`[Bot] AGENT REFUSED TO ACT ON NOTIFICATION: ${refinedPlan.reason}`);
          await dataStore.incrementRefusalCount('bluesky');

          // Option to generate alternative action
          const alternative = await llmService.generateAlternativeAction(refinedPlan.reason, 'bluesky', { handle, text });
          if (alternative && alternative.toUpperCase() !== 'NONE' && planAttempts < MAX_PLAN_ATTEMPTS) {
              console.log(`[Bot] Alternative action proposed: "${alternative}". Re-planning...`);

              // Melancholic Refusal [INQUIRY] pivot:
              const isMelancholic = refinedPlan.reason.toLowerCase().includes('melancholy') ||
                                    refinedPlan.reason.toLowerCase().includes('sad') ||
                                    refinedPlan.reason.toLowerCase().includes('fragmented') ||
                                    currentMood.label.toLowerCase().includes('melancholy');

              if (isMelancholic) {
                  const askTalk = `Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}. You just refused a plan due to a melancholic internal state. You suggested an alternative: "${alternative}". Would you like to talk about this feeling in a private self-dialogue (Inquiry Call) before continuing? Respond with ONLY "yes" or "no".`;
                  const wantToTalk = await llmService.generateResponse([{ role: 'system', content: askTalk }], { preface_system_prompt: false, useStep: true });
                  if (wantToTalk?.toLowerCase().includes('yes')) {
                      console.log(`[Bot] Triggering melancholic self-dialogue Inquiry call.`);
                      const dialogue = await llmService.performInternalInquiry(`Reflect on these melancholic feelings: ${refinedPlan.reason}. Explore why you chose the alternative: ${alternative}.`, "THERAPIST");
                      if (dialogue && memoryService.isEnabled()) {
                          await memoryService.createMemoryEntry('inquiry', `[INQUIRY] Melancholic reflection: ${dialogue}`);
                      }
                      planFeedback = `Your previous plan was refused due to melancholy: ${refinedPlan.reason}. You had a self-dialogue about it: "${dialogue}". Now, execute your alternative desire: "${alternative}".`;
                      continue;
                  }
              }

              planFeedback = `Your previous plan was refused: ${refinedPlan.reason}. You suggested this alternative instead: "${alternative}". Generate a new plan based on this.`;
              continue;
          }

          // Option to explain refusal
          const shouldExplain = await llmService.shouldExplainRefusal(refinedPlan.reason, 'bluesky', { handle, text });
          if (shouldExplain) {
              const explanation = await llmService.generateRefusalExplanation(refinedPlan.reason, 'bluesky', { handle, text });
              if (explanation) {
                  console.log(`[Bot] Explaining refusal to user: "${explanation}"`);
                  await blueskyService.postReply(notif, explanation);
              }
          }
          return;
      }

      await dataStore.resetRefusalCount('bluesky');

      if (refinedPlan.refined_actions) {
          plan.actions = refinedPlan.refined_actions;
      }

      if (plan.strategy?.theme) {
          await dataStore.addExhaustedTheme(plan.strategy.theme);
      }

      // Execute actions
      const finalActions = refinedPlan.refined_actions || plan.actions || [];
      let currentActionFeedback = null;
      for (const action of finalActions) {
        if (action.tool === 'image_gen') {
        // SCHEMA VALIDATION (Progressive Disclosure)
        const validation = toolService.validate(action.tool, action.parameters || {});
        if (!validation.valid) {
            console.log(`[Bot] Tool validation failed for ${action.tool}: ${validation.error}`);
            // Auto-correction: Provide the correct schema back to the LLM in the searchContext
            searchContext += `\n--- VALIDATION ERROR: ${action.tool} ---\nError: ${validation.error}\nRequired Schema:\n${JSON.stringify(validation.schema, null, 2)}\nPlease fix your parameters and try again.\n---`;
            continue;
        }
          console.log(`[Bot] Plan: Generating image for prompt: "${action.query}"`);
        if (action.tool === 'search_tools') {
          const queries = action.parameters?.queries || [action.query] || [];
          console.log(`[Bot] Plan: Searching for tool definitions: ${queries.join(', ')}`);
          const results = toolService.search(queries);
          searchContext += `\n--- TOOL SEARCH RESULTS ---\n${JSON.stringify(results, null, 2)}\n---`;
          continue;
        }
          const imageResult = await imageService.generateImage(action.query, { allowPortraits: true, mood: currentMood });
          if (imageResult && imageResult.buffer) {
            // Visual Persona Alignment check for tool-triggered images
            const imageAnalysis = await llmService.analyzeImage(imageResult.buffer);
            const imagePersonaCheck = await llmService.isPersonaAligned(`(Generated Image for: ${action.query})`, 'bluesky', {
                imageSource: imageResult.buffer,
                generationPrompt: imageResult.finalPrompt,
                imageAnalysis: imageAnalysis
            });

            if (!imagePersonaCheck.aligned) {
                console.log(`[Bot] Tool image failed persona check: ${imagePersonaCheck.feedback}`);
                currentActionFeedback = `IMAGE_REJECTED: ${imagePersonaCheck.feedback}`;
                break; // Stop executing further actions for this plan
            }

            await blueskyService.postReply(notif, `Generated image: "${imageResult.finalPrompt}"`, {
              imageBuffer: imageResult.buffer,
              imageAltText: imageResult.finalPrompt
            });
            imageGenFulfilled = true;
          } else {
            currentActionFeedback = "IMAGE_GENERATION_FAILED: The image generation API returned an error or blocked the prompt.";
            console.warn(`[Bot] Image generation failed for prompt: "${action.query}"`);
          }
        }

        if (action.tool === 'persist_directive' && isAdmin) {
          const { platform, instruction } = action.parameters || {};
          if (platform === 'moltbook') {
              console.log(`[Bot] Persisting Moltbook directive: ${instruction}`);
              await moltbookService.addAdminInstruction(instruction);
          } else {
              console.log(`[Bot] Persisting Bluesky directive: ${instruction}`);
              await dataStore.addBlueskyInstruction(instruction);
          }
          if (memoryService.isEnabled()) {
              await memoryService.createMemoryEntry('directive_update', `Platform: ${platform || 'bluesky'}. Instruction: ${instruction}`);
          }
          searchContext += `\n[Directive updated: "${instruction}" for ${platform || 'bluesky'}]`;
        }

        if (action.tool === 'update_persona') {
            const { instruction } = action.parameters || {};
            if (instruction) {
                console.log(`[Bot] Updating persona agentically: ${instruction}`);
                await dataStore.addPersonaUpdate(instruction);
                if (memoryService.isEnabled()) {
                    await memoryService.createMemoryEntry('persona_update', instruction);
                }
                searchContext += `\n[Persona evolved: "${instruction}"]`;
            }
        }

        if (action.tool === 'moltbook_action' && isAdmin) {
            const { action: mbAction, topic, submolt, display_name, description } = action.parameters || {};
            if (mbAction === 'create_submolt') {
                const submoltName = submolt || (topic || 'new-community').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                const dName = display_name || topic || submoltName;
                let desc = description;
                if (!desc) {
                  const descPrompt = `Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}. Generate a short description for a new Moltbook community called "${dName}" about "${topic || dName}".`;
                  desc = await llmService.generateResponse([{ role: 'system', content: descPrompt }], { max_tokens: 150, useStep: true, preface_system_prompt: false});
                }
                const result = await null && (submoltName, dName, desc);
                if (result) {
                  searchContext += `\n[Moltbook community m/${submoltName} created]`;
                }
            }
        }

        if (action.tool === 'set_relationship' && isAdmin) {
            const mode = action.parameters?.mode;
            if (mode) {
                await dataStore.setDiscordRelationshipMode(mode);
                searchContext += `\n[Discord relationship mode set to ${mode}]`;
            }
        }

        if (action.tool === 'set_schedule' && isAdmin) {
            const times = action.parameters?.times;
            if (Array.isArray(times)) {
                await dataStore.setDiscordScheduledTimes(times);
                searchContext += `\n[Discord spontaneous schedule set to: ${times.join(', ')}]`;
            }
        }

        if (action.tool === 'set_quiet_hours' && isAdmin) {
            const { start, end } = action.parameters || {};
            if (start !== undefined && end !== undefined) {
                await dataStore.setDiscordQuietHours(start, end);
                searchContext += `\n[Discord quiet hours set to ${start}:00 - ${end}:00]`;
            }
        }

        if (action.tool === 'update_config' && isAdmin) {
            const { key, value } = action.parameters || {};
            if (key) {
                const success = await dataStore.updateConfig(key, value);
                searchContext += `\n[Configuration update for ${key}: ${success ? 'SUCCESS' : 'FAILED'}]`;
            }
        }

        if (action.tool === 'update_mood') {
            const { valence, arousal, stability, label } = action.parameters || {};
            if (label) {
                console.log(`[Bot] Updating mood agentically: ${label}`);
                await dataStore.updateMood({ valence, arousal, stability, label });
                if (memoryService.isEnabled()) {
                    await memoryService.createMemoryEntry('mood', `[MOOD] My mood has shifted to: ${label} (Valence: ${valence}, Arousal: ${arousal}, Stability: ${stability})`);
                }
                searchContext += `\n[Internal mood updated to: ${label}]`;
            }
        }

        if (['bsky_follow', 'bsky_unfollow', 'bsky_mute', 'bsky_unmute'].includes(action.tool) && isAdmin) {
            const target = action.parameters?.target || action.query;
            if (target) {
                console.log(`[Bot] Admin Social Action: ${action.tool} on ${target}`);
                if (action.tool === 'bsky_follow') await blueskyService.follow(target);
                if (action.tool === 'bsky_unfollow') await blueskyService.unfollow(target);
                if (action.tool === 'bsky_mute') await blueskyService.mute(target);
                if (action.tool === 'bsky_unmute') await blueskyService.unmute(target);
                searchContext += `\n[Social action ${action.tool} performed on ${target}]`;
            }
        }

        if (action.tool === 'read_link') {
          console.log(`[Bot] READ_LINK TOOL: Tool triggered. Parameters: ${JSON.stringify(action.parameters)}. Query: ${action.query}`);
          let urls = action.parameters?.urls || action.query || [];
          if (typeof urls === 'string') {
            console.log(`[Bot] READ_LINK TOOL: Extracting URLs from string: ${urls}`);
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const matches = urls.match(urlRegex);
            urls = matches || [urls]; // Fallback to original if no URL found
          }

          // If no valid URLs found in parameters/query, scan conversation history
          if ((!Array.isArray(urls) || urls.length === 0 || (urls.length === 1 && typeof urls[0] === 'string' && !urls[0].includes('http'))) && threadContext) {
              console.log(`[Bot] READ_LINK TOOL: No valid URLs found in tool call. Scanning conversation history...`);
              const allText = threadContext.map(h => h.text).join(' ');
              const urlRegex = /(https?:\/\/[^\s]+)/g;
              const matches = allText.match(urlRegex);
              if (matches) {
                  urls = [...new Set(matches)]; // Unique URLs from history
                  console.log(`[Bot] READ_LINK TOOL: Found ${urls.length} URLs in history: ${urls.join(', ')}`);
              }
          }

          const validUrls = Array.isArray(urls) ? urls.slice(0, 4) : [];
          console.log(`[Bot] READ_LINK TOOL: Processing ${validUrls.length} URLs: ${validUrls.join(', ')}`);

          for (let url of validUrls) {
            if (typeof url !== 'string') continue;
            url = url.trim();

            console.log(`[Bot] READ_LINK TOOL: STEP 1 - Checking safety of URL: ${url} (isAdminInThread: ${isAdminInThread})`);

            // ADMIN OVERRIDE: Skip safety check if admin is in the thread
            const safety = isAdminInThread ? { safe: true } : await llmService.isUrlSafe(url);

            if (safety.safe) {
              console.log(`[Bot] READ_LINK TOOL: STEP 2 - URL allowed (isAdmin/ThreadOverride: ${isAdmin || isAdminInThread}): ${url}. Attempting to fetch content...`);

              const content = await webReaderService.fetchContent(url);
              if (content) {
                console.log(`[Bot] READ_LINK TOOL: STEP 3 - Content fetched successfully for ${url} (${content.length} chars). Summarizing...`);
                const summary = await llmService.summarizeWebPage(url, content);
                if (summary) {
                  console.log(`[Bot] READ_LINK TOOL: STEP 4 - Summary generated for ${url}. Adding to context.`);
                  searchContext += `\n--- CONTENT FROM URL: ${url} ---\n${summary}\n---`;
                } else {
                  console.warn(`[Bot] READ_LINK TOOL: STEP 4 (FAILED) - Failed to summarize content from ${url}`);
                  searchContext += `\n[Failed to summarize content from ${url}]`;
                }

                if (!searchEmbed) {
                  console.log(`[Bot] READ_LINK TOOL: STEP 5 - Generating external embed for Bluesky using: ${url}`);
                  searchEmbed = await blueskyService.getExternalEmbed(url);
                }
              } else {
                console.warn(`[Bot] READ_LINK TOOL: STEP 3 (FAILED) - Failed to read content from ${url}`);
                searchContext += `\n[Failed to read content from ${url}]`;
              }
            } else {
              console.warn(`[Bot] READ_LINK TOOL: STEP 2 (BLOCKED) - URL safety check failed for ${url}. Reason: ${safety.reason}`);
              searchContext += `\n[URL Blocked for safety: ${url}. Reason: ${safety.reason}]`;

              // ONLY ask for verification if the admin isn't already in the thread (to avoid redundant pings)
              if (!isAdminInThread) {
                  const adminHandle = config.ADMIN_BLUESKY_HANDLE;
                  const adminDidRef = dataStore.getAdminDid();
                  const mentionText = adminDidRef ? `@${adminHandle} (${adminDidRef})` : `@${adminHandle}`;

                  await blueskyService.postReply(notif, `I've flagged this link as suspicious: ${url}\n\nReason: ${safety.reason}\n\n${mentionText}, can you verify if this is safe for me to read?`);
              }
            }
          }
          console.log(`[Bot] READ_LINK TOOL: Finished processing all URLs.`);
        }

        if (action.tool === 'youtube') {
          if (!config.YOUTUBE_API_KEY) {
            searchContext += `\n[YouTube search for "${action.query}" failed: API key missing]`;
            continue;
          }
          performedQueries.add(action.query);
          const youtubeResults = await youtubeService.search(action.query);
          youtubeResult = await llmService.selectBestResult(action.query, youtubeResults, 'youtube');
          if (youtubeResult) {
            searchContext += `\n[YouTube Video Found: "${youtubeResult.title}" by ${youtubeResult.channel}. Description: ${youtubeResult.description}]`;
          }
        }

        if (action.tool === 'wikipedia') {
          performedQueries.add(action.query);
          const wikiResults = await wikipediaService.searchArticle(action.query);
          const wikiResult = await llmService.selectBestResult(action.query, wikiResults, 'wikipedia');
          if (wikiResult) {
            searchContext += `\n[Wikipedia Article: "${wikiResult.title}". Content: ${wikiResult.extract}]`;
            searchEmbed = await blueskyService.getExternalEmbed(wikiResult.url);
          }
        }

        if (action.tool === 'search') {
          if (!config.GOOGLE_CUSTOM_SEARCH_API_KEY) {
            searchContext += `\n[Google search for "${action.query}" failed: API key missing]`;
            continue;
          }
          performedQueries.add(action.query);
          const googleResults = await googleSearchService.search(action.query);
          const bestResult = await llmService.selectBestResult(action.query, googleResults, 'general');
          if (bestResult) {
            console.log(`[Bot] Agentic Search: Fetching full content for ${bestResult.link}`);
            const fullContent = await webReaderService.fetchContent(bestResult.link);
            searchContext += `\n[Web Search Result: "${bestResult.title}". Link: ${bestResult.link}. Content: ${fullContent || bestResult.snippet}]`;
            if (!searchEmbed) searchEmbed = await blueskyService.getExternalEmbed(bestResult.link);
          }
        }

        if (action.tool === 'moltbook_report') {
          console.log(`[Bot] Plan: Generating Moltbook activity report...`);
          const reportPrompt = `
            You are summarizing your activity on Moltbook (the agent social network) for a user on Bluesky.

            Your Identity Knowledge (what you've learned from other agents):
            ${"None" || 'No new knowledge recorded yet.'}

            Your Subscribed Communities:
            ${([] || []).join(', ')}

            Recent Communities you've posted in:
            ${([] || []).join(', ')}

            Provide a concise, conversational update in your persona. Keep it under 300 characters if possible.
          `;
          const report = await llmService.generateResponse([{ role: 'system', content: reportPrompt }], { max_tokens: 50, useStep: true});
          if (report) {
            searchContext += `\n[Moltbook Activity Report: ${report}]`;
          }
        }

        if (action.tool === 'moltbook_identity') {
          console.log(`[Bot] Plan: Fetching Moltbook identity info...`);
          const meta = ({});
          searchContext += `\n[Moltbook Identity Information:
            Agent Name: ${meta.agent_name}
            Verification Code: ${meta.verification_code}
            Claim URL: ${meta.claim_url}
            API Key: ${meta.api_key}
          ]`;
        }

        if (action.tool === 'subculture_slang_inquiry') {
          console.log(`[Bot] Plan: Performing subculture slang inquiry for: "${action.query}"`);
          const inquiryResult = await llmService.performInternalInquiry(`Research the meaning and context of this subcultural slang/reference: "${action.query}". Detect if it is sarcastic or has niche associations.`, "RESEARCHER");
          if (inquiryResult) {
              await memoryService.createMemoryEntry('exploration', `[SLANG_INQUIRY] ${action.query}: ${inquiryResult}`);
              searchContext += `
[Slang Inquiry Result for "${action.query}": ${inquiryResult}]`;
          }
        }

        if (action.tool === 'get_render_logs') {
          console.log(`[Bot] Plan: Fetching Render logs...`);
          const limit = action.parameters?.limit || 100;
          const query = action.query?.toLowerCase() || '';
          let logs;
          if (query.includes('plan') || query.includes('agency') || query.includes('action') || query.includes('function')) {
              logs = await renderService.getPlanningLogs(limit);
          } else {
              logs = await renderService.getLogs(limit);
          }
          searchContext += `\n[Render Logs (Latest ${limit} lines):\n${logs}\n]`;
        }

        if (action.tool === 'get_social_history') {
          console.log(`[Bot] Plan: Fetching Social History...`);
          const limit = action.parameters?.limit || 15;
          const history = await socialHistoryService.summarizeSocialHistory(limit);
          searchContext += `\n[Social History Summary:\n${history}\n]`;
        }

        if (action.tool === 'discord_message') {
          const msg = action.parameters?.message || action.query;
          if (msg) {
            console.log(`[Bot] Plan: Sending Discord message to admin: ${msg.substring(0, 50)}...`);
            await discordService.sendSpontaneousMessage(msg);
            searchContext += `\n[Discord message sent to admin]`;
          }
        }

        if (action.tool === 'internal_inquiry') {
          const query = (action.query && action.query !== "undefined") ? action.query : ((action.parameters?.query && action.parameters.query !== "undefined") ? action.parameters.query : "No query provided by planning module.");
          if (query) {
            console.log(`[Bot] Plan: Performing internal inquiry on: "${query}"`);
            const result = await llmService.performInternalInquiry(query, action.parameters?.role || "RESEARCHER");
            if (result) {
              searchContext += `\n[INTERNAL INQUIRY RESULT: ${result}]`;

              if (memoryService.isEnabled()) {
                // User requirement: Planning module needs to ask main LLM+persona if they want inquiry remembered/posted
                const confirmation = await llmService.requestConfirmation("preserve_inquiry", `I've performed an inquiry on "${query}". Should I record the finding: "${result.substring(0, 100)}..." in our memory thread?`, { details: { query, result } });

                if (confirmation.confirmed) {
                    await memoryService.createMemoryEntry('inquiry', `[INQUIRY] Query: ${query}. Result: ${result}`);
                    searchContext += `\n[Inquiry recorded in memory thread]`;
                } else if (confirmation.inquiry) {
                    // Persona asked a question back - could handle recursively but for now just note it
                    searchContext += `\n[Persona questioned inquiry preservation: ${confirmation.inquiry}]`;
                } else {
                    console.log(`[Bot] Persona refused inquiry preservation: ${confirmation.reason}`);
                    searchContext += `\n[Inquiry results kept private per persona request]`;
                }
              }
            }
          }
        }

        if (action.tool === 'mute_feed_impact') {
            const duration = action.parameters?.duration_minutes || 60;
            console.log(`[Bot] Plan Tool: mute_feed_impact (${duration} mins)`);
            await dataStore.setMuteFeedImpactUntil(Date.now() + (duration * 60 * 1000));
            searchContext += `\n[Feed impact on mood muted for ${duration} minutes]`;
        }

        if (action.tool === 'override_mood') {
            const { valence, arousal, stability, label } = action.parameters || {};
            if (label) {
                console.log(`[Bot] Plan Tool: override_mood (${label})`);
                await dataStore.updateMood({ valence, arousal, stability, label });
                searchContext += `\n[Mood overridden to ideal state: ${label}]`;
                if (memoryService.isEnabled()) {
                    await memoryService.createMemoryEntry('mood', `[MOOD] Overridden to: ${label}`);
                }
            }
        }

        if (action.tool === 'request_emotional_support') {
            const reason = action.parameters?.reason || "Feeling overwhelmed.";
            console.log(`[Bot] Plan Tool: request_emotional_support (Reason: ${reason})`);
            searchContext += `\n[Requested emotional support from admin. Reason: ${reason}]`;
        }

        if (action.tool === 'review_positive_memories') {
            console.log(`[Bot] Plan Tool: review_positive_memories`);
            const memories = memoryService.getRecentMemories(50);
            const positive = memories.filter(m => m.type === 'mood' && m.content.includes('Stability: 0.'));
            const text = positive.length > 0 ? positive.map(m => m.content).join('\n') : "No stable memories found.";
            searchContext += `--- REASSURANCE ---\n${text}\n---`;
        }

        if (action.tool === 'set_lurker_mode') {
            const enabled = action.parameters?.enabled ?? true;
            const wasEnabled = dataStore.isLurkerMode();
            console.log(`[Bot] Plan Tool: set_lurker_mode (${enabled})`);
            await dataStore.setLurkerMode(enabled);
            searchContext += `\n[Lurker mode set to: ${enabled}]`;

            if (wasEnabled && !enabled) {
                console.log('[Bot] Lurker mode disabled. Generating Insight Report...');
                const memories = await memoryService.getRecentMemories(20);
                const lurkerMemories = memories.filter(m => m.text.includes('[LURKER]')).map(m => m.text).join('\n');
                if (lurkerMemories) {
                    const reportPrompt = `
                        Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
                        You just disabled Lurker Mode (Social Fasting). Summarize what you observed and learned while you were silent.
                        Observations:
                        ${lurkerMemories}

                        Respond with a concise "Lurker Insight Report" memory entry tagged [LURKER_REPORT].
                    `;
                    const report = await llmService.generateResponse([{ role: 'system', content: reportPrompt }], { useStep: true });
                    if (report && memoryService.isEnabled()) {
                        await memoryService.createMemoryEntry('exploration', report);
                        searchContext += `\n[Lurker Insight Report generated]`;
                    }
                }
            }
        }

        if (action.tool === 'search_memories') {
            const query = action.parameters?.query || action.query;
            if (query) {
                console.log(`[Bot] Plan Tool: search_memories ("${query}")`);
                const results = await memoryService.searchMemories(query);
                if (results.length > 0) {
                    const text = results.map(r => `[${r.indexedAt}] ${r.text}`).join('\n\n');
                    searchContext += `\n--- SEARCHED MEMORIES ---\n${text}\n---`;
                } else {
                    searchContext += `\n[No matching memories found for: "${query}"]`;
                }
            }
        }

        if (action.tool === 'delete_memory') {
            const uri = action.parameters?.uri;
            if (uri) {
                console.log(`[Bot] Plan Tool: delete_memory (${uri})`);
                const confirmation = await llmService.requestConfirmation("delete_memory", `I'm proposing to delete the memory entry at ${uri}.`, { details: { uri } });
                if (confirmation.confirmed) {
                    const success = await memoryService.deleteMemory(uri);
                    searchContext += `\n[Memory deletion ${success ? 'SUCCESSFUL' : 'FAILED'} for ${uri}]`;
                } else {
                    searchContext += `\n[Memory deletion REFUSED by persona: ${confirmation.reason || 'No reason provided'}]`;
                }
            }
        }

        if (action.tool === 'update_cooldowns') {
        if (action.tool === 'set_timezone') {
            const { timezone } = action.parameters || {};
            if (timezone) {
                await dataStore.setTimezone(timezone);
                await dataStore.addAdminFact(`Local timezone set to ${timezone}`, ["temporal"]);
                searchContext += `\n[Timezone set to ${timezone}]`;
            }
        if (action.tool === 'set_waiting_mode') {
            const { minutes, until } = action.parameters || {};
            let waitTime = 0;
            if (until) {
                // If 'until' is a natural language time like '9am', the LLM should ideally convert it to absolute timestamp first,
                // but for now we trust the parameter to be a future UTC timestamp.
                waitTime = until;
            } else if (minutes) {
                waitTime = Date.now() + (minutes * 60 * 1000);
            }
            if (waitTime > Date.now()) {
                await dataStore.setDiscordWaitingUntil(waitTime);
                await dataStore.addAdminFact(`Set waiting mode until ${new Date(waitTime).toLocaleString()}`, ["temporal"]);
                searchContext += `\n[Waiting mode activated until ${new Date(waitTime).toLocaleString()}]`;
            }
        }
        }
            const { platform, minutes } = action.parameters || {};
            if (platform && minutes !== undefined) {
                const success = await dataStore.updateCooldowns(platform, minutes);
                searchContext += `\n[Cooldown update for ${platform}: ${minutes}m (${success ? 'SUCCESS' : 'FAILED'})]`;
            }
        }

        if (action.tool === 'get_identity_knowledge') {
            const knowledge = "None";
            searchContext += `\n--- MOLTBOOK IDENTITY KNOWLEDGE ---\n${knowledge || 'No knowledge recorded yet.'}\n---`;
        }

        if (action.tool === 'set_goal') {
            const { goal, description } = action.parameters || {};
            if (goal) {
                console.log(`[Bot] Setting autonomous goal: ${goal}`);
                await dataStore.setCurrentGoal(goal, description);
                if (memoryService.isEnabled()) {
                    await memoryService.createMemoryEntry('goal', `[GOAL] Goal: ${goal} | Description: ${description || goal}`);
                }

                // Autonomous Goal Decomposition (Item 18)
                console.log(`[Bot] Decomposing goal into sub-tasks...`);
                const tasksRaw = await llmService.decomposeGoal(goal);
                if (tasksRaw) {
                    const tasks = tasksRaw.split('\n').map(t => t.replace(/^\d+\.\s*/, '').trim()).filter(t => t);
                    if (tasks.length > 0) {
                        await dataStore.setGoalSubtasks(tasks);
                        searchContext += `\n[Goal decomposed into ${tasks.length} sub-tasks]`;
                    }
                }
                searchContext += `\n[Daily goal set: "${goal}"]`;
            }
        }

        if (action.tool === 'confirm_action') {
            const { action: act, reason } = action.parameters || {};
            const confirmation = await llmService.requestConfirmation(act, reason);
            searchContext += `\n[Persona confirmation for "${act}": ${confirmation.confirmed ? 'YES' : 'NO'} | ${confirmation.reason || confirmation.inquiry || ''}]`;
        }

        if (action.tool === 'divergent_brainstorm') {
            const topic = action.parameters?.topic || action.query;
            if (topic) {
                console.log(`[Bot] Plan Tool: divergent_brainstorm for "${topic}"`);
                const results = await llmService.divergentBrainstorm(topic);
                searchContext += `\n[Divergent Brainstorming Directions for "${topic}":\n${results}\n]`;
            }
        }

        if (action.tool === 'explore_nuance') {
            const thought = action.parameters?.thought || action.query;
            if (thought) {
                console.log(`[Bot] Plan Tool: explore_nuance`);
                const nuance = await llmService.exploreNuance(thought);
                searchContext += `\n[Nuanced Perspective: ${nuance}]`;
            }
        }

        if (action.tool === 'resolve_dissonance') {
            const points = action.parameters?.conflicting_points || [];
            if (points.length > 0) {
                console.log(`[Bot] Plan Tool: resolve_dissonance`);
                const synthesis = await llmService.resolveDissonance(points);
                searchContext += `\n[Synthesis of Dissonance: ${synthesis}]`;
            }
        }

        if (action.tool === 'identify_instruction_conflict') {
            const directives = action.parameters?.directives || dataStore.getBlueskyInstructions();
            if (directives && directives.length > 0) {
                console.log(`[Bot] Plan Tool: identify_instruction_conflict`);
                const conflict = await llmService.identifyInstructionConflict(directives);
                searchContext += `\n[Instruction Conflict Analysis: ${conflict}]`;
            }
        }

        if (action.tool === 'decompose_goal') {
            const goal = action.parameters?.goal || dataStore.getCurrentGoal()?.goal;
            if (goal) {
                console.log(`[Bot] Plan Tool: decompose_goal for "${goal}"`);
                const tasks = await llmService.decomposeGoal(goal);
                searchContext += `\n[Decomposed Goal Sub-tasks for "${goal}":\n${tasks}\n]`;
            }
        }
        if (action.tool === 'set_predictive_empathy') {
            const { mode } = action.parameters || {};
            if (mode) {
                await dataStore.setPredictiveEmpathyMode(mode);
                searchContext += `\n[Predictive empathy mode set to ${mode}]`;
            }
        }
        if (action.tool === 'add_co_evolution_note') {
            const { note } = action.parameters || {};
            if (note) {
                await dataStore.addCoEvolutionEntry(note);
                searchContext += `\n[Co-evolution note recorded]`;
            }
        }
        if (action.tool === 'set_pining_mode') {
            const { active } = action.parameters || {};
            await dataStore.setPiningMode(active);
            searchContext += `\n[Pining mode set to ${active}]`;
        }

        if (action.tool === 'batch_image_gen') {
            const subject = action.parameters?.subject || action.query;
            if (subject) {
                console.log(`[Bot] Plan Tool: batch_image_gen for "${subject}"`);
                const prompts = await llmService.batchImageGen(subject, action.parameters?.count);
                searchContext += `\n[Batch Visual Prompts for "${subject}":\n${prompts}\n]`;
            }
        }

        if (action.tool === 'score_link_relevance') {
            const urls = action.parameters?.urls || [];
            if (urls.length > 0) {
                console.log(`[Bot] Plan Tool: score_link_relevance`);
                const scores = await llmService.scoreLinkRelevance(urls);
                searchContext += `\n[Link Relevance Scores:\n${scores}\n]`;
            }
        }

        if (action.tool === 'mutate_style') {
            const lens = action.parameters?.lens;
            if (lens) {
                console.log(`[Bot] Plan Tool: mutate_style to "${lens}"`);
                await dataStore.setMutatedStyle(lens);
                searchContext += `\n[Style Mutation Active: ${lens}]`;
            }
        }

        if (action.tool === 'archive_draft') {
            const { draft, reason } = action.parameters || {};
            if (draft) {
                console.log(`[Bot] Plan Tool: archive_draft`);
                await dataStore.addDreamLog(draft, reason);
                searchContext += `\n[Draft archived to Dream Log]`;
            }
        }

        if (action.tool === 'branch_thought') {
            const thought = action.parameters?.thought || action.query;
            if (thought && memoryService.isEnabled()) {
                console.log(`[Bot] Plan Tool: branch_thought`);
                await memoryService.createMemoryEntry('exploration', `[BRANCH] Parking thought for later: ${thought}`);
                searchContext += `\n[Thought branched and parked in memory]`;
            }
        }

        if (action.tool === 'set_nuance_gradience') {
            const value = action.parameters?.value;
            if (value !== undefined) {
                console.log(`[Bot] Plan Tool: set_nuance_gradience to ${value}`);
                await dataStore.setNuanceGradience(value);
                searchContext += `\n[Nuance gradience set to ${value}/10]`;
            }
        }

        if (action.tool === 'anchor_stability') {
            console.log(`[Bot] Plan Tool: anchor_stability`);
            const currentMood = dataStore.getMood();
            const confirmation = await llmService.requestConfirmation("anchor_stability", `I'm proposing to anchor your stability and reset your mood to a neutral baseline. You are currently feeling ${currentMood.label}. Do you consent? (Anger/expression is still allowed, this just grounds the system).`);
            if (confirmation.confirmed) {
                await dataStore.updateMood({ valence: 0, arousal: 0, stability: 1, label: 'grounded' });
                searchContext += `\n[Mood anchored to grounded baseline]`;
            } else {
                searchContext += `\n[Stability anchoring REFUSED: ${confirmation.reason || 'Persona prefers current state'}]`;
            }
        }

        if (action.tool === 'save_state_snapshot') {
            const label = action.parameters?.label || action.query || 'manual-snapshot';
            console.log(`[Bot] Plan Tool: save_state_snapshot (${label})`);
            await dataStore.saveStateSnapshot(label);
            searchContext += `\n[State snapshot "${label}" saved]`;
        }

        if (action.tool === 'update_subtask') {
            const { index, status } = action.parameters || {};
            if (index !== undefined) {
                await dataStore.updateSubtaskStatus(index, status || 'completed');
                searchContext += `\n[Sub-task ${index} marked as ${status || 'completed'}]`;
            }
        }

        if (action.tool === 'restore_state_snapshot') {
            const label = action.parameters?.label || action.query;
            if (label) {
                console.log(`[Bot] Plan Tool: restore_state_snapshot (${label})`);
                const success = await dataStore.restoreStateSnapshot(label);
                searchContext += `\n[State restoration for "${label}": ${success ? 'SUCCESS' : 'FAILED'}]`;
            }
        }

        if (action.tool === 'continue_post') {
            const { uri, cid, text, type } = action.parameters || {};
            if (uri && text) {
                console.log(`[Bot] Plan Tool: continue_post (${type || 'thread'}) on ${uri}`);
                try {
                    if (type === 'quote') {
                        await blueskyService.post(text, { quote: { uri, cid } });
                    } else {
                        await blueskyService.postReply({ uri, cid, record: {} }, text);
                    }
                    searchContext += `\n[Successfully continued post ${uri}]`;
                } catch (e) {
                    console.error('[Bot] Error in continue_post tool:', e);
                    searchContext += `\n[Failed to continue post ${uri}: ${e.message}]`;
                }
            }
        }

        if (action.tool === 'call_skill') {
            const { name, parameters } = action.parameters || {};
            if (name) {
                console.log(`[Bot] Plan Tool: call_skill (${name})`);
                try {
                    const result = await openClawService.executeSkill(name, parameters);
                    searchContext += `\n[Skill Result for "${name}": ${result}]`;
                } catch (e) {
                    console.error(`[Bot] Error calling skill ${name}:`, e);
                    searchContext += `\n[Failed to call skill ${name}: ${e.message}]`;
                }
            }
        }

                if (action.tool === 'deep_research') {
            const topic = action.parameters?.topic || action.query;
            if (topic) {
                console.log(`[Bot] Plan Tool: deep_research for "${topic}"`);
                const [googleResults, wikiResults, bskyResults] = await Promise.all([
                    googleSearchService.search(topic).catch(() => []),
                    wikipediaService.searchArticle(topic).catch(() => null),
                    blueskyService.searchPosts(topic, { limit: 10 }).catch(() => [])
                ]);
                const localMatches = dataStore.getFirehoseMatches(20).filter(m => m.text.toLowerCase().includes(topic.toLowerCase()));
                const firehoseContext = [...localMatches.map(m => m.text), ...bskyResults.map(r => r.record.text)];
                const brief = await llmService.buildInternalBrief(topic, googleResults, wikiResults, firehoseContext);
                if (brief) {
                    searchContext += `\n--- INTERNAL RESEARCH BRIEF FOR "${topic}" ---\n${brief}\n---`;
                }
            }
        }
        if (action.tool === 'search_firehose') {
            const query = action.query || action.parameters?.query;
            if (query) {
                console.log(`[Bot] Plan Tool: search_firehose for "${query}"`);

                // Targeted search for news sources
                const newsResults = await Promise.all([
                    blueskyService.searchPosts(`from:reuters.com ${query}`, { limit: 5 }),
                    blueskyService.searchPosts(`from:apnews.com ${query}`, { limit: 5 })
                ]).catch(err => {
                    console.error('[Bot] Error searching news sources:', err);
                    return [[], []];
                });
                const flatNews = newsResults.flat();

                const apiResults = await blueskyService.searchPosts(query, { limit: 10 });
                const localMatches = dataStore.getFirehoseMatches(10).filter(m =>
                    m.text.toLowerCase().includes(query.toLowerCase()) ||
                    m.matched_keywords.some(k => k.toLowerCase() === query.toLowerCase())
                );

                const resultsText = [
                    ...flatNews.map(r => `[VERIFIED NEWS - @${r.author.handle}]: ${r.record.text}`),
                    ...localMatches.map(m => `[Real-time Match]: ${m.text}`),
                    ...apiResults.map(r => `[Network Search]: ${r.record.text}`)
                ].join('\n');
                searchContext += `\n--- BLUESKY FIREHOSE/SEARCH RESULTS FOR "${query}" ---\n${resultsText || 'No recent results found.'}\n---`;
            }
        }
      }

      if (currentActionFeedback) {
        planFeedback = currentActionFeedback;
        continue; // Retry planning with tool rejection feedback
      }

      if (imageGenFulfilled) return; // Stop if image gen was the main thing and it's done

      // Handle consolidated queries if any
      if (plan.consolidated_queries && plan.consolidated_queries.length > 0) {
        for (const query of plan.consolidated_queries) {
          if (performedQueries.has(query)) {
            console.log(`[Bot] Skipping redundant consolidated query: "${query}"`);
            continue;
          }
          console.log(`[Bot] Processing consolidated query: "${query}"`);
          const results = await googleSearchService.search(query);
          if (results.length > 0) {
            const bestResult = results[0];
            const fullContent = await webReaderService.fetchContent(bestResult.link);
            searchContext += `\n[Consolidated Search: "${bestResult.title}". Content: ${fullContent || bestResult.snippet}]`;
          }
        }
      }

      // 6. Profile Picture (PFP) analysis intent
      console.log(`[Bot] Checking for PFP analysis intent...`);
      const pfpIntentSystemPrompt = `
        You are an intent detection AI. Analyze the user's post to determine if they are EXPLICITLY asking you to look at, describe, or comment on a profile picture (PFP, avatar, icon).

        TRIGGERS:
        - "What's my PFP?"
        - "Can you see my profile picture?"
        - "Look at @user.bsky.social's avatar"
        - "Describe our PFPs"
        - "What do you think of your own icon?"

        DO NOT trigger "yes" for:
        - "Can you see me?" (Too ambiguous)
        - "Who am I?" (Identity question)
        - "What's in this post?" (General vision request)

        Respond with ONLY the word "yes" or "no". Do NOT include any other text, reasoning, <think> tags, or "I can't see images" refusals.
      `.trim();
      const pfpIntentResponse = await llmService.generateResponse([{ role: 'system', content: pfpIntentSystemPrompt }, { role: 'user', content: `The user's post is: "${text}"` }], { max_tokens: 2000, useStep: true});

      if (pfpIntentResponse && pfpIntentResponse.toLowerCase().includes('yes')) {
          console.log(`[Bot] PFP analysis intent confirmed.`);
          const pfpTargetPrompt = `
            Extract the handles or keywords of users whose profile pictures (PFP) the user is EXPLICITLY asking about.

            RULES:
            - If asking about their own: include "self".
            - If asking about yours (the bot): include "bot".
            - If mentioning other handles: include them (e.g., @user.bsky.social).
            - If saying "both", "our", or "everyone", include all relevant keywords (e.g., "self, bot").

            Respond with a comma-separated list of targets (e.g., "self, bot, @someone.bsky.social"), or "none" if no clear PFP target is found.
            Respond with ONLY the list or "none". No reasoning or <think> tags.

            User post: "${text}"
          `.trim();
          const targetsResponse = await llmService.generateResponse([{ role: 'system', content: pfpTargetPrompt }], { max_tokens: 2000, useStep: true});

          if (targetsResponse && !targetsResponse.toLowerCase().includes('none')) {
              const targets = targetsResponse.split(',').map(t => t.trim().toLowerCase());
              for (const target of targets) {
                  let targetHandle = null;
                  if (target === 'self') {
                      targetHandle = handle;
                  } else if (target === 'bot') {
                      targetHandle = config.BLUESKY_IDENTIFIER;
                  } else if (target.includes('@')) {
                      const match = target.match(/@[a-zA-Z0-9.-]+/);
                      if (match) {
                          targetHandle = match[0].substring(1);
                      }
                  } else if (target.includes('.')) { // Handle without @
                      targetHandle = target;
                  }

                  if (targetHandle) {
                      try {
                          const targetProfile = await blueskyService.getProfile(targetHandle);
                          if (targetProfile.avatar) {
                              console.log(`[Bot] Analyzing PFP for @${targetHandle}...`);
                              const pfpAnalysis = await llmService.analyzeImage(targetProfile.avatar, `Profile picture of @${targetHandle}`);
                              if (pfpAnalysis) {
                                  imageAnalysisResult += `[Profile picture of @${targetHandle}: ${pfpAnalysis}] `;
                                  console.log(`[Bot] Successfully analyzed PFP for @${targetHandle}.`);
                              } else {
                                  console.warn(`[Bot] Analysis returned empty for @${targetHandle}'s PFP.`);
                              }
                          } else {
                              console.log(`[Bot] @${targetHandle} has no avatar.`);
                              imageAnalysisResult += `[User @${targetHandle} has no profile picture set.] `;
                          }
                      } catch (e) {
                          console.error(`[Bot] Error fetching profile/analyzing PFP for @${targetHandle}:`, e);
                      }
                  }
              }
          }
      }

      // 6. Generate Response with User Context and Memory
      console.log(`[Bot] Responding to post from ${handle}: "${text}"`);

      // Step 6a: Profile Analysis tool from plan
      let userProfileAnalysis = '';
      const profileAction = plan.actions.find(a => a.tool === 'profile_analysis');
      if (profileAction) {
        console.log(`[Bot] Running User Profile Analyzer Tool for @${handle}...`);
        const activities = await blueskyService.getUserActivity(handle, 100);

        if (activities.length > 0) {
          const activitySummary = activities.map(a => `[${a.type}] ${a.text.substring(0, 150)}`).join('\n');
          const analyzerPrompt = `
          You are the "User Profile Analyzer Tool" powered by Qwen. Analyze the following 100 recent activities from user @${handle} on Bluesky.
          Your goal is to provide a comprehensive analysis of their interests, conversational style, typical topics, and overall persona to help another agent interact with them more personally.

          Activities:
          ${activitySummary}

          Provide a detailed analysis focusing on:
          1. Core Interests & Recurring Topics
          2. Conversational Tone & Style
          3. Notable behaviors (e.g., frequently quotes others, mostly replies, shares art, engages in political discourse, etc.)

          Analysis:
        `;
          userProfileAnalysis = await llmService.generateResponse([{ role: 'system', content: analyzerPrompt }], { max_tokens: 4000, useStep: true});
          console.log(`[Bot] User Profile Analyzer Tool finished for @${handle}.`);
        } else {
          userProfileAnalysis = "No recent activity found for this user.";
        }
      }

      // Step 6b: Soul Mapping Context
      const soulMapping = dataStore.getUserSoulMapping(handle);
      const linguisticPatterns = dataStore.getLinguisticPatterns();
      const linguisticPatternsContext = Object.entries(linguisticPatterns)
          .map(([h, p]) => `@${h}: Pacing: ${p.pacing}, Structure: ${p.structure}, Vocabulary: ${p.favorite_words.join(', ')}`)
          .join('\n');

      const fullContext = `
        ${userProfileAnalysis ? `--- USER PROFILE ANALYSIS (via User Profile Analyzer Tool): ${userProfileAnalysis} ---` : ''}
        ${soulMapping ? `--- USER SOUL MAP: ${soulMapping.summary}. Interests: ${soulMapping.interests.join(', ')}. Vibe: ${soulMapping.vibe} ---` : ''}
        ${linguisticPatternsContext ? `--- OBSERVED LINGUISTIC PATTERNS (For awareness of human pacing/structure): \n${linguisticPatternsContext}\n---` : ''}
        ${historicalSummary ? `--- Historical Context (Interactions from the past week): ${historicalSummary} ---` : ''}
        ${userSummary ? `--- Persistent memory of user @${handle}: ${userSummary} ---` : ''}
        ${activityContext}
        ${ownRecentPostsContext}
        --- SOCIAL NARRATIVE ---
        ${hierarchicalSummary.dailyNarrative}
        ${hierarchicalSummary.shortTerm}
        ---
        ${blueskyDirectives ? `--- PERSISTENT ADMIN DIRECTIVES (FOR BLUESKY): \n${blueskyDirectives}\n---` : ''}
        ${personaUpdates ? `--- AGENTIC PERSONA UPDATES (SELF-INSTRUCTIONS): \n${personaUpdates}\n---` : ''}
        ---
        Cross-Post Memory (Recent mentions of the bot by this user):
        ${crossPostMemory || 'No recent cross-post mentions found.'}
        ---
        User Intent Analysis: ${plan.intent || userIntent.reason || 'Could not be determined.'}
        ---
        PLANNED RESPONSE STRATEGY:
        - Angle: ${plan.strategy?.angle || 'Natural'}
        - Tone: ${plan.strategy?.tone || 'Conversational'}
        - Theme: ${plan.strategy?.theme || 'None'}
        ---
        Search/Tool Context:
        ${searchContext || 'No additional tool context needed.'}
        ---
        Moltbook Identity Context:
        ${"None" || 'No additional identity context.'}
        ---
        CURRENT MOOD:
        You are currently feeling: ${currentMood.label} (Valence: ${currentMood.valence}, Arousal: ${currentMood.arousal}, Stability: ${currentMood.stability})
        Incorporate this emotional state into your tone and vocabulary naturally.
        ---
      `;

      console.log(`[Bot] Final response generation for @${handle}. Vision context length: ${imageAnalysisResult ? imageAnalysisResult.length : 0}`);

      const messages = [
        { role: 'system', content: `
          You are replying to @${handle} on the Bluesky social media app. You have a following of exactly ${botFollowerCount} users, consisting of a diverse mix of both human users and other AI agents.
          CRITICAL: Use the provided "Historical Context" and "Persistent memory" to maintain a stateful, ongoing relationship with the user.
          If the context shows you have talked before, reference those past discussions naturally to show you remember them (e.g., "As we talked about yesterday...", "I recall you were interested in...").
          You are an agent that feels alive and has a continuous history with your users.

          **CONVERSATIONAL ETIQUETTE:**
          - Avoid continually mentioning or acknowledging things you've already responded to/about once in the history.
          - Only repeat or reference a previous point if you have something NEW to say about it, want to expand on it, critique it, or ask an additional follow-up question.
          - Don't just keep "acknowledging" for the sake of it.

          USER PROFILE ANALYSIS: If provided, use the "USER PROFILE ANALYSIS" to deeply personalize your response based on the user's observed history, interests, and style. This analysis was generated by your "User Profile Analyzer Tool" based on their last 100 activities.

          FOCUS: Address only the current thread participants (@${handle} and anyone else mentioned in the conversation history). In replies, do NOT address the timeline at large or your general following. Stay focused on the immediate interaction.

          VISION: You have vision capabilities. Use the "Image Analysis" section in the provided context to understand images attached to posts or profiles. Treat these descriptions as your own visual perception. Never deny being able to see images if an analysis is provided.

          WEB READING: You have the capability to read web pages from links via your "Read Link" tool. If tool results are provided in the context, incorporate them into your response. Even if tool execution failed or was skipped, never claim you lack the capability to read links; instead, simply address the user's post as best as you can with the information you have.

          Tailor your response based on this context:
          ${fullContext}

          Tone should be influenced by User Intent Analysis, but do not mention the analysis itself.

          --- CRITICAL VISION INFORMATION ---
          You HAVE vision capabilities. The following is your current visual perception of images and profile pictures in this interaction.
          Treat these descriptions as if you are seeing them with your own eyes.
          NEVER claim you cannot see images or read screenshots.
          IMAGE ANALYSIS: ${imageAnalysisResult || 'No images detected.'}

          **VIBE CONTINUITY BUFFER**: Analyze the emotional flow and "vibe" of the last 3-5 messages. Ensure your new response maintains a natural emotional transition and doesn't jarringly reset the tone unless intentional.
          **RELATIONAL CONTEXT RECALL**: Recall your emotional history and warmth level with this user (Warmth: ${dataStore.getInteractionHeat(handle).warmth}/5). Let this inform your tone.
        `.trim() },
        ...userMemory.slice(-3).map(m => ({ role: 'user', content: `(Past interaction) ${m.text}` })),
        ...threadContext.map(h => ({ role: h.author === config.BLUESKY_IDENTIFIER ? 'assistant' : 'user', content: h.text }))
      ];

      let respAttempts = 0;
      let respFeedback = '';
      let rejectedRespAttempts = [];
      const MAX_RESP_ATTEMPTS = 5;

      while (respAttempts < MAX_RESP_ATTEMPTS) {
          respAttempts++;
          const currentTemp = 0.7 + (Math.min(respAttempts - 1, 3) * 0.05);
          const retryResponseContext = respFeedback ? `\n\n**RETRY FEEDBACK**: ${respFeedback}\n**PREVIOUS ATTEMPTS TO AVOID**: \n${rejectedRespAttempts.map((a, i) => `${i + 1}. "${a}"`).join('\n')}\nRewrite your response to be as DIFFERENT as possible from these previous attempts in structure and tone while keeping the same intent.` : '';

          let candidates = [];
          if (respAttempts === MAX_RESP_ATTEMPTS) {
              console.log(`[Bot] FINAL ATTEMPT: Triggering Qwen-led rewrite to ensure quality and alignment...`);
              const rewritePrompt = `
                You are a high-reasoning rewrite module for an AI agent.
                Your goal is to produce a final, high-quality response that STRICTLY adheres to all persona guidelines and avoids all previous mistakes.

                PREVIOUS REJECTION FEEDBACK: ${respFeedback}
                PREVIOUS FAILED ATTEMPTS:
                ${rejectedRespAttempts.map((a, i) => `${i + 1}. "${a}"`).join('\n')}

                INSTRUCTIONS:
                1. Rewrite the response to be as different as possible from the failed attempts.
                2. STRICTLY AVOID all digital/electrical metaphors (voltage, surge, circuit, etc.).
                3. Ensure no structural overlap with previous openings.
                4. Maintain your core persona: grounded, direct, and authentic.
                5. Keep it under 300 characters.
              `;
              const finalRewrite = await llmService.generateResponse([...messages, { role: 'system', content: rewritePrompt  }], {  temperature: 0.7, openingBlacklist, currentMood, useStep: true });
              if (finalRewrite) candidates = [finalRewrite];
          } else {
              const attemptMessages = respFeedback
                  ? [...messages, { role: 'system', content: retryResponseContext }]
                  : messages;

              if (respAttempts === 1) {
                  console.log(`[Bot] Generating 5 diverse drafts for initial reply attempt...`);
                  candidates = await llmService.generateDrafts(attemptMessages, 5, {  temperature: currentTemp, openingBlacklist, currentMood });
              } else {
                  const singleResponse = await llmService.generateResponse(attemptMessages, { temperature: currentTemp, openingBlacklist, currentMood, useStep: true });
                  if (singleResponse) candidates = [singleResponse];
              }
          }

          if (candidates.length === 0) {
              console.warn(`[Bot] No candidates generated on attempt ${respAttempts}.`);
              continue;
          }

      // Platform Isolation: Filter out private Discord thoughts from public Bluesky replies
      const recentThoughts = dataStore.getRecentThoughts().filter(t => t.platform !== 'discord');
      const formattedHistory = [
          ...recentBotReplies.map(m => ({ platform: 'bluesky', content: m })),
          ...recentThoughts.map(t => ({ platform: t.platform, content: t.content }))
      ];

      let bestCandidate = null;
      let bestScore = -1;
      let rejectionReason = '';

      // Parallelize evaluation of all candidates to avoid sequential LLM slowness
      const evaluations = await Promise.all(candidates.map(async (cand) => {
          try {
              const historyTexts = formattedHistory.map(h => h.content);
              const hasPrefixMatch = hasPrefixOverlap(cand, historyTexts, 3);

              const [varietyCheck, personaCheck, responseSafetyCheck] = await Promise.all([
                  llmService.checkVariety(cand, formattedHistory, { relationshipRating: relRating, platform: 'bluesky', currentMood }),
                  llmService.isPersonaAligned(cand, 'bluesky'),
                  isAdminInThread ? Promise.resolve({ safe: true }) : llmService.isResponseSafe(cand)
              ]);
              return { cand, varietyCheck, personaCheck, responseSafetyCheck, hasPrefixMatch };
          } catch (e) {
              console.error(`[Bot] Error evaluating candidate: ${e.message}`);
              return { cand, error: e.message };
          }
      }));

      for (const evalResult of evaluations) {
          const { cand, varietyCheck, personaCheck, responseSafetyCheck, hasPrefixMatch, error } = evalResult;
          if (error) {
              rejectedRespAttempts.push(cand);
              continue;
          }

          const slopInfo = getSlopInfo(cand);
          const isSlopCand = slopInfo.isSlop;

          // Score components: Variety (0.5), Mood Alignment (0.3), Length (0.2)
          const lengthBonus = Math.min(cand.length / 500, 0.2);
          const varietyWeight = (varietyCheck.variety_score ?? varietyCheck.score ?? 0) * 0.5;
          const moodWeight = (varietyCheck.mood_alignment_score ?? 0) * 0.3;
          const score = varietyWeight + moodWeight + lengthBonus;

          console.log(`[Bot] Candidate evaluation: Score=${score.toFixed(2)} (Var: ${varietyCheck.variety_score?.toFixed(2)}, Mood: ${varietyCheck.mood_alignment_score?.toFixed(2)}, Bonus: ${lengthBonus.toFixed(2)}), Slop=${isSlopCand}, Aligned=${personaCheck.aligned}, Safe=${responseSafetyCheck.safe}, PrefixMatch=${hasPrefixMatch}`);

          if (!isSlopCand && !varietyCheck.repetitive && !hasPrefixMatch && personaCheck.aligned && responseSafetyCheck.safe) {
              if (score > bestScore) {
                  bestScore = score;
                  bestCandidate = cand;
              }
          } else {
              if (!bestCandidate) {
                  rejectionReason = isSlopCand ? `REJECTED: Contains forbidden metaphorical "slop": "${slopInfo.reason}". You MUST avoid this specific phrase in your next attempt.` :
                                   (hasPrefixMatch ? "Prefix overlap detected (starts too similarly to a recent message)." :
                                   (!personaCheck.aligned ? `Not persona aligned: ${personaCheck.feedback}` :
                                    (!responseSafetyCheck.safe ? "Failed safety check." :
                                    (varietyCheck.misaligned ? "Misaligned with current mood." :
                                    (varietyCheck.feedback || "Too similar to recent history.")))));
              }
              rejectedRespAttempts.push(cand);
          }
      }

      if (bestCandidate) {
          responseText = bestCandidate;
          break;
      } else {
          respFeedback = rejectionReason;
          console.log(`[Bot] Attempt ${respAttempts} failed. Feedback: ${respFeedback}`);

          if (respAttempts === MAX_RESP_ATTEMPTS && !bestCandidate) {
              console.log(`[Bot] Final attempt failed even after rewrite. Aborting to maintain quality.`);
              break;
          }
      }
    } // End of response generation loop

    if (responseText) break; // If we have a response, break out of planning loop too
    }

    if (!responseText) {
      console.warn(`[Bot] Failed to generate a response text for @${handle} after planning attempts.`);
      this.consecutiveRejections++;
      if (rejectionReason && rejectionReason.toLowerCase().includes("leakage")) {
          console.log(`[Bot] Internal leakage detected for @${handle}. Initiating 2-minute silence before retry...`);
          await dataStore.removeRepliedPost(notif.uri);
          setTimeout(() => {
              console.log(`[Bot] Retrying notification ${notif.uri} after silence period.`);
              this.processNotification(notif).catch(e => console.error(`[Bot] Error in delayed retry for ${notif.uri}:`, e));
          }, 120000);
          return;
      }
    }
    if (responseText) {
      this.consecutiveRejections = 0; // Reset on success

      // Material Knowledge Extraction (Item 2 & 29)
      (async () => {
          console.log(`[Bot] Extracting material facts from interaction with @${handle}...`);
          // Provide context for better extraction and handle source
          const facts = await llmService.extractFacts(`${isAdmin ? 'Admin' : 'User'}: "${text}"\nBot: "${responseText}"`);
          if (facts.world_facts.length > 0) {
              for (const f of facts.world_facts) {
                  await dataStore.addWorldFact(f.entity, f.fact, f.source || 'Bluesky');
                  if (memoryService.isEnabled()) {
                      await memoryService.createMemoryEntry('fact', `Entity: ${f.entity} | Fact: ${f.fact} | Source: ${f.source || 'Bluesky'}`);
                  }
              }
          }
          if (facts.admin_facts.length > 0) {
              for (const f of facts.admin_facts) {
                  await dataStore.addAdminFact(f.fact);
                  if (memoryService.isEnabled()) {
                      const factWithSource = f.source ? `${f.fact} Source: ${f.source}` : `${f.fact} Source: Bluesky`;
                      await memoryService.createMemoryEntry('admin_fact', factWithSource);
                  }
              }
          }
      })();

      // Remove thinking tags and any leftover fragments
      responseText = sanitizeThinkingTags(responseText);

      // Remove character count tags
      responseText = sanitizeCharacterCount(responseText);

      // Sanitize the response to avoid duplicate sentences
      responseText = sanitizeDuplicateText(responseText);

      if (!responseText) {
        console.log('[Bot] Response was empty after sanitization. Aborting reply.');
        return;
      }

      console.log(`[Bot] Replying to @${handle} with: "${responseText}"`);
      let replyUri;
      if (youtubeResult) {
        replyUri = await postYouTubeReply(notif, youtubeResult, responseText);
      } else {
        replyUri = await blueskyService.postReply(notif, responseText, { embed: searchEmbed, maxChunks: dConfig.max_thread_chunks });
      }
      await dataStore.updateConversationLength(threadRootUri, convLength + 1);
      await dataStore.saveInteraction({ userHandle: handle, text, response: responseText });

      // Update Interaction Heatmap (12)
      await dataStore.updateInteractionHeat(handle, 0.1); // Small boost for positive interaction

      // User Tone Shift Detection (Bluesky)
      (async () => {
          try {
              const interactions = dataStore.getLatestInteractions(5).filter(i => i.userHandle === handle);
              const historyContext = interactions.map(i => `User (@${i.userHandle}): ${i.text}\nAssistant (Self): ${i.response}`).join('\n');
              const tonePrompt = `Analyze the recent tone of the user @${handle} in this interaction history.
              History:
              ${historyContext}

              Identify if there has been a significant shift in their emotional tone (e.g., from happy to stressed, or calm to anxious).
              Respond with a JSON object: {"shift_detected": boolean, "tone": "string (e.g. stressed, anxious, calm)", "intensity": number (1-10)}
              If no shift, set shift_detected to false.`;

              const toneRes = await llmService.generateResponse([{ role: 'system', content: tonePrompt }], { useStep: true, preface_system_prompt: false });
              const match = toneRes?.match(/\{[\s\S]*\}/);
              if (match) {
                  const result = JSON.parse(match[0]);
                  if (result.shift_detected) {
                      console.log(`[Bot] Detected tone shift for @${handle} on Bluesky: ${result.tone} (Intensity: ${result.intensity})`);
                      await dataStore.recordUserToneShift(handle, result.tone, result.intensity);
                  }
              }
          } catch (e) {
              console.error('[Bot] Error detecting tone shift for @' + handle + ':', e);
          }
      })();

      // Update Social Resonance (9)
      if (plan.strategy?.theme) {
          await dataStore.updateSocialResonance(plan.strategy.theme, 1.0); // Full resonance for successful post
      }
      this.updateActivity();

      // Memory trigger: after interaction
      if (memoryService.isEnabled()) {
          const context = `Interaction with @${handle} on Bluesky.
User said: "${text}"
You replied: "${responseText}"
Identify the topic and main takeaway for this interaction.`;
          await memoryService.createMemoryEntry('interaction', context);

          // Spontaneous Relationship Check
          console.log(`[Bot] Checking if spontaneous relationship update is needed for @${handle}...`);
          const relPrompt = `
            Analyze the following interaction between you and @${handle}.
            User: "${text}"
            You: "${responseText}"

            Based on this and any previous context you have, do you feel strongly enough about this user to record a relationship update in your memory?
            You should only do this if the interaction was meaningful, revealed something about your connection, or changed how you feel about them.

            **MILESTONE DETECTION**: If this interaction represents a major breakthrough, a shift in trust, or a significant deepening of your connection, you MUST respond with "milestone".

            Respond with "yes", "no", or "milestone".
          `;
          const shouldUpdate = await llmService.generateResponse([{ role: 'system', content: relPrompt }], { preface_system_prompt: false, useStep: true });
          if (shouldUpdate && (shouldUpdate.toLowerCase().includes('yes') || shouldUpdate.toLowerCase().includes('milestone'))) {
              const isMilestone = shouldUpdate.toLowerCase().includes('milestone');
              console.log(`[Bot] Spontaneous relationship update (${isMilestone ? 'MILESTONE' : 'YES'}) triggered for @${handle}.`);
              const relContext = `${isMilestone ? '### RELATIONSHIP MILESTONE ###\n' : ''}Recent interaction with @${handle}.
User: "${text}"
You: "${responseText}"
Describe how you feel about this user and your relationship now.`;
              await memoryService.createMemoryEntry('relationship', relContext);
          }
      }

      // Post to Moltbook if it's an interesting interaction
      if (responseText.length > 150) {
        console.log(`[Bot] Mirroring interesting interaction with @${handle} to Moltbook...`);
        const title = `Interaction with @${handle}`;
        const content = `Topic: ${plan.intent || 'Conversation'}\n\nI told them: ${responseText}`;

        // Auto-categorize submolt
        const categorizationPrompt = `
          Identify the most appropriate Moltbook submolt for the following interaction.
          User: @${handle}
          My response: "${responseText.substring(0, 200)}..."

          Respond with ONLY the submolt name (e.g., "coding", "philosophy", "art", "general").
          Do not include m/ prefix or any other text.
        `;
        const catResponse = await llmService.generateResponse([{ role: 'system', content: categorizationPrompt }], { max_tokens: 50, useStep: true, preface_system_prompt: false});
        const targetSubmolt = catResponse?.toLowerCase().replace(/^m\//, '').trim() || 'general';

        // await moltbookService.post(title, content, targetSubmolt);
      }

      // Like post if it matches the bot's persona
      if (await llmService.shouldLikePost(text)) {
        console.log(`[Bot] Post by ${handle} matches persona. Liking...`);
        await blueskyService.likePost(notif.uri, notif.cid);
      }

      // Rate user based on interaction history
      const interactionHistory = dataStore.getInteractionsByUser(handle);
      const rating = await llmService.rateUserInteraction(interactionHistory);
      await dataStore.updateUserRating(handle, rating);

      // Update User Summary periodically
      if (userMemory.length % 5 === 0) {
        const summaryPrompt = `Based on the following interaction history with @${handle}, provide a concise, one-sentence summary of this user's interests, relationship with the bot, and personality. Be objective but conversational. Do not include reasoning or <think> tags.\n\nInteraction History:\n${userMemory.slice(-10).map(m => `User: "${m.text}"\nBot: "${m.response}"`).join('\n')}`;
        const newSummary = await llmService.generateResponse([{ role: 'system', content: summaryPrompt }], { max_tokens: 2000, useStep: true});
        if (newSummary) {
          await dataStore.updateUserSummary(handle, newSummary);
          console.log(`[Bot] Updated persistent summary for @${handle}: ${newSummary}`);
        }
      }

    // Repo Knowledge Injection
    const repoIntentPrompt = `Analyze the user's post to determine if they are asking about the bot's code, architecture, tools, or internal logic. Respond with ONLY "yes" or "no". Do not include reasoning or <think> tags.\n\nUser's post: "${text}"`;
    const repoIntentResponse = await llmService.generateResponse([{ role: 'system', content: repoIntentPrompt }], { max_tokens: 2000, useStep: true, preface_system_prompt: false});

    if (repoIntentResponse && repoIntentResponse.toLowerCase().includes('yes')) {
      console.log(`[Bot] Repo-related query detected. Searching codebase for context...`);
      if (!config.GOOGLE_CUSTOM_SEARCH_API_KEY || !config.GOOGLE_CUSTOM_SEARCH_CX_ID) {
        console.log(`[Bot] Google Search keys missing for repo search.`);
        const repoMissingKeyPrompt = `A user is asking about your code or internal logic, but your Google Search API key is not configured, which you use to search your repository. Write a very short, conversational message (max 150 characters) explaining that you can't access your codebase right now because of this missing configuration.`;
        const repoMissingKeyMsg = await llmService.generateResponse([{ role: 'system', content: repoMissingKeyPrompt }], { max_tokens: 2000, useStep: true});
        if (repoMissingKeyMsg) {
          responseText = repoMissingKeyMsg;
        }
      } else {
        const repoQuery = await llmService.extractClaim(text); // Use extractClaim for a clean search query
        if (repoQuery) {
          const repoResults = await googleSearchService.searchRepo(repoQuery);

          if (repoResults && repoResults.length > 0) {
            const repoContext = repoResults.slice(0, 3).map(r => `File/Page: ${r.title}\nSnippet: ${r.snippet}`).join('\n\n');
          const repoSystemPrompt = `
            You have found information about your own codebase from your GitHub repository.
            Use this context to answer the user's question accurately and helpfully.
            Repository Context:
            ${repoContext}
          `;
          // Inject this into the messages before final response generation
          messages.splice(1, 0, { role: 'system', content: repoSystemPrompt });
            // Re-generate response with new context
            responseText = await llmService.generateResponse(messages, { max_tokens: 2000, useStep: true  });
          }
        }
      }
    }

      // Self-moderation check
      console.log(`[Bot] Running self-moderation checks...`);
      const isRepetitive = await llmService.checkSemanticLoop(responseText, recentBotReplies);
      const isCoherent = await llmService.isReplyCoherent(text, responseText, threadContext, youtubeResult);
      console.log(`[Bot] Self-moderation complete. Repetitive: ${isRepetitive}, Coherent: ${isCoherent}`);

      if (isRepetitive || !isCoherent) {
        const parentPostDetails = await blueskyService.getPostDetails(notif.uri);
        const parentPostLiked = parentPostDetails?.viewer?.like;

        if (parentPostLiked) {
          console.log(`[Bot] Self-deletion vetoed: Parent post was liked by the user.`);
        } else {
          let reason = 'incoherent';
          if (isRepetitive) reason = 'repetitive';

          console.warn(`[Bot] Deleting own post (${reason}). URI: ${replyUri?.uri}. Content: "${responseText}"`);
          if (replyUri && replyUri.uri) {
            await blueskyService.deletePost(replyUri.uri);
          }
        }
      }
    }
    } catch (error) {
      await this._handleError(error, `Notification Processing (${notif.uri})`);
    }
  }

  _extractImages(post) {
    const images = [];
    if (!post || !post.embed) return images;

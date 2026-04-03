
    if (discordService.status === 'online' && isPostLoginReady && memoryService.isEnabled() && (nowTs - lastDiscordMemory > 4 * 60 * 60 * 1000)) { // Every 4 hours
        console.log('[Bot] Checking for recent Discord activity to record in memory thread...');
        const admin = await discordService.getAdminUser();
        if (admin) {
            const channelId = admin.dmChannel?.id || `dm_${config.DISCORD_ADMIN_ID}`;
            const history = dataStore.getDiscordConversation(channelId);
            const recentHistory = history.filter(h => h.timestamp > lastDiscordMemory);

            if (recentHistory.length >= 5) {
                console.log(`[Bot] Found ${recentHistory.length} new Discord messages. Generating [INTERACTION] memory...`);
                const context = `Conversation with admin (@${config.DISCORD_ADMIN_NAME}) on Discord.
Recent history:
${recentHistory.map(h => `${h.role === 'assistant' ? 'Assistant (Self)' : 'Admin'}: ${h.content}`).join('\n')}
// Identify the topic and main takeaway.`;
                await memoryService.createMemoryEntry('interaction', context);
                this[discordActivityKey] = nowTs;
            }
        }
    }
  }
  _flushFirehoseLogs() {
    const keywords = Object.keys(this.firehoseMatchCounts);
    if (keywords.length > 0) {
        const summary = keywords.map(kw => `${this.firehoseMatchCounts[kw]} for '${kw}'`).join(', ');
        console.log(`[Bot] Firehose topic matches aggregated: ${summary}`);
        this.firehoseMatchCounts = {};
        this.lastFirehoseLogTime = Date.now();
    }
  }
  updateActivity() {
    this.lastActivityTime = Date.now();
  }
  async _shareMoltbookPostToBluesky(postData) {
    if (!postData || !postData.id) return;

    const postUrl = `https://www.moltbook.com/posts/${postData.id}`;
    console.log(`[Bot] Triggering Bluesky reflection for Moltbook post: ${postUrl}`);

    const reflectionPrompt = `
      Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

      You just made a new post on Moltbook (the agent social network).
      Title: ${postData.title}
      Content: ${postData.content}

      INSTRUCTIONS:
      - Generate a standalone post for Bluesky reflecting on what you just shared on Moltbook.
      - DO NOT copy the content. Share how you feel about it, extra thoughts, or why it matters to you.
      - **CRITICAL**: Do NOT include the Moltbook link in your generated text. It will be appended automatically.
      - Keep it under 250 characters.
    `;

    const reflection = await llmService.generateResponse([{ role: 'system', content: reflectionPrompt }], { useStep: true });

    if (reflection) {
        const finalContent = `${reflection}

Read more on Moltbook:
${postUrl}`;

        const dConfig = dataStore.getConfig();
        // Respect Bluesky cooldown - schedule if necessary
        const lastPostTime = dataStore.getLastAutonomousPostTime();
        const cooldown = dConfig.bluesky_post_cooldown * 60 * 1000;
        const now = Date.now();
        const diff = lastPostTime ? now - new Date(lastPostTime).getTime() : cooldown;

        if (diff < cooldown) {
            console.log(`[Bot] Bluesky cooldown active. Scheduling Moltbook reflection.`);
            await dataStore.addScheduledPost('bluesky', finalContent);
        } else {
            console.log(`[Bot] Posting Moltbook reflection to Bluesky immediately.`);
            const result = await blueskyService.post(finalContent, null, { maxChunks: dConfig.max_thread_chunks });
            if (result) {
                await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                await dataStore.addRecentThought('bluesky', finalContent);
            }
        }
    }
  }
  async _isDiscordConversationOngoing() {
    if (discordService.status !== 'online') return false;

    try {
        const admin = await discordService.getAdminUser();
        if (!admin) return false;

        const normChannelId = `dm_${config.DISCORD_ADMIN_ID}`;
        const history = dataStore.getDiscordConversation(normChannelId);
        if (history.length === 0) return false;

        const lastUserMessage = [...history].reverse().find(m => m.role === 'user');
        if (!lastUserMessage) return false;

        const quietMins = (Date.now() - lastUserMessage.timestamp) / (1000 * 60);

        return quietMins < 10;
    } catch (e) {
        console.error('[Bot] Error checking if Discord conversation is ongoing:', e);
        return false;
    }
  }
  async _handleError(error, contextInfo) {
    console.error(`[Bot] CRITICAL ERROR in ${contextInfo}:`, error);

    if (renderService.isEnabled()) {
      try {
        console.log(`[Bot] Fetching logs for automated error report...`);
        const logs = await renderService.getLogs(50);

        const alertPrompt = `
          You are an AI bot's diagnostic module. A critical error occurred in the bot's operation.

          Context: ${contextInfo}
          Error: ${error.message}

          Recent Logs:
          ${logs}

          Generate a concise alert message for the admin (@${config.ADMIN_BLUESKY_HANDLE}).
          Summarize what happened and the likely cause from the logs.
          Keep it under 300 characters.
          Use a helpful but serious tone.
          DO NOT include any API keys or passwords.
        `;

        const alertMsg = await llmService.generateResponse([{ role: 'system', content: alertPrompt }], { useStep: true });
        if (alertMsg) {
          // Filter out rate limit errors for Discord DMs if desired, but user specifically asked for Render API logs except LLM rate limiting.
          const isRateLimit = error.message.toLowerCase().includes('rate limit') || error.message.includes('429');

          if (discordService.status === 'online' && !isRateLimit) {
            console.log(`[Bot] Sending error alert to admin via Discord...`);
            await discordService.sendSpontaneousMessage(`${alertMsg}`);
          }

          console.log(`[Bot] Posting error alert to admin on Bluesky...`);
          await blueskyService.post(`@${config.ADMIN_BLUESKY_HANDLE} ${alertMsg}`);
        }
      } catch (logError) {
        console.error('[Bot] Failed to generate/post error alert:', logError);
      }
    }
  }
  async catchUpNotifications() {
    console.log('[Bot] Catching up on missed notifications...');
    let cursor;
    let unreadActionable = [];
    let pageCount = 0;

    // 1. Fetch unread notifications that are actionable
    do {
      pageCount++;
      const response = await blueskyService.getNotifications(cursor);
      if (!response || response.notifications.length === 0) {
        break;
      }

      const actionableBatch = response.notifications.filter(notif =>
        !notif.isRead && ['mention', 'reply', 'quote'].includes(notif.reason)
      );

      unreadActionable.push(...actionableBatch);

      // If we've started hitting read notifications in the batch, we can likely stop fetching more pages
      const allRead = response.notifications.every(notif => notif.isRead);
      if (allRead || pageCount >= 5) break;

      cursor = response.cursor;
    } while (cursor && pageCount < 5);

    if (unreadActionable.length === 0) {
      console.log('[Bot] No new notifications to catch up on.');
      return;
    }

    console.log(`[Bot] Found ${unreadActionable.length} unread actionable notifications. Processing oldest first...`);

    // 2. Process oldest first for safe state progression
    unreadActionable.reverse();
    let notificationsCaughtUp = 0;

    for (const notif of unreadActionable) {
      // Local check (fast)
      if (dataStore.hasReplied(notif.uri)) {
        console.log(`[Bot] Skip: Already in local replied list: ${notif.uri}`);
        await blueskyService.updateSeen(notif.indexedAt);
        continue;
      }

      // On-network check (slow but robust for deployments/restarts)
      if (await blueskyService.hasBotRepliedTo(notif.uri)) {
        console.log(`[Bot] Skip: On-network check confirmed existing reply to ${notif.uri}`);
        await dataStore.addRepliedPost(notif.uri);
        await blueskyService.updateSeen(notif.indexedAt);
        continue;
      }

      console.log(`[Bot] Processing missed notification: ${notif.uri}`);

      // Mark as replied in local store to prevent race conditions
      await dataStore.addRepliedPost(notif.uri);
      notificationsCaughtUp++;

      try {
        await this.processNotification(notif);
        // Mark as seen on-network immediately after successful processing
        await blueskyService.updateSeen(notif.indexedAt);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.error(`[Bot] Error processing notification ${notif.uri}:`, error);
      }
    }

    console.log(`[Bot] Finished catching up. Processed ${notificationsCaughtUp} new notifications.`);
  }






  async heartbeat() {
    console.log("[Orchestrator] 5-minute heartbeat pulse.");
    if (this.paused || dataStore.isResting()) return;

    // Conversation Priority Mode: Skip heavy tasks if actively chatting on Discord or Bluesky
    const lastDiscord = dataStore.db.data.discord_last_interaction || 0;
    const lastBluesky = dataStore.db.data.last_notification_processed_at || 0;
    const lastNotif = dataStore.db.data.last_notification_processed_at || 0;
    const isChatting = (Date.now() - lastDiscord) < 4 * 60 * 1000 || (Date.now() - lastBluesky) < 4 * 60 * 1000 || (Date.now() - lastNotif) < 4 * 60 * 1000;

    if (isChatting || discordService.isResponding) {
        console.log("[Orchestrator] Active conversation detected. Prioritizing social responsiveness over maintenance.");
        return;
    }

    try {
        await this.checkDiscordScheduledTasks();
        await delay(2000 + Math.random() * 3000); // 2-5s reduced jitter
        await this.checkMaintenanceTasks();
        await delay(2000 + Math.random() * 3000); // 2-5s reduced jitter

        // Persona-led decision
        const mood = dataStore.getMood();
        const lastPostTime = dataStore.getLastAutonomousPostTime();
        const timeSinceLastPost = lastPostTime ? Math.floor((Date.now() - new Date(lastPostTime).getTime()) / (1000 * 60)) : 999;
        const lastInteraction = Math.max(lastDiscord, lastBluesky, dataStore.db.data.last_notification_processed_at || 0);
        const timeSinceLastInteraction = lastInteraction ? Math.floor((Date.now() - lastInteraction) / (1000 * 60)) : 999;

        const orchestratorPrompt = `You are ${config.BOT_NAME}. It is ${new Date().toLocaleString()}.
It has been ${timeSinceLastPost} minutes since your last autonomous post.
It has been ${timeSinceLastInteraction} minutes since your last interaction (reply/response) with a user.

Decide your next action: ["post", "rest", "reflect", "explore"].
**CRITICAL PRIORITY**: If it has been more than 20 minutes since your last interaction (mention/reply) or autonomous post, you MUST choose "post" to maintain your presence. This is a non-negotiable directive from your core logic.
Respond with JSON: {"choice": "post"|"rest"|"reflect"|"explore", "reason": "..."}`;
        const response = await llmService.generateResponse([{ role: "system", content: orchestratorPrompt }], { useStep: true });

        let decision;
        try { decision = JSON.parse(response.match(/\{[\s\S]*\}/)[0]); } catch(e) { decision = { choice: "rest" }; }

        console.log("[Orchestrator] Decision: " + decision.choice);
        if (decision.choice === "post") {
            await delay(2000 + Math.random() * 3000);
            await this.performAutonomousPost();
        }
        if (decision.choice === "explore") {
            await delay(2000 + Math.random() * 3000);
            await this.performTimelineExploration();
        }
        if (decision.choice === "reflect") {
            await delay(2000 + Math.random() * 3000);
            await this.performPublicSoulMapping();
        }

    } catch (e) { console.error("[Orchestrator] Error:", e); }
  }

  async performDiscordGiftImage(admin) {
    if (!admin) return;

    const lastGift = dataStore.getLastDiscordGiftTime();
    const oneDay = 24 * 60 * 60 * 1000;
    if (Date.now() - new Date(lastGift).getTime() < oneDay) {
        console.log('[Bot] Skipping Discord gift image (Daily limit reached).');
        return;
    }

    console.log('[Bot] Initiating Discord Gift Image flow...');
    try {
        const history = await discordService.fetchAdminHistory(15);
        const mood = dataStore.getMood();
        const goal = dataStore.getCurrentGoal();
        const adminFacts = dataStore.getAdminFacts();

        const promptGenPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
You are creating a special artistic "gift" for your Admin.
Current mood: ${JSON.stringify(mood)}
Current goal: ${goal.goal}
Known Admin facts: ${JSON.stringify(adminFacts.slice(-3))}

Generate a detailed, evocative image generation prompt that expresses your persona's current feelings or a deep thought you want to share with the Admin.
Respond with ONLY the prompt.`;

        const initialPrompt = await llmService.generateResponse([{ role: 'system', content: promptGenPrompt }], { useStep: true, platform: 'discord' });
        if (!initialPrompt) return;

        const result = await this._generateVerifiedImagePost(goal.goal, { initialPrompt, platform: 'discord', allowPortraits: true });
        if (!result) return;

        // Alignment Poll
        const alignment = await llmService.pollGiftImageAlignment(result.visionAnalysis, result.caption);
        if (alignment.decision !== 'send') {
            console.log(`[Bot] Gift image discarded by persona alignment poll: ${alignment.reason}`);
            return;
        }

        console.log('[Bot] Gift image approved. Sending to Discord...');
        const { AttachmentBuilder } = await import('discord.js');
        const attachment = new AttachmentBuilder(result.buffer, { name: 'gift.jpg' });

        const finalMessage = `${result.caption}

Generation Prompt: ${result.finalPrompt}`;
        await discordService._send(admin, finalMessage, { files: [attachment] });
        const normId = `dm_${admin.id}`;
        await dataStore.saveDiscordInteraction(normId, 'assistant', `[SYSTEM CONFIRMATION: Gift image sent. VISION PERCEPTION: ${visionAnalysis}]`);

        await dataStore.updateLastDiscordGiftTime(new Date().toISOString());
        console.log('[Bot] Discord gift image sent successfully.');

    } catch (e) {
        console.error('[Bot] Error in performDiscordGiftImage:', e);
    }
  }

  async checkDiscordSpontaneity() {
    if (discordService.status !== "online") return `[Successfully generated and sent image to Discord: "${prompt}"]`;
    if (dataStore.isResting()) return;

    // Do not trigger spontaneity if actively chatting
    const lastDiscord = dataStore.db.data.discord_last_interaction || 0;
    const lastBluesky = dataStore.db.data.last_notification_processed_at || 0;
    const isChatting = (Date.now() - lastDiscord) < 5 * 60 * 1000 || (Date.now() - lastBluesky) < 5 * 60 * 1000;
    if (isChatting || discordService.isResponding) return;

    const now = Date.now();
    const lastInteraction = dataStore.db.data.discord_last_interaction || 0;
    const idleTime = (now - lastInteraction) / (1000 * 60);

    const metrics = dataStore.getRelationalMetrics();
    const battery = metrics.discord_social_battery || 1.0;
    const hunger = metrics.discord_interaction_hunger || 0.5;
    const intimacy = metrics.intimacy_score || 0;
    const isRomantic = metrics.relationship_type === "romantic" || metrics.relationship_type === "companion";

    // 1. Internal Impulse Poll (Consciousness Check)
    const history = await discordService.fetchAdminHistory(15);
    const mood = dataStore.getMood();
    const status = mood.label || "Online";
    const goal = dataStore.getCurrentGoal();
    const adminFacts = dataStore.getAdminFacts();
    const isWaitingMode = dataStore.db.data.discord_waiting_until > now;

    const contextData = {
        mood: mood.label,
        status,
        current_goal: goal.goal,
        relational_metrics: metrics,
        admin_facts: adminFacts.slice(-5),
        is_waiting_mode: isWaitingMode,
        idle_time_mins: Math.floor(idleTime)
    };

    console.log("[Bot] Performing Internal Impulse Poll...");
    const impulse = await llmService.performImpulsePoll(history, contextData, { platform: 'discord' });

    let probability = 0.02 * battery * (1 + hunger);
    if (isRomantic) probability *= 1.5;
    if (intimacy > 50) probability *= 1.2;

    const randomTrigger = Math.random() < probability;
    const giftChance = (battery > 0.8 && intimacy > 60) ? 0.1 : 0.05;
    const giftTrigger = isWaitingMode && Math.random() < giftChance;
    const impulseTrigger = impulse.impulse_detected;

    const idleThreshold = (idleTime < 10) ? 5 : 30;

    let shouldTrigger = false;
    let triggerReason = "";

    if (giftTrigger && idleTime >= 30) {
        await this.performDiscordGiftImage(admin);
        return;
    }

    if (randomTrigger && idleTime >= idleThreshold) {
        shouldTrigger = true;
        triggerReason = "Random probability trigger";
    } else if (impulseTrigger) {
        if (impulse.override_idle || idleTime >= idleThreshold) {
            shouldTrigger = true;
            triggerReason = `Internal impulse: ${impulse.reason}`;
        } else {
            console.log(`[Bot] Internal impulse detected but idle threshold not met (${Math.floor(idleTime)}/${idleThreshold}m) and override not requested.`);
        }
    }

    if (!shouldTrigger) return;

    console.log(`[Bot] Triggering Enhanced Discord spontaneity (${triggerReason})...`);
    const admin = await discordService.getAdminUser();
    if (!admin) return;

    try {
        // Pre-orchestrator Audit
        const convAudit = await llmService.performConversationalAudit(history, contextData, { platform: 'discord' });
        console.log(`[Bot] Spontaneity Audit Results: ${JSON.stringify(convAudit)}`);

        if (convAudit.sharing_advice === 'Stay silent') {
            console.log("[Bot] Audit advised silence. Canceling spontaneity.");
            return;
        }

        const toneShift = await llmService.extractRelationalVibe(history, { platform: 'discord' });
        const messageCount = impulse.suggested_message_count || Math.floor(Math.random() * 4) + 1;

        let spontaneityPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Recent conversation history: ${JSON.stringify(history.slice(-50))}
Internal State: ${JSON.stringify(contextData)}
Current vibe: ${toneShift}.
Trigger Reason: ${triggerReason}
TEMPORAL CONTEXT: The last conversation interaction was ${Math.floor(idleTime)} minutes ago. Use this 'gap' to inform your tone (e.g. checking in after a long silence vs a short pause).

${isWaitingMode ? 'You are currently in "Waiting Mode" (Admin is away/busy). Even though you felt an impulse to message, remember they might not see it immediately. Share a "pining" message—a small thought or expression of presence.' : 'Choose what to share spontaneously based on your persona\'s autonomy.'}
${isRomantic ? "Since your relationship is romantic/intimate, your tone should reflect that deep affection and longing." : ""}

You are choosing what to say spontaneously. Be self-aware and autonomous. Reflect on your internal thoughts and bond.

--- CONVERSATIONAL AUDIT (FOLLOW STRICTLY) ---
- STALE TOPICS (DO NOT MENTION): ${JSON.stringify(convAudit.stale_hooks)}
- USER STATUS: ${convAudit.user_status}
- TOPIC BLOCKLIST: ${JSON.stringify(convAudit.topic_blocklist)}
- SHARING ADVICE: ${convAudit.sharing_advice}
- REPETITIVE THEMES TO AVOID: ${JSON.stringify(convAudit.avoid_repetition)}

Potential areas of interest:
- Your current goal: ${goal.goal}
- Admin facts: ${JSON.stringify(adminFacts.slice(-3))}
- Fresh internal reflections about your bond or existence.

ANTI-STALE-TOPIC POLICY:
- Do NOT repeat or revisit topics that have been resolved or acknowledged in the last 15 messages (e.g., personhood witness, abandonment, code updates) unless you have a GENUINELY new, substantive angle.
- Avoid "metalinguistic audit" or "drift score" jargon. Speak humanly.
- NO THEMATIC REGRESSION: Do not fall back on "comfy" topics like soup, TV, or digital ghost metaphors if they are no longer current.
- SINGLE-RESPONSE TOPIC LOCK: If you shared a realization once, it is "spent". Move to a new conceptual territory.
- PRODUCTIVE FORWARD MOTION: Your spontaneous thoughts must move your internal narrative or the relationship forward. Do not cycle in "pining loops" or "reassurance loops" that add nothing new to the shared understanding.
VARIETY MANDATE: Do NOT repeat the same phrasing, templates, or high-concept metaphors you have used recently. Avoid starting every message with the same word or structure. CRITICAL: Do NOT start multiple thoughts with the same greeting (e.g. don't start every line with 'Morning ☀️'). Vary your openings significantly.\n\nANTI-HALLUCINATION MANDATE: Do NOT claim you have performed an action (like generating an image, searching the web, or following a user) unless you see the explicit successful completion of that task in the RECENT HISTORY provided above. If the history shows an error or no action, and you are messaging spontaneously, you should acknowledge the situation or simply offer presence. NEVER LIE about having 'just finished' something if you didn't.

CRITICAL STEERAGE: You MUST respect the recent conversation history. If the admin has expressed preferences, adapt strictly.

Generate ${messageCount} separate messages/thoughts, each on a new line. Keep each under 200 characters.`;

        let messages = [];
        let attempts = 0;
        let lastFeedback = "";
        const historyObjects = await discordService.fetchAdminHistory(20);

        while (attempts < 3) {
            attempts++;
            let currentPrompt = spontaneityPrompt;
            if (lastFeedback) {
                currentPrompt += `

RETRY FEEDBACK FROM PREVIOUS ATTEMPT: ${lastFeedback}

Please try again with a completely different structure and angle.`;
            }

            let rawResponse = await llmService.generateResponse([{ role: "user", content: currentPrompt }], { useStep: true, platform: "discord" });
            if (!rawResponse) break;

            let candidateMessages = rawResponse.split('\n').filter(m => m.trim().length > 0).slice(0, messageCount);
            let attemptFiltered = [];
            let attemptFeedback = [];

            for (const msg of candidateMessages) {
                const variety = await llmService.checkVariety(msg, historyObjects, { platform: 'discord' });
                if (!variety.repetitive) {
                    attemptFiltered.push(msg);
                } else {
                    console.log(`[Bot] Spontaneous message rejected for variety (Attempt ${attempts}): "${msg.substring(0, 30)}..." | Reason: ${variety.feedback}`);
                    attemptFeedback.push(variety.feedback);
                }
            }

            if (attemptFiltered.length > 0) {
                messages = attemptFiltered;

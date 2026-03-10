  async processNotification(notif) {
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
      }
      }
      }
      }
    } catch (error) {
      await this._handleError(error, `Notification Processing (${notif.uri})`);
    }
  }

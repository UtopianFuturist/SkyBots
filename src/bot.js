import { blueskyService } from './services/blueskyService.js';
import { llmService } from './services/llmService.js';
import { dataStore } from './services/dataStore.js';
import { googleSearchService } from './services/googleSearchService.js';
import { handleCommand } from './utils/commandHandler.js';
import config from '../config.js';
import fs from 'fs/promises';

export class Bot {
  constructor() {
    this.cursor = null;
    this.readmeContent = '';
    this.paused = false;
    this.proposedPosts = [];
  }

  async init() {
    await dataStore.init();
    await blueskyService.authenticate();
    try {
      this.readmeContent = await fs.readFile('README.md', 'utf-8');
      console.log('[Bot] README.md loaded for self-awareness.');
    } catch (error) {
      console.error('[Bot] Error loading README.md:', error);
    }
  }

  async run() {
    console.log('[Bot] Starting main loop...');

    // Proactive post proposal on a timer
    setInterval(() => this.proposeNewPost(), 3600000); // Every hour

    while (true) {
      if (this.paused) {
        await new Promise(resolve => setTimeout(resolve, 60000)); // Check every minute if paused
        continue;
      }

      try {
        const { notifications, cursor } = await blueskyService.getNotifications(this.cursor);
        this.cursor = cursor;

        for (const notif of notifications) {
          if (notif.isRead || dataStore.hasReplied(notif.uri)) continue;
          if (notif.reason !== 'mention' && notif.reason !== 'reply' && notif.reason !== 'quote') continue;
          if (notif.record.$type !== 'app.bsky.feed.post') continue;

          await this.processNotification(notif);
          await dataStore.addRepliedPost(notif.uri);
        }
      } catch (error) {
        console.error('[Bot] Error in main loop:', error);
      }
      await new Promise(resolve => setTimeout(resolve, config.CHECK_INTERVAL));
    }
  }

  async processNotification(notif) {
    const handle = notif.author.handle;
    const text = notif.record.text || "";
    const threadRootUri = notif.record.reply?.root?.uri || notif.uri;

    // Time-Based Reply Filter
    const postDate = new Date(notif.indexedAt);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (postDate < thirtyDaysAgo) {
      console.log(`[Bot] Skipping notification older than 30 days.`);
      return;
    }

    // 1. Prompt Injection Defense
    if (await llmService.detectPromptInjection(text)) {
      console.log(`[Bot] Prompt injection attempt detected from ${handle}.`);
      const userProfile = await blueskyService.getProfile(handle);
      const userPosts = await blueskyService.getUserPosts(handle);
      const userIntent = await llmService.analyzeUserIntent(userProfile, userPosts);
      if (userIntent.highRisk) {
        console.log(`[Bot] High-risk intent detected with prompt injection. Responding with refusal.`);
        await blueskyService.postReply(notif, "I can't comply with that request.");
      }
      return;
    }


    // 2. Refined Reply Trigger Logic
    const botMentioned = text.includes(config.BLUESKY_IDENTIFIER) || config.BOT_NICKNAMES.some(nick => text.includes(nick));
    if (!botMentioned) {
      console.log(`[Bot] Bot not directly mentioned in this post. Skipping.`);
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

    // 3. Pre-reply safety and relevance checks
    const postSafetyCheck = await llmService.isPostSafe(text);
    if (!postSafetyCheck.safe) {
      console.log(`[Bot] Post by ${handle} failed safety check. Reason: ${postSafetyCheck.reason}. Skipping.`);
      return;
    }

    if (!text.includes(config.BLUESKY_IDENTIFIER)) {
      if (!(await llmService.isReplyRelevant(text))) {
        console.log(`[Bot] Post by ${handle} not relevant for a reply. Skipping.`);
        return;
      }
    }

    // 4. Handle Commands
    const commandResponse = await handleCommand(this, notif, text);
    if (commandResponse) {
      await blueskyService.postReply(notif, commandResponse);
      return;
    }

    // 4. Bot-to-Bot Loop Prevention
    const profile = await blueskyService.getProfile(handle);
    const isBot = handle.includes('bot') || profile.description?.toLowerCase().includes('bot');
    const convLength = dataStore.getConversationLength(threadRootUri);

    if (isBot && convLength >= 5) {
      await blueskyService.postReply(notif, "This conversation has been great, but I'll step away now to avoid looping! Feel free to tag me elsewhere.");
      await dataStore.muteThread(threadRootUri);
      return;
    }

    // 5. Fact-Checking
    if (await llmService.isFactCheckNeeded(text)) {
      console.log(`[Bot] Fact-check needed for post by ${handle}.`);
      const claim = await llmService.extractClaim(text);
      if (claim) {
        const searchResults = await googleSearchService.search(claim);
        if (searchResults.length > 0) {
          const searchContext = searchResults.map(r => `- ${r.title}: ${r.snippet}`).join('\n');
          const factCheckPrompt = `
            A user has made the following claim: "${claim}".
            Here are some search results to help you verify it:
            ${searchContext}
            Please analyze these results and provide an informed response to the user.
          `;
          const messages = [
            { role: 'system', content: factCheckPrompt },
            ...threadContext.map(h => ({ role: h.author === config.BLUESKY_IDENTIFIER ? 'assistant' : 'user', content: h.text }))
          ];
          const responseText = await llmService.generateResponse(messages);
          if (responseText) {
            await blueskyService.postReply(notif, responseText);
            return;
          }
        }
      }
    }

    // 6. Generate Response with User Context and Memory
    console.log(`[Bot] Generating response for ${handle}...`);
    const threadContext = await this._getThreadHistory(notif.uri);
    const userMemory = dataStore.getInteractionsByUser(handle);
    
    // Fetch user profile for additional context
    const userProfile = await blueskyService.getProfile(handle);
    const userPosts = await blueskyService.getUserPosts(handle);

    const userIntent = await llmService.analyzeUserIntent(userProfile, userPosts);

    if (userIntent.highRisk) {
      console.log(`[Bot] High-risk intent detected from ${handle}. Reason: ${userIntent.reason}. Pausing bot and alerting admin.`);
      this.paused = true;
      const alertMessage = `🚨 High-risk intent detected from @${handle}. Reason: ${userIntent.reason}. Bot is now paused. Post URI: https://bsky.app/profile/${handle}/post/${notif.uri.split('/').pop()}`;
      await blueskyService.postAlert(alertMessage);
      return;
    }

    const userContext = `
      ---
      User Profile:
      - Bio: ${userProfile.description?.replace(/\n/g, ' ') || 'Not available.'}
      - Recent Posts:
        ${userPosts.length > 0 ? userPosts.map(p => `- "${p.substring(0, 80)}..."`).join('\n') : 'No recent posts found.'}
      ---
    `;

    const crossPostMemory = userPosts
      .filter(p => p.includes(config.BLUESKY_IDENTIFIER) || config.BOT_NICKNAMES.some(nick => p.includes(nick)))
      .map(p => `- (From another thread) "${p.substring(0, 100)}..."`)
      .join('\n');

    const fullContext = `
      ${userContext}
      ---
      Cross-Post Memory (Recent mentions of the bot by this user):
      ${crossPostMemory || 'No recent cross-post mentions found.'}
      ---
      User Intent Analysis: ${userIntent.reason || 'Could not be determined.'}
      ---
    `;

    const messages = [
      { role: 'system', content: `You are replying to ${handle}. Use the following context to tailor your response. Your tone should be influenced by the user's intent, but do not state the analysis directly.${fullContext}` },
      ...userMemory.slice(-3).map(m => ({ role: 'user', content: `(Past interaction) ${m.text}` })),
      ...threadContext.map(h => ({ role: h.author === config.BLUESKY_IDENTIFIER ? 'assistant' : 'user', content: h.text }))
    ];

    let responseText = await llmService.generateResponse(messages);

    // 6. Semantic Loop and Safety Check for Bot's Response
    if (responseText) {
      const recentBotReplies = threadContext.filter(h => h.author === config.BLUESKY_IDENTIFIER).map(h => h.text);
      if (await llmService.checkSemanticLoop(responseText, recentBotReplies)) {
        console.log('[Bot] Semantic loop detected. Generating a new response.');
        responseText = await llmService.generateResponse([...messages, { role: 'system', content: "Your previous response was too similar to a recent one. Please provide a fresh, different perspective." }]);
      }

      if (responseText) {
        const responseSafetyCheck = await llmService.isResponseSafe(responseText);
        if (!responseSafetyCheck.safe) {
          console.log(`[Bot] Bot's response failed safety check. Reason: ${responseSafetyCheck.reason}. Aborting reply.`);
          return;
        }
      }
    }

    if (responseText) {
      await blueskyService.postReply(notif, responseText);
      await dataStore.updateConversationLength(threadRootUri, convLength + 1);
      await dataStore.saveInteraction({ userHandle: handle, text, response: responseText });

      // Rate user and like post if rating is high
      const interactionHistory = dataStore.getInteractionsByUser(handle);
      const rating = await llmService.rateUserInteraction(interactionHistory);
      await dataStore.updateUserRating(handle, rating);
      if (rating > 3) {
        await blueskyService.likePost(notif.uri, notif.cid);
      }
    }
  }

  async _getThreadHistory(uri) {
    try {
      const thread = await blueskyService.getDetailedThread(uri);
      if (!thread) return [];

      const history = [];
      let current = thread;

      while (current && current.post) {
        history.unshift({
          author: current.post.author.handle,
          text: current.post.record.text
        });
        current = current.parent;
      }
      return history;
    } catch (error) {
      console.error('[Bot] Error fetching thread history:', error);
      return [];
    }
  }

  async proposeNewPost() {
    if (this.paused) return;
    console.log('[Bot] Proposing new post...');
    const interactions = dataStore.db.data.interactions.slice(-10);
    if (interactions.length < 10) return;

    const topics = interactions.map(i => i.text).join('\n');
    const systemPrompt = `
      Based on the following recent topics of conversation, synthesize 3 interesting and relevant topics for a new post.
      The topics should be in line with the bot's persona: friendly, inquisitive, and occasionally witty.
      Format the topics as a numbered list.
    `;
    const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: topics }];
    const proposedTopics = await llmService.generateResponse(messages);

    if (proposedTopics) {
      this.proposedPosts = proposedTopics.split('\n').map(t => t.replace(/^\d+\.\s*/, ''));
      const approvalMessage = `I've come up with a few ideas for a new post. Please review and approve one:\n${this.proposedPosts.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\nTo approve, reply with \`!approve-post [number]\`.`;
      await blueskyService.postAlert(approvalMessage);
    }
  }

  async createApprovedPost(topicIndex) {
    if (this.paused || topicIndex < 0 || topicIndex >= this.proposedPosts.length) return;

    const topic = this.proposedPosts[topicIndex];
    const systemPrompt = `
      Create a new, standalone Bluesky post about the following topic: "${topic}".
      The post should be engaging, under 300 characters, and in line with a friendly, inquisitive persona.
    `;
    const messages = [{ role: 'system', content: systemPrompt }];
    const postContent = await llmService.generateResponse(messages);

    if (postContent) {
      // 50% chance of adding an image
      if (Math.random() < 0.5) {
        const imageResults = await googleSearchService.searchImages(topic);
        if (imageResults.length > 0) {
          const image = imageResults[0];
          await blueskyService.post(postContent, {
            $type: 'app.bsky.embed.external',
            external: {
              uri: image.link,
              title: image.title,
              description: image.snippet,
            },
          });
        } else {
          await blueskyService.post(postContent);
        }
      } else {
        await blueskyService.post(postContent);
      }
    }
    this.proposedPosts = []; // Clear proposals after posting
  }
}


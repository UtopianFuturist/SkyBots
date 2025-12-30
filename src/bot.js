import { blueskyService } from './services/blueskyService.js';
import { llmService } from './services/llmService.js';
import { dataStore } from './services/dataStore.js';
import { handleCommand } from './utils/commandHandler.js';
import config from '../config.js';
import fs from 'fs/promises';

export class Bot {
  constructor() {
    this.cursor = null;
    this.readmeContent = '';
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
    while (true) {
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

    // 1. Refined Reply Trigger Logic
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

    if (!(await llmService.isReplyRelevant(text))) {
      console.log(`[Bot] Post by ${handle} not relevant for a reply. Skipping.`);
      return;
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

    // 5. Generate Response with User Context and Memory
    console.log(`[Bot] Generating response for ${handle}...`);
    const threadContext = await this._getThreadHistory(notif.uri);
    const userMemory = dataStore.getInteractionsByUser(handle);
    
    // Fetch user profile for additional context
    const userProfile = await blueskyService.getProfile(handle);
    const userPosts = await blueskyService.getUserPosts(handle);

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
    `;

    const messages = [
      { role: 'system', content: `You are replying to ${handle}. Here is some context to help you tailor your response:${fullContext}` },
      ...userMemory.slice(-3).map(m => ({ role: 'user', content: `(Past interaction) ${m.text}` })),
      ...threadContext.map(h => ({ role: h.author === config.BLUESKY_IDENTIFIER ? 'assistant' : 'user', content: h.text }))
    ];

    let responseText = await llmService.generateResponse(messages);

    // 6. Semantic Loop and Safety Check for Bot's Response
    if (responseText) {
      const recentBotReplies = history.filter(h => h.author === config.BLUESKY_IDENTIFIER).map(h => h.text);
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
}


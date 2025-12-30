import { blueskyService } from './services/blueskyService.js';
import { llmService } from './services/llmService.js';
import { dataStore } from './services/dataStore.js';
import { handleCommand } from './utils/commandHandler.js';
import config from '../config.js';

export class Bot {
  constructor() {
    this.cursor = null;
  }

  async init() {
    await dataStore.init();
    await blueskyService.authenticate();
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

    // 1. Check Blocklist
    if (dataStore.isBlocked(handle)) return;

    // 2. Check Muted Thread
    if (dataStore.isThreadMuted(threadRootUri)) return;

    // 3. Handle Commands
    const commandResponse = await handleCommand(notif, text);
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

    // 5. Generate Response with Memory
    const history = await this.getThreadHistory(notif.uri);
    const userMemory = dataStore.getInteractionsByUser(handle);
    
    const messages = [
      ...userMemory.slice(-3).map(m => ({ role: 'user', content: `(Past interaction) ${m.text}` })),
      ...history.map(h => ({ role: h.author === config.BLUESKY_IDENTIFIER ? 'assistant' : 'user', content: h.text }))
    ];

    let responseText = await llmService.generateResponse(messages);

    // 6. Semantic Loop Check
    if (responseText) {
      const recentBotReplies = history.filter(h => h.author === config.BLUESKY_IDENTIFIER).map(h => h.text);
      if (await llmService.checkSemanticLoop(responseText, recentBotReplies)) {
        responseText = await llmService.generateResponse([...messages, { role: 'system', content: "Your previous response was too similar to a recent one. Please provide a fresh, different perspective." }]);
      }
    }

    if (responseText) {
      await blueskyService.postReply(notif, responseText);
      await dataStore.updateConversationLength(threadRootUri, convLength + 1);
      await dataStore.saveInteraction({ userHandle: handle, text, response: responseText });
    }
  }

  async getThreadHistory(uri) {
    try {
      const thread = await blueskyService.getPostThread(uri);
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


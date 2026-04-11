import { AtpAgent } from '@atproto/api';
import config from '../../config.js';

class BlueskyService {
  constructor() {
    this.agent = new AtpAgent({ service: 'https://bsky.social' });
    this.did = null;
    this.handle = config.BLUESKY_IDENTIFIER;
    this.password = config.BLUESKY_APP_PASSWORD;
  }

  async init() {
    if (!this.handle || !this.password) {
      console.warn('[BlueskyService] Credentials missing. Bluesky integration disabled.');
      return;
    }
    try {
      console.log(`[BlueskyService] Authenticating as ${this.handle}...`);
      const response = await this.agent.login({ identifier: this.handle, password: this.password });
      this.did = response.data.did;
      console.log('[BlueskyService] Authenticated successfully');
    } catch (error) {
      console.error('[BlueskyService] Authentication failed:', error.message);
    }
  }

  async getNotifications(cursor) {
    if (!this.did) return { notifications: [], cursor: null };
    try {
      const params = { limit: 50 };
      if (cursor) params.cursor = cursor;
      const { data } = await this.agent.listNotifications(params);
      return data;
    } catch (error) {
      console.error('[BlueskyService] Error fetching notifications:', error);
      return { notifications: [], cursor: cursor };
    }
  }

  async updateSeen(seenAt) {
    try {
      if (seenAt && typeof seenAt !== 'string') seenAt = String(seenAt);
      await this.agent.updateSeenNotifications(seenAt);
    } catch (error) { console.error('[BlueskyService] Error updating seen status:', error); }
  }

  async post(text, embed = null, options = {}) {
    if (!this.did) return null;
    try {
      const maxGraphemes = 300;
      const chunks = this.splitIntoGraphemeChunks(text, maxGraphemes);

      let root = null;
      let parent = null;

      for (let i = 0; i < chunks.length; i++) {
        const record = {
          $type: 'app.bsky.feed.post',
          text: chunks[i],
          createdAt: new Date().toISOString(),
        };

        if (i === 0 && embed) record.embed = embed;
        if (i > 0) {
          record.reply = {
            root: { uri: root.uri, cid: root.cid },
            parent: { uri: parent.uri, cid: parent.cid }
          };
        }

        const response = await this.agent.post(record);
        if (i === 0) {
          root = response;
          parent = response;
        } else {
          parent = response;
        }

        // Brief pause between chunks to ensure indexing order
        if (chunks.length > 1 && i < chunks.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
        }
      }

      return root;
    } catch (error) {
      console.error('[BlueskyService] Error creating post:', error);
      return null;
    }
  }

  splitIntoGraphemeChunks(text, limit) {
    if (text.length <= limit) return [text];
    const chunks = [];
    let current = text;
    while (current.length > limit) {
      let splitPos = current.lastIndexOf('\n', limit);
      if (splitPos === -1) splitPos = current.lastIndexOf('. ', limit);
      if (splitPos === -1) splitPos = current.lastIndexOf(' ', limit);
      if (splitPos === -1) splitPos = limit;
      chunks.push(current.substring(0, splitPos).trim());
      current = current.substring(splitPos).trim();
    }
    if (current) chunks.push(current);
    return chunks;
  }

  async postReply(parent, text, options = {}) {
    if (!this.did) return null;
    try {
      const maxGraphemes = 300;
      const chunks = this.splitIntoGraphemeChunks(text, maxGraphemes);

      let root = parent.record?.reply?.root || { uri: parent.uri, cid: parent.cid };
      let currentParent = { uri: parent.uri, cid: parent.cid };

      for (let i = 0; i < chunks.length; i++) {
        const record = {
          $type: 'app.bsky.feed.post',
          text: chunks[i],
          reply: { root, parent: currentParent },
          createdAt: new Date().toISOString(),
        };

        if (i === 0 && options.embed) record.embed = options.embed;

        const response = await this.agent.post(record);
        currentParent = { uri: response.uri, cid: response.cid };

        if (chunks.length > 1 && i < chunks.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
        }
      }
      return { uri: currentParent.uri, cid: currentParent.cid };
    } catch (error) {
      console.error('[BlueskyService] Error creating reply:', error);
      return null;
    }
  }

  async getProfile(actor) {
    try {
      const { data } = await this.agent.getProfile({ actor });
      return data;
    } catch (error) {
      console.error(`[BlueskyService] Error fetching profile for ${actor}:`, error);
      return null;
    }
  }

  async getUserPosts(actor, limit = 20) {
    try {
      const { data } = await this.agent.getAuthorFeed({ actor, limit });
      return data.feed;
    } catch (error) {
      console.error(`[BlueskyService] Error fetching posts for ${actor}:`, error);
      return [];
    }
  }

  async getTimeline(limit = 30) {
    if (!this.did) return { data: { feed: [] } };
    try {
      return await this.agent.getTimeline({ limit });
    } catch (e) {
      console.error('[BlueskyService] Error fetching timeline:', e);
      return { data: { feed: [] } };
    }
  }

  /**
   * Enhanced searchPosts to handle both object options and legacy positional arguments.
   */
  async searchPosts(query, optionsOrSort = {}, limit = 20) {
      try {
          let params = { q: query };
          if (typeof optionsOrSort === 'string') {
              params.sort = optionsOrSort;
              params.limit = limit;
          } else {
              Object.assign(params, optionsOrSort);
          }
          const { data } = await this.agent.app.bsky.feed.searchPosts(params);
          return data.posts;
      } catch (e) {
          console.error('[BlueskyService] Error searching posts:', e);
          return [];
      }
  }

  async uploadBlob(data, encoding) {
      return await this.agent.uploadBlob(data, { encoding });
  }

  async getDetailedThread(uri) {
      try {
          const { data } = await this.agent.getPostThread({ uri });
          if (!data.thread) return [];
          const thread = [];
          let curr = data.thread;
          while (curr) {
              thread.push(curr);
              curr = curr.parent;
          }
          return thread.reverse();
      } catch (e) { return []; }
  }

  async hasBotRepliedTo(uri) {
      try {
          const { data } = await this.agent.getPostThread({ uri });
          if (!data.thread || !data.thread.replies) return false;
          return data.thread.replies.some(r => r.post.author.did === this.did);
      } catch (e) {
          console.warn('[BlueskyService] Error checking if replied to:', uri, e.message);
          return false;
      }
  }
}

export const blueskyService = new BlueskyService();

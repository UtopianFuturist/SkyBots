import { AtpAgent } from '@atproto/api';
import config from '../../config.js';

class BlueskyService {
  constructor() {
    this.agent = new AtpAgent({ service: 'https://bsky.social' });
    this.did = null;
    this.handle = config.BLUESKY_IDENTIFIER;
    this.password = config.BLUESKY_APP_PASSWORD;
  }

  async _withRetry(fn, label = "Bluesky", maxRetries = 3) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        // 503 NotEnoughResources or 429 Rate Limit
        if (error.status === 503 || (error.message && error.message.includes('NotEnoughResources')) || error.error === 'NotEnoughResources' || error.status === 429) {
          const delay = Math.pow(2, i) * 2000;
          console.warn(`[${label}] Retrying after ${delay}ms due to error: ${error.message || error.status}`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  async init() {
    if (!this.handle || !this.password) {
      console.warn('[BlueskyService] Credentials missing. Bluesky integration disabled.');
      return;
    }
    try {
      console.log("[BlueskyService] Authenticating as " + this.handle + "...");
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
      const { data } = await this._withRetry(() => this.agent.listNotifications(params), "listNotifications");
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
    if (!text || !text.trim()) {
      console.warn("[BlueskyService] Attempted to post blank text. Aborting.");
      return null;
    }
    if (text.trim() === "...") {
      console.warn("[BlueskyService] Attempted to post only ellipses. Aborting.");
      return null;
    }
    if (!this.did) return null;
    try {
      const maxGraphemes = 280;
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

        const response = await this._withRetry(() => this.agent.post(record), "post");
        if (i === 0) {
          root = response;
          parent = response;
        } else {
          parent = response;
        }

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
    const ellipsis = "...";
    const chunkLimit = limit - ellipsis.length;

    while (current.length > limit) {
      let splitPos = current.lastIndexOf('\n', chunkLimit);
      if (splitPos === -1) splitPos = current.lastIndexOf('. ', chunkLimit);
      if (splitPos === -1) splitPos = current.lastIndexOf(' ', chunkLimit);
      if (splitPos <= 0) splitPos = chunkLimit;

      const chunkText = current.substring(0, splitPos).trim();
      if (chunkText) {
          chunks.push(chunkText + ellipsis);
          current = current.substring(splitPos).trim();
      } else {
          chunks.push(current.substring(0, chunkLimit) + ellipsis);
          current = current.substring(chunkLimit).trim();
      }
      if (!current) break;
    }
    if (current) chunks.push(current);
    return chunks;
  }

  async postReply(parent, text, options = {}) {
    if (!text || !text.trim()) {
      if (text.trim() === "...") {
        console.warn("[BlueskyService] Attempted to post only ellipses reply. Aborting.");
        return null;
      }
      console.warn("[BlueskyService] Attempted to post blank reply. Aborting.");
      return null;
    }
    if (!this.did) return null;
    try {
      const maxGraphemes = 280;
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

        const response = await this._withRetry(() => this.agent.post(record), "postReply");
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
      const { data } = await this._withRetry(() => this.agent.getProfile({ actor }), "getProfile").catch(e => {
          if (e.message && e.message.includes('Forbidden')) return { data: { handle: actor, did: null } };
          throw e;
      });
      return data;
    } catch (error) {
      console.error("[BlueskyService] Error fetching profile for " + actor + ":", error.message);
      return null;
    }
  }

  async getUserPosts(actor, limit = 20) {
    try {
      const { data } = await this._withRetry(() => this.agent.getAuthorFeed({ actor, limit }), "getAuthorFeed").catch(e => {
          if (e.message && e.message.includes('Forbidden')) return { data: { feed: [] } };
          throw e;
      });
      return data.feed || [];
    } catch (error) {
      console.error("[BlueskyService] Error fetching posts for " + actor + ":", error.message);
      return [];
    }
  }

  async getTimeline(limit = 30) {
    if (!this.did) return { data: { feed: [] } };
    try {
      return await this._withRetry(() => this.agent.getTimeline({ limit }), "getTimeline").catch(e => { console.warn("[BlueskyService] Timeline 403 fallback"); return { data: { feed: [] } }; });
    } catch (e) {
      console.error('[BlueskyService] Error fetching timeline:', e);
      return { data: { feed: [] } };
    }
  }

  async searchPosts(query, optionsOrSort = {}, limit = 20) {
      try {
          let params = { q: query };
          if (typeof optionsOrSort === 'string') {
              params.sort = optionsOrSort;
              params.limit = limit;
          } else {
              Object.assign(params, optionsOrSort);
          }
          const { data } = await this._withRetry(() => this.agent.app.bsky.feed.searchPosts(params), "searchPosts");
          return data.posts;
      } catch (e) {
          console.error('[BlueskyService] Error searching posts:', e);
          return [];
      }
  }

  async uploadBlob(data, encoding) {
      return await this._withRetry(() => this.agent.uploadBlob(data, { encoding }), "uploadBlob");
  }

  async getDetailedThread(uri) {
      try {
          const { data } = await this._withRetry(() => this.agent.app.bsky.feed.getPostThread({ uri }), "getPostThread").catch(e => {
              if (e.message && e.message.includes('Forbidden')) return { data: {} };
              throw e;
          });
          if (!data || !data.thread) return [];
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
          const { data } = await this._withRetry(() => this.agent.app.bsky.feed.getPostThread({ uri }), "hasBotRepliedTo").catch(e => {
              if (e.message && e.message.includes('Forbidden')) return { data: {} };
              throw e;
          });
          if (!data || !data.thread || !data.thread.replies) return false;
          return data.thread.replies.some(r => r.post && r.post.author && r.post.author.did === this.did);
      } catch (e) {
          console.warn('[BlueskyService] Error checking if replied to:', uri, e.message);
          return false;
      }
  }
  async upsertThreadgate(uri, rules = {}) {
    if (!this.did) return;
    try {
      const { allowMentions = false, allowFollowing = false } = rules;
      const allow = [];
      if (allowMentions) allow.push({ $type: 'app.bsky.feed.threadgate#mentionRule' });
      if (allowFollowing) allow.push({ $type: 'app.bsky.feed.threadgate#followingRule' });

      await this._withRetry(() => this.agent.api.com.atproto.repo.putRecord({
        repo: this.did,
        collection: 'app.bsky.feed.threadgate',
        rkey: uri.split('/').pop(),
        record: {
          $type: 'app.bsky.feed.threadgate',
          post: uri,
          allow: allow,
          createdAt: new Date().toISOString(),
        }
      }), "upsertThreadgate");
    } catch (error) {
      console.error('[BlueskyService] Error upserting threadgate:', error.message);
    }
  }

}

export const blueskyService = new BlueskyService();

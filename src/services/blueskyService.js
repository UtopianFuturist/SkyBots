import { BskyAgent } from '@atproto/api';
import config from '../../config.js';

class BlueskyService {
  constructor() {
    this.agent = new BskyAgent({ service: 'https://bsky.social' });
    this.did = null;
    this.handle = config.BLUESKY_IDENTIFIER;
  }

  async init() {
    if (!config.BLUESKY_IDENTIFIER || !config.BLUESKY_PASSWORD) {
        console.warn('[BlueskyService] Missing credentials. Service disabled.');
        return;
    }
    try {
      await this.agent.login({ identifier: config.BLUESKY_IDENTIFIER, password: config.BLUESKY_PASSWORD });
      this.did = this.agent.session.did;
      console.log('[BlueskyService] Logged in as: ' + this.did);
    } catch (error) {
      console.error('[BlueskyService] Login failed:', error.message);
    }
  }

  async post(text, embed = null) {
    if (!text || !text.trim()) {
      console.warn("[BlueskyService] Attempted to post blank text. Aborting.");
      return null;
    }
    // Prevent dot-only or whitespace-only posts
    if (text.trim().replace(/[.\s]/g, '').length === 0 && text.trim().length > 0) {
       console.warn("[BlueskyService] Attempted to post punctuation-only text. Aborting.");
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

        const response = await this.agent.post(record);
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
      console.warn("[BlueskyService] Attempted to post blank reply. Aborting.");
      return null;
    }
    // Prevent dot-only or whitespace-only replies (unless explicitly intended which is rare)
    if (text.trim().replace(/[.\s]/g, '').length === 0 && text.trim().length > 0) {
       console.warn("[BlueskyService] Attempted to post punctuation-only reply. Aborting.");
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
      const { data } = await this.agent.getProfile({ actor }).catch(e => {
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
      const { data } = await this.agent.getAuthorFeed({ actor, limit }).catch(e => {
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
      return await this.agent.getTimeline({ limit }).catch(e => { console.warn("[BlueskyService] Timeline 403 fallback"); return { data: { feed: [] } }; });
    } catch (e) {
      console.error('[BlueskyService] Error fetching timeline:', e);
      return { data: { feed: [] } };
    }
  }

  async getNotifications(cursor = null) {
      try {
          const { data } = await this.agent.listNotifications({ limit: 50, cursor });
          return data;
      } catch (e) { return null; }
  }

  async updateSeen(timestamp) {
      try { await this.agent.updateSeenNotifications({ seenAt: timestamp }); } catch (e) {}
  }

  async searchPosts(query, params = {}) {
      try {
          const { data } = await this.agent.app.bsky.feed.searchPosts({ q: query, ...params });
          return data.posts;
      } catch (e) {
          console.error('[BlueskyService] Error searching posts:', e);
          return [];
      }
  }

  async deletePost(uri) {
      try {
          const rkey = uri.split('/').pop();
          await this.agent.deletePost({ repo: this.did, rkey });
          return true;
      } catch (e) { return false; }
  }

  async getDetailedThread(uri) {
      try {
          const { data } = await this.agent.app.bsky.feed.getPostThread({ uri }).catch(e => {
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
}

export const blueskyService = new BlueskyService();

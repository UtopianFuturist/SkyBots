import { AtpAgent, RichText } from '@atproto/api';
import fetch from 'node-fetch';
import config from '../../config.js';
import { splitText } from '../utils/textUtils.js';

class BlueskyService {
  constructor() {
    this.agent = new AtpAgent({
      service: 'https://bsky.social',
      headers: [['User-Agent', 'Bot/1.0 (Render; +https://dearest-llama.onrender.com)']]
    });
  }

  get did() {
    return this.agent?.session?.did;
  }

  async init() {
    return await this.authenticate();
  }

  async authenticate() {
    console.log(`[BlueskyService] Authenticating as ${config.BLUESKY_IDENTIFIER}...`);
    try {
      await this.agent.login({
        identifier: config.BLUESKY_IDENTIFIER,
        password: config.BLUESKY_APP_PASSWORD,
      });
      console.log('[BlueskyService] Authenticated successfully');
    } catch (error) {
      console.error('[BlueskyService] Authentication failed:', error.message);
      throw error;
    }
  }

  async getNotifications(cursor) {
    try {
      const params = { limit: 10 };
      if (cursor) {
        params.cursor = cursor;
      }
      const { data } = await this.agent.listNotifications(params);
      return data;
    } catch (error) {
      console.error('[BlueskyService] Error fetching notifications:', error);
      return { notifications: [], cursor: cursor };
    }
  }

  async updateSeen(seenAt) {
    try {
      if (seenAt && typeof seenAt !== 'string') {
        seenAt = String(seenAt);
      }
      await this.agent.updateSeenNotifications(seenAt);
      console.log(`[BlueskyService] Updated notification seen status${seenAt ? ` up to ${seenAt}` : ''}.`);
    } catch (error) {
      console.error('[BlueskyService] Error updating notification seen status:', error);
    }
  }

  async getDetailedThread(uri) {
    try {
      const { data } = await this.agent.getPostThread({
        uri,
        depth: 100,
        parentHeight: 100,
      });
      return data.thread;
    } catch (error) {
      if (error.name === 'NotFoundError' || error.message?.includes('Post not found')) {
        console.warn(`[BlueskyService] Post not found: ${uri}`);
      } else {
        console.error('[BlueskyService] Error fetching detailed thread:', error);
      }
      return null;
    }
  }

  async hasBotRepliedTo(uri) {
      try {
          const thread = await this.getDetailedThread(uri);
          if (!thread || !thread.replies) return false;
          return thread.replies.some(r => r.post?.author?.did === this.did);
      } catch (e) { return false; }
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
      return data.feed.map(f => f.post);
    } catch (error) {
      console.error(`[BlueskyService] Error fetching posts for ${actor}:`, error);
      return [];
    }
  }

  async getTimeline(limit = 20) {
      try {
          return await this.agent.getTimeline({ limit });
      } catch (e) {
          console.error('[BlueskyService] Error fetching timeline:', e);
          return { data: { feed: [] } };
      }
  }

  async searchPosts(query, options = {}) {
      try {
          const { data } = await this.agent.app.bsky.feed.searchPosts({ q: query, ...options });
          return data.posts;
      } catch (e) {
          console.error('[BlueskyService] Error searching posts:', e);
          return [];
      }
  }

  async resolveDid(actor) {
      try {
          const profile = await this.getProfile(actor);
          return profile?.handle || actor;
      } catch (e) { return actor; }
  }

  async uploadBlob(buffer, encoding) {
      return await this.agent.uploadBlob(buffer, { encoding });
  }

  async postReply(parentPost, text, options = {}) {
      const rt = new RichText({ text });
      await rt.detectFacets(this.agent);
      const postData = {
          $type: 'app.bsky.feed.post',
          text: rt.text,
          facets: rt.facets,
          reply: {
              root: parentPost.record?.reply?.root || { uri: parentPost.uri, cid: parentPost.cid },
              parent: { uri: parentPost.uri, cid: parentPost.cid }
          },
          createdAt: new Date().toISOString(),
          ...options
      };
      return await this.agent.post(postData);
  }

  async post(text, embed = null, options = {}) {
    console.log('[BlueskyService] Creating new post...');
    try {
      const rt = new RichText({ text });
      await rt.detectFacets(this.agent);

      const postData = {
        $type: 'app.bsky.feed.post',
        text: rt.text,
        facets: rt.facets,
        createdAt: new Date().toISOString(),
      };

      if (embed) postData.embed = embed;

      return await this.agent.post(postData);
    } catch (error) {
      console.error('[BlueskyService] Error creating post:', error);
      return null;
    }
  }

  async getExternalEmbed(url) {
    try {
      const response = await fetch(url);
      const html = await response.text();
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : url;
      return {
        $type: 'app.bsky.embed.external',
        external: { uri: url, title: title, description: '' }
      };
    } catch (error) {
      return null;
    }
  }

  async deletePost(uri) {
      const rkey = uri.split('/').pop();
      return await this.agent.deletePost(uri);
  }
}

export const blueskyService = new BlueskyService();

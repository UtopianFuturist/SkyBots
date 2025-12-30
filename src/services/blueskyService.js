import { AtpAgent } from '@atproto/api';
import config from '../../config.js';
import { splitText } from '../utils/textUtils.js';

class BlueskyService {
  constructor() {
    this.agent = new AtpAgent({
      service: 'https://bsky.social',
    });
  }

  async authenticate() {
    await this.agent.login({
      identifier: config.BLUESKY_IDENTIFIER,
      password: config.BLUESKY_APP_PASSWORD,
    });
    console.log('[BlueskyService] Authenticated successfully');
  }

  async getNotifications(cursor) {
    const params = { limit: 50 };
    if (cursor) {
      params.cursor = cursor;
    }
    const { data } = await this.agent.listNotifications(params);
    return data;
  }

  async getDetailedThread(uri) {
    try {
      const { data } = await this.agent.getPostThread({
        uri,
        depth: 20,
        parentHeight: 20,
      });
      return data.thread;
    } catch (error) {
      console.error('[BlueskyService] Error fetching detailed thread:', error);
      return null;
    }
  }

  async postReply(parentPost, text, embed = null) {
    console.log(`[BlueskyService] LLM Response: "${text}"`);
    console.log('[BlueskyService] Posting reply...');
    const textChunks = splitText(text);
    let currentParent = parentPost;
    let rootPost = parentPost.record.reply?.root || { uri: parentPost.uri, cid: parentPost.cid };

    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];
      const reply = {
        root: rootPost,
        parent: { uri: currentParent.uri, cid: currentParent.cid },
      };

      const postData = {
        $type: 'app.bsky.feed.post',
        text: chunk,
        reply,
        createdAt: new Date().toISOString(),
      };

      // Only add the embed to the first post in the chain
      if (i === 0 && embed) {
        postData.embed = embed;
      }

      const { uri, cid } = await this.agent.post(postData);
      console.log(`[BlueskyService] Posted chunk ${i + 1}/${textChunks.length}: ${uri}`);

      // The new post becomes the parent for the next chunk
      currentParent = { uri, cid };
      if (i === 0) {
        // After the first post, the root remains the same
        rootPost = reply.root;
      }
    }
    console.log('[BlueskyService] Finished posting reply chain.');
  }

  async getProfile(actor) {
    const { data } = await this.agent.getProfile({ actor });
    return data;
  }

  async getUserPosts(actor) {
    try {
      const { data } = await this.agent.getAuthorFeed({
        actor,
        limit: 15,
      });
      return data.feed.map(item => item.post.record.text);
    } catch (error) {
      console.error(`[BlueskyService] Error fetching posts for ${actor}:`, error);
      return [];
    }
  }

  async postAlert(text) {
    console.log('[BlueskyService] Posting alert to admin...');
    try {
      await this.agent.post({
        $type: 'app.bsky.feed.post',
        text: `@${config.ADMIN_BLUESKY_HANDLE} ${text}`,
        createdAt: new Date().toISOString(),
      });
      console.log('[BlueskyService] Alert posted successfully.');
    } catch (error) {
      console.error('[BlueskyService] Error posting alert:', error);
    }
  }

  async likePost(uri, cid) {
    try {
      await this.agent.like(uri, cid);
      console.log(`[BlueskyService] Liked post: ${uri}`);
    } catch (error) {
      console.error('[BlueskyService] Error liking post:', error);
    }
  }

  async post(text, embed = null) {
    console.log('[BlueskyService] Creating new post...');
    try {
      const postData = {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date().toISOString(),
      };
      if (embed) {
        postData.embed = embed;
      }
      await this.agent.post(postData);
      console.log('[BlueskyService] New post created successfully.');
    } catch (error) {
      console.error('[BlueskyService] Error creating new post:', error);
    }
  }
}

export const blueskyService = new BlueskyService();

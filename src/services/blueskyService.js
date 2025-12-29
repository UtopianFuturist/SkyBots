import { AtpAgent } from '@atproto/api';
import config from '../../config.js';

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
    const { data } = await this.agent.listNotifications({
      limit: 50,
      cursor
    });
    return data;
  }

  async getPostThread(uri) {
    const { data } = await this.agent.getPostThread({
      uri,
      depth: 5,
      parentHeight: 5
    });
    return data.thread;
  }

  async postReply(parentPost, text, embed = null) {
    const reply = {
      root: parentPost.record.reply?.root || { uri: parentPost.uri, cid: parentPost.cid },
      parent: { uri: parentPost.uri, cid: parentPost.cid }
    };

    const postData = {
      $type: 'app.bsky.feed.post',
      text,
      reply,
      createdAt: new Date().toISOString(),
    };

    if (embed) {
      postData.embed = embed;
    }

    return await this.agent.post(postData);
  }

  async getProfile(actor) {
    const { data } = await this.agent.getProfile({ actor });
    return data;
  }
}

export const blueskyService = new BlueskyService();

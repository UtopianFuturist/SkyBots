import { AtpAgent, RichText } from '@atproto/api';
import config from '../../config.js';

class BlueskyService {
  constructor() {
    this.agent = new AtpAgent({ service: 'https://bsky.social' });
    this.did = null;
  }

  async authenticate() {
    await this.agent.login({ identifier: config.BLUESKY_IDENTIFIER, password: config.BLUESKY_APP_PASSWORD });
    this.did = this.agent.session.did;
    console.log('[BlueskyService] Authenticated.');
  }

  async post(text, embed = null) {
    const rt = new RichText({ text });
    await rt.detectFacets(this.agent);
    const result = await this.agent.post({ text: rt.text, facets: rt.facets, embed, createdAt: new Date().toISOString() });
    return result;
  }

  async postReply(parentPost, text) {
    const rt = new RichText({ text });
    await rt.detectFacets(this.agent);
    const parent = { uri: parentPost.uri, cid: parentPost.cid };
    const root = parentPost.record?.reply?.root || parent;
    return await this.agent.post({
        text: rt.text, facets: rt.facets,
        reply: { root, parent },
        createdAt: new Date().toISOString()
    });
  }

  async getProfile(actor) {
    const res = await this.agent.getProfile({ actor });
    return res.data;
  }

  async getUserPosts(actor, limit = 10) {
    const res = await this.agent.getAuthorFeed({ actor, limit });
    return res.data.feed.map(f => f.post);
  }

  async getTimeline(limit = 20) {
    return await this.agent.getTimeline({ limit });
  }

  async searchPosts(q, sort = 'latest', limit = 25) {
    const res = await this.agent.app.bsky.feed.searchPosts({ q, sort, limit });
    return res.data.posts;
  }

  async uploadBlob(data, encoding = 'image/jpeg') {
    return await this.agent.uploadBlob(data, { encoding });
  }
}

export const blueskyService = new BlueskyService();

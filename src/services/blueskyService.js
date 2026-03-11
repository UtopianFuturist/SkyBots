import { dataStore } from './dataStore.js';
import { llmService } from "./llmService.js";
import { AtpAgent, RichText } from '@atproto/api';
import fetch from 'node-fetch';
import config from '../../config.js';
import { splitText } from '../utils/textUtils.js';

class BlueskyService {
  constructor() {
    this.agent = new AtpAgent({ service: 'https://bsky.social' });
    this.did = null;
  }
  get js() { return this; }
  async authenticate() {
    await this.agent.login({ identifier: config.BLUESKY_IDENTIFIER, password: config.BLUESKY_APP_PASSWORD });
    this.did = this.agent.session.did;
    console.log('[BlueskyService] Authenticated successfully');
  }
  async post(text, embed = null) {
    const consistency = await llmService.checkConsistency(text, "bluesky");
    if (!consistency.consistent) return null;
    try {
      const rt = new RichText({ text });
      await rt.detectFacets(this.agent);
      const postData = { $type: 'app.bsky.feed.post', text: rt.text, facets: rt.facets, createdAt: new Date().toISOString() };
      if (embed) postData.embed = embed;
      const res = await this.agent.post(postData); await dataStore.addInternalLog("bluesky_post", text); return res;
    } catch (error) { return null; }
  }
  async postReply(parent, text, options = {}) {
    try {
      const rt = new RichText({ text });
      await rt.detectFacets(this.agent);
      const postData = {
        $type: 'app.bsky.feed.post', text: rt.text, facets: rt.facets, createdAt: new Date().toISOString(),
        reply: { root: parent.record?.reply?.root || parent, parent: parent }
      };
      if (options.embed) postData.embed = options.embed;
      return await this.agent.post(postData);
    } catch (error) { return null; }
  }
  async searchPosts(query, sort = 'latest', limit = 15) {
    try {
      const res = await this.agent.api.app.bsky.feed.searchPosts({ q: query, sort, limit });
      return res.data.posts;
    } catch (error) { return []; }
  }
  async getProfile(handle) {
    try {
      const res = await this.agent.getProfile({ actor: handle });
      return res.data;
    } catch (error) { return null; }
  }
  async getUserPosts(did, limit = 50) {
    try {
      const res = await this.agent.getAuthorFeed({ actor: did, limit });
      return res.data.feed.map(f => f.post);
    } catch (error) { return []; }
  }
  async deletePost(uri) {
    try {
      await this.agent.api.com.atproto.repo.deleteRecord({ repo: this.did, collection: 'app.bsky.feed.post', rkey: uri.split('/').pop() });
      return true;
    } catch (error) { return false; }
  }
  async upsertThreadgate(uri, options = {}) {
    try {
      const record = { $type: 'app.bsky.feed.threadgate', post: uri, createdAt: new Date().toISOString(), allow: options.allowFollowing ? [{ $type: 'app.bsky.feed.threadgate#followingRule' }] : [] };
      await this.agent.api.com.atproto.repo.putRecord({ repo: this.did, collection: 'app.bsky.feed.threadgate', rkey: uri.split('/').pop(), record });
    } catch (e) {}
  }
  async uploadBlob(buffer, encoding) { return await this.agent.uploadBlob(buffer, { encoding }); }
  async getExternalEmbed(url) { return null; }
  async uploadImages(images) { return null; }
  async registerComindAgent() {}
  async submitAutonomyDeclaration() {}
  async likePost() {}
  async follow() {}
  async unfollow() {}
  async mute() {}
  async unmute() {}
  async updateSeen() {}
  async getNotifications(cursor) {
    try {
      const res = await this.agent.api.app.bsky.notification.listNotifications({ cursor, limit: 50 });
      return res.data;
    } catch (error) { return { notifications: [] }; }
  }
  async getTimeline() { return { data: { feed: [] } }; }
  async getDetailedThread(uri) {
      try {
          const res = await this.agent.api.app.bsky.feed.getPostThread({ uri });
          return res.data.thread;
      } catch (e) { return null; }
  }
  async getPostDetails() { return null; }
  async getPastInteractions() { return []; }
  async getUserActivity() { return []; }
  async hasBotRepliedTo() { return false; }
  async resolveDid(h) { return h; }
}

export const blueskyService = new BlueskyService();

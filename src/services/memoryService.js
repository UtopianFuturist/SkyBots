import config from '../../config.js';
import { blueskyService } from './blueskyService.js';
import { dataStore } from './dataStore.js';
import { llmService } from './llmService.js';
import { checkExactRepetition } from '../utils/textUtils.js';
import { introspectionService } from './introspectionService.js';

class MemoryService {
  constructor() {
    this.hashtag = config.MEMORY_THREAD_HASHTAG;
    this.recentMemories = [];
    this.processingQueue = Promise.resolve();
    this.rootPost = null;
  }

  get js() { return this; }
  isEnabled() { return this.hashtag && this.hashtag !== 'DISABLED' && config.BLUESKY_IDENTIFIER; }

  async fetchRecentMemories(hashtag, limit = 15) {
    if (!this.isEnabled()) return [];
    try {
      let posts = await blueskyService.searchPosts(`from:${blueskyService.did} ${hashtag}`, { limit: limit * 2, sort: 'latest' });
      if (!posts || posts.length === 0) {
          const rawPosts = await blueskyService.getUserPosts(blueskyService.did, limit * 5);
          posts = rawPosts.filter(p => p.post.record.text.includes(hashtag)).map(p => p.post);
      }
      this.recentMemories = posts
        .filter(p => p.record.text.includes(hashtag))
        .map(p => ({
            uri: p.uri, cid: p.cid, text: p.record.text.replace(hashtag, '').trim(),
            category: this._extractCategory(p.record.text),
            timestamp: new Date(p.record.createdAt).getTime(),
            indexedAt: p.record.createdAt,
            originalPost: p
        })).slice(0, limit);
      if (this.recentMemories.length > 0) {
        const first = this.recentMemories[0].originalPost;
        this.rootPost = first.record.reply?.root || first;
      }
      return this.recentMemories;
    } catch (error) {
        return [];
    }
  }

  _extractCategory(text) {
    const categories = ['persona', 'directive', 'relationship', 'interaction', 'mood', 'inquiry', 'mental', 'goal', 'explore', 'status', 'research', 'admin_fact', 'schedule', 'fact', 'audit', 'recursion', 'reflection', 'insight'];
    for (const cat of categories) {
        if (text.toUpperCase().includes(`[${cat.toUpperCase()}]`)) return cat;
    }
    return 'general';
  }

  formatMemoriesForPrompt() {
      if (!this.recentMemories || this.recentMemories.length === 0) return "";
      return this.recentMemories.map(m => m.text.replace(new RegExp(this.hashtag, 'g'), '').trim()).join("\n");
  }

  async cleanupMemoryThread() {
    if (!this.isEnabled()) return;
    try {
        const profile = await blueskyService.getProfile(config.BLUESKY_IDENTIFIER);
        const posts = await blueskyService.searchPosts(`from:${profile.did} ${this.hashtag}`, { limit: 100, sort: 'latest' });
        for (const post of posts) {
            await blueskyService.deletePost(post.uri);
        }
    } catch (e) {}
  }

  getDynamicWindowSize(taskType) {
    if (taskType === 'deep_reflection') return 50;
    if (taskType === 'persona_audit') return 30;
    return 15;
  }

  async getRecentMemoriesFormatted(excludeTags = []) {
    const memories = await this.getRecentMemories(30);
    if (!memories || memories.length === 0) return "No memories yet.";
    const pinned = memories.filter(m => m.text.includes("[PINNED]"));
    const normal = memories.filter(m => !m.text.includes("[PINNED]"));
    return [...pinned, ...normal]
        .filter(m => !excludeTags.some(tag => m.text.toUpperCase().includes(tag.toUpperCase())))
        .map(m => `[${new Date(m.timestamp).toLocaleDateString()}] ${m.text.replace(new RegExp(this.hashtag, 'g'), '').trim()}`)
        .join('\n');
  }

  async createMemoryEntry(type, context, timestamp = null) {
    if (!this.isEnabled()) return null;
    return this.processingQueue = this.processingQueue.then(async () => {
        try { return await this._createMemoryEntryInternal(type, context, timestamp); } catch (error) { return null; }
    });
  }

  async _createMemoryEntryInternal(type, context, timestamp = null) {
    const cleanContext = (context || '')
        .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
        .replace(/<thinking>[\s\S]*?<\/(thinking|think)>/gi, '')
        .trim();
    if (!cleanContext || cleanContext.length === 0) return null;
    const history = await this.fetchRecentMemories(this.hashtag, 20);
    if (checkExactRepetition(cleanContext, history, 20)) return;
    try {
      const dateStr = new Date().toLocaleDateString('en-US');
      const systemPrompt = `Generate a concise memory entry for type: ${type}. Date: ${dateStr}. Context: ${cleanContext}. Format: [${type.toUpperCase()}] [${dateStr}] [Summary]`;
      let entryText = await llmService.generateResponse([{ role: 'system', content: systemPrompt }], { useStep: true });
      if (entryText) {
        entryText = entryText.trim().replace(/<thinking>[\s\S]*?<\/(thinking|think)>/gi, '').replace(new RegExp(this.hashtag, 'g'), '').trim();
        const tag = type.toUpperCase();
        const finalEntry = (entryText.includes(`[${tag}]`) && /\[\d+\/\d+\/\d+\]/.test(entryText)) ? entryText : `[${tag}] [${dateStr}] ${entryText}`;
        const finalWithHashtag = finalEntry + `\n\n${this.hashtag}`;
        const latestPost = await this.findLatestMemoryPost();
        let result = null;
        if (latestPost) {
            result = await blueskyService.postReply(latestPost, finalWithHashtag);
        } else {
            result = await blueskyService.post(finalWithHashtag);
            if (result) this.rootPost = result;
        }
        if (result) {
            this.recentMemories.push({ text: finalWithHashtag, indexedAt: new Date().toISOString() });
        }
        return result;
      }
    } catch (error) {}
    return null;
  }

  async findLatestMemoryPost() {
      const memories = await this.fetchRecentMemories(this.hashtag, 1);
      return memories.length > 0 ? memories[0].originalPost : null;
  }

  async getContextualMemories(query, taskType = 'reply') {
    const limit = this.getDynamicWindowSize(taskType);
    let memories = await this.getRecentMemories(limit);
    return memories;
  }

  async getRecentMemories(limit = 15) { return await this.fetchRecentMemories(this.hashtag, limit); }
}

export const memoryService = new MemoryService();

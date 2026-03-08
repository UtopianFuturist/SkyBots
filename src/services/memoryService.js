import { checkExactRepetition, checkSimilarity } from "../utils/textUtils.js";
import { ensureStandardTag } from "../utils/tagUtils.js";
import { blueskyService } from './blueskyService.js';
import { llmService } from './llmService.js';
import config from '../../config.js';
import { dataStore } from './dataStore.js';

class MemoryService {
  constructor() {
    this.hashtag = config.MEMORY_THREAD_HASHTAG;
    this.recentMemories = [];
    this.processingQueue = Promise.resolve();
  }

  get js() { return this; }
  isEnabled() { return this.hashtag && this.hashtag !== 'DISABLED' && config.BLUESKY_IDENTIFIER; }

  async fetchRecentMemories(hashtag, limit = 15) {
    if (!this.isEnabled()) return [];
    try {
      const query = `from:${blueskyService.did} ${hashtag}`;
      const posts = await blueskyService.searchPosts(query, 'latest', limit);
      this.recentMemories = posts.map(p => ({
        uri: p.uri, cid: p.cid, text: p.record.text.replace(hashtag, '').trim(),
        category: this._extractCategory(p.record.text),
        timestamp: new Date(p.record.createdAt).getTime(),
        indexedAt: p.record.createdAt
      }));
      return this.recentMemories;
    } catch (error) { return []; }
  }

  _extractCategory(text) {
    const categories = ['exploration', 'learning', 'status', 'meta', 'agentic', 'philosophy', 'reflection', 'research'];
    for (const cat of categories) { if (text.toLowerCase().includes(`[${cat}]`)) return cat; }
    return 'general';
  }

  formatMemoriesForPrompt(excludeTags = []) {
    if (!this.isEnabled() || this.recentMemories.length === 0) return "No recent memories available.";
    const pinned = this.recentMemories.filter(m => m.text.includes("[PINNED]"));
    const normal = this.recentMemories.filter(m => !m.text.includes("[PINNED]"));
    return [...pinned, ...normal].filter(m => !excludeTags.some(tag => m.text.includes(tag))).map(m => `[${new Date(m.timestamp).toLocaleDateString()}] ${m.text}`).join('\n');
  }

  async createMemoryEntry(type, context, timestamp = null) {
    if (!this.isEnabled()) return null;
    return this.processingQueue = this.processingQueue.then(async () => {
        try { return await this._createMemoryEntryInternal(type, context, timestamp); } catch (error) { return null; }
    });
  }

  async _createMemoryEntryInternal(type, context, timestamp = null) {
    const consistency = await llmService.checkConsistency(context, "memory");
    if (!consistency.consistent) return null;
    if (context.length === 0) return;
    const history = await this.fetchRecentMemories(this.hashtag, 20);
    if (checkExactRepetition(context, history, 20)) return;
    try {
      const entryText = await llmService.generateResponse([{ role: 'system', content: `Generate memory entry for type: ${type}. Context: ${context}.` }], { useStep: true, preface_system_prompt: false });
      if (entryText) return await blueskyService.post(ensureStandardTag(entryText.trim(), type) + " " + this.hashtag);
    } catch (error) {}
    return null;
  }

  async getRecentMemories(limit = 15) { return await this.fetchRecentMemories(this.hashtag, limit); }
  async cleanupMemoryThread() {}
  async secureThread(uri) { try { await blueskyService.upsertThreadgate(uri, { allowMentions: false, allowFollowing: true }); } catch (e) {} }
  async secureAllThreads() {
    if (!this.isEnabled()) return;
    try {
        const posts = await blueskyService.searchPosts(`from:${blueskyService.did} ${this.hashtag}`, { limit: 100, sort: 'latest' });
        for (const post of posts) { await this.secureThread(post.record.reply?.root?.uri || post.uri); }
    } catch (e) {}
  }
  async performDailyKnowledgeAudit() {}
  async auditMemoriesForReconstruction() {}
  async getLatestMoodMemory() { return null; }
  async searchMemories(query) { return (this.recentMemories || []).filter(m => m.text.includes(query)); }
}

export const memoryService = new MemoryService();

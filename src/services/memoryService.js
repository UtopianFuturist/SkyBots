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

  isEnabled() {
    return this.hashtag && this.hashtag !== 'DISABLED' && config.BLUESKY_IDENTIFIER;
  }

  async fetchRecentMemories(hashtag, limit = 15) {
    if (!this.isEnabled()) return [];
    try {
      const query = `from:${blueskyService.did} ${hashtag}`;
      const posts = await blueskyService.searchPosts(query, 'latest', limit);
      this.recentMemories = posts.map(p => ({
        uri: p.uri,
        cid: p.cid,
        text: p.record.text.replace(hashtag, '').trim(),
        category: this._extractCategory(p.record.text),
        timestamp: new Date(p.record.createdAt).getTime(),
        indexedAt: p.record.createdAt
      }));
      return this.recentMemories;
    } catch (error) {
      return [];
    }
  }

  _extractCategory(text) {
    const categories = ['exploration', 'learning', 'status', 'meta', 'agentic', 'philosophy', 'reflection', 'research'];
    for (const cat of categories) {
      if (text.toLowerCase().includes(`[${cat}]`)) return cat;
    }
    return 'general';
  }

  formatMemoriesForPrompt(excludeTags = []) {
    if (!this.isEnabled() || this.recentMemories.length === 0) return "No recent memories available.";
    const now = Date.now();
    const pinned = this.recentMemories.filter(m => m.text.includes("[PINNED]"));
    const normal = this.recentMemories.filter(m => !m.text.includes("[PINNED]"));
    return [...pinned, ...normal].filter(m => !excludeTags.some(tag => m.text.includes(tag))).map(m => {
        let cleanText = m.text;
        if (this.hashtag) cleanText = cleanText.replace(new RegExp(this.hashtag, 'g'), '').trim();
        return `[${new Date(m.timestamp).toLocaleDateString()}] ${cleanText}`;
    }).join('\n');
  }

  async createMemoryEntry(type, context, timestamp = null) {
    if (!this.isEnabled()) return null;
    return this.processingQueue = this.processingQueue.then(async () => {
        try {
            return await this._createMemoryEntryInternal(type, context, timestamp);
        } catch (error) {
            return null;
        }
    });
  }

  async _createMemoryEntryInternal(type, context, timestamp = null) {
    const consistency = await llmService.checkConsistency(context, "memory");
    if (!consistency.consistent) return null;
    if (context.length === 0) return;
    const history = await this.fetchRecentMemories(this.hashtag, 20);
    if (checkExactRepetition(context, history, 20)) return;

    const prompt = `Generate memory entry for type: ${type}. Context: ${context}. Respond with entry and hashtag ${this.hashtag}.`;
    try {
      const entryText = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true, preface_system_prompt: false });
      if (entryText) {
          const standardized = ensureStandardTag(entryText.trim(), type);
          return await blueskyService.post(standardized);
      }
    } catch (error) {}
    return null;
  }

  async getRecentMemories(limit = 15) {
    return await this.fetchRecentMemories(this.hashtag, limit);
  }

  async cleanupMemoryThread() {}

  async secureThread(uri) {
    try { await blueskyService.upsertThreadgate(uri, { allowMentions: false, allowFollowing: true }); } catch (e) {}
  }

  async performDailyKnowledgeAudit() {
    const hashtag = config.MEMORY_THREAD_HASHTAG;
    const memories = await this.fetchRecentMemories(hashtag, 50);
    if (memories.length === 0) return;
    const auditPrompt = `Recursive Knowledge Audit. Memories: ${memories.map(m => m.text).join('\n')}. Respond with JSON { "synthesis": "" }.`;
    const audit = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true });
    try {
        const match = audit?.match(/\{[\s\S]*\}/);
        const result = match ? JSON.parse(match[0]) : null;
        if (result && result.synthesis) await this.createMemoryEntry('reflection', `[RECURSIVE_LEARNING] ${result.synthesis}`);
    } catch (e) {}
  }

  async auditMemoriesForReconstruction() {
    const memories = await this.fetchRecentMemories(this.hashtag, 10);
    for (const mem of memories) {
      if (Math.random() < 0.2) {
        const reconstruction = await llmService.performMemoryReconstruction(mem.text);
        if (reconstruction && reconstruction !== "RECONSTRUCTED") {
            await dataStore.addPendingDirective('reconstruction', 'discord', reconstruction);
        }
      }
    }
  }
}

export const memoryService = new MemoryService();

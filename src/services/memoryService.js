import { blueskyService } from './blueskyService.js';
import config from '../../config.js';

class MemoryService {
  constructor() {
    this.hashtag = config.MEMORY_THREAD_HASHTAG;
    this.recentMemories = [];
  }
  isEnabled() { return !!this.hashtag && this.hashtag !== 'DISABLED'; }
  async getRecentMemories(limit = 10) {
    if (!this.isEnabled()) return [];
    try {
        const posts = await blueskyService.searchPosts(this.hashtag, 'latest', limit);
        return posts.map(p => ({ text: p.record.text, timestamp: p.record.createdAt }));
    } catch (e) { return []; }
  }
  async createMemoryEntry(type, context) {
    if (!this.isEnabled()) return;
    try { await blueskyService.post(`[${type.toUpperCase()}] ${context} ${this.hashtag}`); } catch (e) {}
  }
  formatMemoriesForPrompt() {
    if (this.recentMemories.length === 0) return "No recent memories available.";
    return this.recentMemories.map(m => m.text.replace(this.hashtag, '').trim()).join('\n');
  }
}
export const memoryService = new MemoryService();

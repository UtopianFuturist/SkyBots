import config from '../../config.js';
import { blueskyService } from './blueskyService.js';
import { dataStore } from './dataStore.js';
import { llmService } from './llmService.js';
import { checkExactRepetition } from '../utils/textUtils.js';

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
      console.log(`[MemoryService] Fetching memories for ${hashtag}...`);

      // RESTORED: Attempt search first (The "Hashtag Ledger" approach)
      let posts = await blueskyService.searchPosts(`from:${blueskyService.did} ${hashtag}`, { limit: limit * 2, sort: 'latest' });

      // Fallback to getAuthorFeed if search fails or returns nothing (Reliability)
      if (!posts || posts.length === 0) {
          console.log(`[MemoryService] Search yielded no results, falling back to AuthorFeed.`);
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
        console.error('[MemoryService] Error fetching memories:', error.message);
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
        console.log('[MemoryService] Running memory thread cleanup...');
        const profile = await blueskyService.getProfile(config.BLUESKY_IDENTIFIER);
        const query = `from:${profile.did} ${this.hashtag}`;
        const posts = await blueskyService.searchPosts(query, { limit: 100, sort: 'latest' });

        const validTags = ['PERSONA', 'DIRECTIVE', 'RELATIONSHIP', 'INTERACTION', 'MOOD', 'INQUIRY', 'MENTAL', 'GOAL', 'EXPLORE', 'STATUS', 'RESEARCH', 'ADMIN_FACT', 'SCHEDULE', 'FACT', 'AUDIT', 'RECURSION', 'REFLECTION', 'INSIGHT', 'THERAPY'];
        const jargonPatterns = [/<tool_call>/i, /<thinking>/i, /\[PLAN\]/i, /<function/i];

        for (const post of posts) {
            const text = post.record.text;
            const upperText = text.toUpperCase();
            const hasValidTag = validTags.some(tag => upperText.includes(`[${tag}]`));
            const hasJargon = jargonPatterns.some(pattern => pattern.test(text));

            if (hasJargon || !hasValidTag) {
                console.log(`[MemoryService] Deleting non-compliant memory: ${post.uri}`);
                if (blueskyService.deletePost) await blueskyService.deletePost(post.uri);
            }
        }
    } catch (e) {
        console.error('[MemoryService] Cleanup error:', e);
    }
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
        .map(m => {
            const cleanText = m.text.replace(new RegExp(this.hashtag, 'g'), '').trim();
            return `[${new Date(m.timestamp).toLocaleDateString()}] ${cleanText}`;
        })
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
        .replace(/<(thinking|think)>[\s\S]*?<\/(thinking|think)>/gi, '')
        .replace(/\[PLAN\][\s\S]*?(\n|$)/gi, '')
        .replace(/\[INQUIRY\][\s\S]*?(\n|$)/gi, '')
        .replace(/<function[\s\S]*?>/gi, '')
        .trim();

    if (!cleanContext || cleanContext.length === 0) return null;

    const history = await this.fetchRecentMemories(this.hashtag, 20);
    if (checkExactRepetition(cleanContext, history, 20)) return;

    try {
      const dateStr = new Date().toLocaleDateString('en-US');
      const systemPrompt = `Generate a concise memory entry for type: ${type}.
Current Date: ${dateStr}.
Format: [${type.toUpperCase()}] [${dateStr}] [Summary]
Context: ${cleanContext}.
CRITICAL: No technical AI jargon. Speak naturally. Max 200 characters.`;

      let entryText = await llmService.generateResponse([{ role: 'system', content: systemPrompt }], { useStep: true });
      if (entryText) {
        entryText = entryText.trim()
            .replace(/<(thinking|think)>[\s\S]*?<\/(thinking|think)>/gi, '')
            .replace(/\[PLAN\]/gi, '')
            .replace(new RegExp(this.hashtag, 'g'), '')
            .trim();

        const tag = type.toUpperCase();
        const finalEntry = (entryText.includes(`[${tag}]`) && /\[\d+\/\d+\/\d+\]/.test(entryText)) ? entryText : `[${tag}] [${dateStr}] ${entryText.replace(/^\[.*?\]\s*(\[\d+\/\d+\/\d+\])?\s*/, "")}`;

        const hashtagStr = `\n\n${this.hashtag}`;
        const maxChars = 295;
        let finalWithHashtag = finalEntry;

        if (!finalWithHashtag.includes(this.hashtag)) {
            if (finalWithHashtag.length + hashtagStr.length > maxChars) {
                finalWithHashtag = finalWithHashtag.substring(0, maxChars - hashtagStr.length - 3).trim() + "...";
            }
            finalWithHashtag += hashtagStr;
        }

        const latestPost = await this.findLatestMemoryPost();
        let result = null;

        if (latestPost) {
            result = await blueskyService.postReply(latestPost, finalWithHashtag);
        } else {
            result = await blueskyService.post(finalWithHashtag);
            if (result) this.rootPost = result;
        }

        if (result) {
            await dataStore.addInternalLog("memory_entry", finalWithHashtag);
            this.recentMemories.push({ text: finalWithHashtag, indexedAt: new Date().toISOString() });
            if (this.recentMemories.length > 15) this.recentMemories.shift();
        }
        return result;
      }
    } catch (error) {
        console.error('[MemoryService] Error creating memory:', error);
    }
    return null;
  }

  async findLatestMemoryPost() {
      const memories = await this.fetchRecentMemories(this.hashtag, 1);
      return memories.length > 0 ? memories[0].originalPost : null;
  }

  async getContextualMemories(query, taskType = 'reply') {
    const limit = this.getDynamicWindowSize(taskType);
    let memories = await this.getRecentMemories(limit);

    if (query) {
        const matches = memories.filter(m => {
            const words = query.toLowerCase().split(' ');
            return words.some(word => word.length > 4 && m.text.toLowerCase().includes(word));
        });
        if (matches.length > 0) return matches;
    }
    return memories;
  }

  async getRecentMemories(limit = 15) { return await this.fetchRecentMemories(this.hashtag, limit); }

  async auditMemoriesForReconstruction() {
    if (!this.isEnabled()) return;
    try {
        const memories = await this.getRecentMemories(50);
        if (memories.length < 5) return;

        const auditPrompt = `Analyze these memories for patterns. JSON: { "insight": "string", "persona_shift": "string", "type": "persona" } \n Memories: ${JSON.stringify(memories)}`;
        const response = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true });
        const result = llmService.extractJson(response);
        if (result && result.persona_shift) {
            await this.createMemoryEntry(result.type || 'persona', `[RECURSION] ${result.persona_shift}`);
        }
        return result;
    } catch (e) {}
  }

  async fetchPersonaBlurbs() {
    if (!this.isEnabled()) return [];
    try {
      const memories = await this.getRecentMemories(50);
      return memories
        .filter(m => m.category === 'persona')
        .map(m => ({ uri: m.uri, text: m.text }));
    } catch (e) {
      return [];
    }
  }
}

export const memoryService = new MemoryService();

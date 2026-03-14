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
    this.rootPost = null;
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
        indexedAt: p.record.createdAt,
        originalPost: p
      }));
      if (this.recentMemories.length > 0) {
        const root = this.recentMemories[this.recentMemories.length - 1].originalPost;
        this.rootPost = root.record.reply?.root || root;
      }
      return this.recentMemories;
    } catch (error) { return []; }
  }

  _extractCategory(text) {
    const categories = ['persona', 'directive', 'relationship', 'interaction', 'mood', 'inquiry', 'mental', 'goal', 'explore', 'status', 'research', 'admin_fact', 'schedule', 'fact', 'audit'];
    for (const cat of categories) {
        if (text.toUpperCase().includes(`[${cat.toUpperCase()}]`)) return cat;
    }
    return 'general';
  }

  async cleanupMemoryThread() {
    if (!this.isEnabled()) return;
    try {
        console.log('[MemoryService] Running memory thread cleanup...');
        const profile = await blueskyService.getProfile(config.BLUESKY_IDENTIFIER);
        const query = `from:${profile.did} ${this.hashtag}`;
        const posts = await blueskyService.searchPosts(query, 'latest', 100);

        const validTags = ['PERSONA', 'DIRECTIVE', 'RELATIONSHIP', 'INTERACTION', 'MOOD', 'INQUIRY', 'MENTAL', 'GOAL', 'EXPLORE', 'STATUS', 'RESEARCH', 'ADMIN_FACT', 'SCHEDULE', 'FACT', 'AUDIT'];
        const jargonPatterns = [/<tool_call>/i, /<thinking>/i, /\[PLAN\]/i, /<function/i];

        for (const post of posts) {
            const text = post.record.text;
            const upperText = text.toUpperCase();
            const hasValidTag = validTags.some(tag => upperText.includes(`[${tag}]`));
            const hasJargon = jargonPatterns.some(pattern => pattern.test(text));

            if ((!hasValidTag || hasJargon) && !upperText.includes('[PINNED]')) {
                console.log(`[MemoryService] Deleting memory entry (Invalid Tag: ${!hasValidTag}, Jargon: ${hasJargon}): ${post.uri}`);
                await blueskyService.deletePost(post.uri);
            }
        }
    } catch (e) {
        console.error('[MemoryService] Error in cleanupMemoryThread:', e);
    }
  }

  formatMemoriesForPrompt(excludeTags = []) {
    if (!this.isEnabled() || this.recentMemories.length === 0) return "No recent memories available.";
    const pinned = this.recentMemories.filter(m => m.text.includes("[PINNED]"));
    const normal = this.recentMemories.filter(m => !m.text.includes("[PINNED]"));
    return [...pinned, ...normal].filter(m => !excludeTags.some(tag => m.text.toUpperCase().includes(tag.toUpperCase()))).map(m => `[${new Date(m.timestamp).toLocaleDateString()}] ${m.text}`).join('\n');
  }

  async createMemoryEntry(type, context, timestamp = null) {
    if (!this.isEnabled()) return null;
    return this.processingQueue = this.processingQueue.then(async () => {
        try { return await this._createMemoryEntryInternal(type, context, timestamp); } catch (error) { return null; }
    });
  }

  async _createMemoryEntryInternal(type, context, timestamp = null) {
    // Filter out internal jargon and planning leakage from context
    const cleanContext = (context || '')
        .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
        .replace(/\[PLAN\][\s\S]*?(\n|$)/gi, '')
        .replace(/\[INQUIRY\][\s\S]*?(\n|$)/gi, '')
        .replace(/<function[\s\S]*?>/gi, '')
        .trim();

    if (!cleanContext || cleanContext.length === 0) return null;

    const consistency = await llmService.checkConsistency(cleanContext, "memory");
    if (!consistency.consistent) return null;

    const history = await this.fetchRecentMemories(this.hashtag, 20);
    if (checkExactRepetition(cleanContext, history, 20)) return;

    try {
      const dateStr = new Date().toLocaleDateString('en-US'); // m/d/year
      const systemPrompt = `Generate a concise memory entry for type: ${type}.
Current Date: ${dateStr}.
Constraint: Max 250 characters INCLUDING the tag and hashtag.
Format: [${type.toUpperCase()}] [${dateStr}] [Concise Summary]

Context: ${cleanContext}.

CRITICAL:
1. Do NOT include internal planning tags, tool calls, or meta-talk.
2. Focus on the material substance and emotional truth.
3. Keep it under 200 characters to leave room for the hashtag.`;

      let entryText = await llmService.generateResponse([{ role: 'system', content: systemPrompt }], { useStep: true, preface_system_prompt: false });
      if (entryText) {
        // Strict sanitization of output
        entryText = entryText.trim()
            .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
            .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
            .replace(/\[PLAN\]/gi, '')
            .replace(/#\w+/g, '') // Remove existing hashtags to prevent duplicates
            .trim();

        // Enforce Format: [TAG] [m/d/year] Content
        const tag = type.toUpperCase();
        const finalEntry = entryText.startsWith(`[${tag}]`) ? entryText : `[${tag}] [${dateStr}] ${entryText.replace(/^\[.*?\]\s*(\[\d+\/\d+\/\d+\])?\s*/, '')}`;

        // Final Quality & Substance Check (Old filter logic integration)
        const evaluationPrompt = `
          Analyze the following proposed memory entry for an AI agent.
          Entry: "${finalEntry}"
          Type: ${type}

          CRITICAL RULES:
          1. TAG VALIDATION: The entry MUST contain the tag [${tag}].
          2. Meaningful Substance: Does this entry contain material substance regarding the bot's functioning, memory, persona, or insights?
          3. No Jargon: Does it avoid internal planning jargon, tool calls, or agent reasoning?
          4. Coherence: Is the entry logically sound and in-persona?
          5. No Slop: Does it avoid repetitive poetic "slop"?

          Respond with ONLY "PASS" if it meets all criteria, or "FAIL | [reason]" if it doesn't.`;

        const evaluation = await llmService.generateResponse([{ role: 'system', content: evaluationPrompt }], { useStep: true, preface_system_prompt: false });
        if (evaluation && evaluation.toUpperCase().startsWith('FAIL')) {
            console.warn(`[MemoryService] Memory entry rejected: ${evaluation}`);
            return null;
        }

        const finalContent = `${finalEntry.substring(0, 248 - this.hashtag.length).trim()} ${this.hashtag}`;

        if (this.rootPost) {
          return await blueskyService.postReply(this.rootPost, finalContent);
        } else {
          const res = await blueskyService.post(finalContent);
          if (res) { this.rootPost = res; await dataStore.addInternalLog("memory_entry", finalContent); }
          return res;
        }
      }
    } catch (error) {}
    return null;
  }

  async getRecentMemories(limit = 15) { return await this.fetchRecentMemories(this.hashtag, limit); }
  async secureThread(uri) { try { await blueskyService.upsertThreadgate(uri, { allowMentions: false, allowFollowing: true }); } catch (e) {} }
  async secureAllThreads() {
    if (!this.isEnabled()) return;
    try {
        const posts = await blueskyService.searchPosts(`from:${blueskyService.did} ${this.hashtag}`, { limit: 100, sort: 'latest' });
        for (const post of posts) { await this.secureThread(post.record.reply?.root?.uri || post.uri); }
    } catch (e) {}
  }
  async performDailyKnowledgeAudit() {
      if (!this.isEnabled()) return;
      const memories = await this.getRecentMemories(50);
      const auditPrompt = `Daily Knowledge Audit: Synthesize these 50 memories into a worldview map. Identify patterns and shifts. Context: ${JSON.stringify(memories)}`;
      const synth = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true });
      if (synth) await this.createMemoryEntry('reflection', `[WORLDVIEW_SYNTH] ${synth.substring(0, 200)}`);
  }
  async auditMemoriesForReconstruction() {}
  async getLatestMoodMemory() { return null; }
  async searchMemories(query) { return (this.recentMemories || []).filter(m => m.text.includes(query)); }
  async deleteMemory(uri) { try { await blueskyService.deletePost(uri); return true; } catch (e) { return false; } }
}

export const memoryService = new MemoryService();

import { checkExactRepetition, checkSimilarity } from "../utils/textUtils.js";
import { ensureStandardTag } from "../utils/tagUtils.js";
import { blueskyService } from './blueskyService.js';
import { llmService } from './llmService.js';
import config from '../../config.js';
import { dataStore } from './dataStore.js';

class MemoryService {

  // Proposal 9: Dynamic Context Windowing
  getDynamicWindowSize(taskType) {
    const windows = {
      'aar': 30,
      'synthesis': 50,
      'reply': 10,
      'post': 20,
      'therapy': 40
    };
    return windows[taskType] || 15;
  }

  // Proposal 10: Relevance-based Pruning (simplified version: move high relevance to a persistent list)
  async tagHighRelevanceMemories(memories) {
    // This would ideally use an LLM, but for now we'll look for specific tags
    const highRelevanceTags = ['[CORE]', '[RELATIONAL]', '[PERSONA]', '[THERAPY]'];
    return memories.map(m => {
        if (highRelevanceTags.some(tag => m.text.includes(tag))) {
            return { ...m, relevance: 1.0, persistent: true };
        }
        return { ...m, relevance: 0.5, persistent: false };
    });
  }

    async findLatestMemoryPost() {
      const memories = await this.fetchRecentMemories(this.hashtag, 1);
      return memories.length > 0 ? memories[0].originalPost : null;
  }

  constructor() {
    this.hashtag = config.MEMORY_THREAD_HASHTAG;
    this.recentMemories = [];
    this.processingQueue = Promise.resolve();
    this.rootPost = null;
    this._memoryCache = null;
    this._lastFetchTime = 0;
    this._cacheTTL = 30000; // 30 seconds
  }

  get js() { return this; }
  isEnabled() { return this.hashtag && this.hashtag !== 'DISABLED' && config.BLUESKY_IDENTIFIER; }

  async fetchRecentMemories(hashtag, limit = 15) {
    if (!this.isEnabled()) return [];

    // Simple cache to prevent redundant fetches within the same heartbeat cycle
    const now = Date.now();
    if (this._memoryCache && (now - this._lastFetchTime < this._cacheTTL) && limit <= this._memoryCache.length) {
      return this._memoryCache.slice(0, limit);
    }

    try {
      console.log(`[MemoryService] Fetching memories for ${hashtag}...`);
      const posts = await blueskyService.getUserPosts(blueskyService.did, Math.max(limit * 3, 50));

      const memories = posts
        .filter(p => p.post.record.text.includes(hashtag))
        .map(p => ({
            uri: p.post.uri, cid: p.post.cid, text: p.post.record.text.replace(hashtag, '').trim(),
            category: this._extractCategory(p.post.record.text),
            timestamp: new Date(p.post.record.createdAt).getTime(),
            indexedAt: p.post.record.createdAt,
            originalPost: p.post
        }));

      this.recentMemories = memories.slice(0, limit);
      this._memoryCache = memories;
      this._lastFetchTime = now;

      if (this.recentMemories.length > 0) {
        const first = this.recentMemories[0].originalPost;
        this.rootPost = first.record.reply?.root || first;
      }
      return this.recentMemories;
    } catch (error) {
        console.error('[MemoryService] Error fetching memories:', error.message);
        return this._memoryCache ? this._memoryCache.slice(0, limit) : [];
    }
  }

  _extractCategory(text) {
    const categories = ['persona', 'directive', 'relationship', 'interaction', 'mood', 'inquiry', 'mental', 'goal', 'explore', 'status', 'research', 'admin_fact', 'schedule', 'fact', 'audit', 'recursion', 'reflection', 'insight'];
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

        const validTags = ['PERSONA', 'DIRECTIVE', 'RELATIONSHIP', 'INTERACTION', 'MOOD', 'INQUIRY', 'MENTAL', 'GOAL', 'EXPLORE', 'STATUS', 'RESEARCH', 'ADMIN_FACT', 'SCHEDULE', 'FACT', 'AUDIT', 'RECURSION', 'REFLECTION', 'INSIGHT', 'THERAPY'];
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
    if (checkExactRepetition(cleanContext, history, 20)) {
        console.log(`[MemoryService] Skipping duplicate memory entry for ${this.hashtag}`);
        return;
    }

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
3. Keep it under 200 characters to leave room for the hashtag.
4. STRICT ANTI-JARGON POLICY: Do NOT use technical AI terminology like "drift score", "linguistic audit", "metalinguistic", "parameter", "latency", or "token". Speak as a human-like individual expressing a realization or fact.`;

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
        let finalEntry = (entryText.includes(`[${tag}]`) && /\[\d+\/\d+\/\d+\]/.test(entryText)) ? entryText : `[${tag}] [${dateStr}] ${entryText.replace(/^\[.*?\]\s*(\[\d+\/\d+\/\d+\])?\s*/, "")}`;

        // Final Quality & Substance Check (Old filter logic integration)
        const evaluationPrompt = `
          Analyze the following proposed memory entry for an AI agent.
          Entry: "${finalEntry}"
          Type: ${type}

          CRITICAL RULES:
          1. TAG VALIDATION: The entry MUST contain the tag [${tag}] and the date in [m/d/year] format.
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


        const hashtagStr = `\n\n${this.hashtag}`;
        const maxChars = 295;

        // Ensure we are using the configured hashtag dynamically
        if (!finalEntry.includes(this.hashtag)) {
            if (finalEntry.length + hashtagStr.length > maxChars) {
                console.log(`[MemoryService] Entry too long. Truncating to fit ${this.hashtag}.`);
                const allowedLength = maxChars - hashtagStr.length;
                finalEntry = finalEntry.substring(0, allowedLength).trim() + "...";
            }
            finalEntry += hashtagStr;
        } else {
            if (finalEntry.length > maxChars) {
                console.log(`[MemoryService] Entry (with hashtag) too long. Truncating.`);
                const cleanText = finalEntry.replace(this.hashtag, '').trim();
                const allowedLength = maxChars - hashtagStr.length;
                finalEntry = cleanText.substring(0, allowedLength).trim() + "..." + hashtagStr;
            }
        }

        // Unified Threading Logic: Priority to DataStore root, fallback to search, otherwise start new
        let threadRoot = await dataStore.getMemoryThreadRoot(this.hashtag);
        let result = null;

        if (threadRoot) {
            console.log(`[MemoryService] Threading memory under stored root: ${threadRoot.uri}`);
            result = await blueskyService.postReply(threadRoot, finalEntry);
        } else {
            const memories = await this.fetchRecentMemories(this.hashtag, 1);
            if (memories.length > 0) {
                const latest = memories[0].originalPost;
                const parent = { uri: latest.uri, cid: latest.cid, record: latest.record };
                const root = latest.record.reply?.root || { uri: latest.uri, cid: latest.cid };

                console.log(`[MemoryService] Threading memory under latest: ${latest.uri}`);
                result = await blueskyService.postReply(parent, finalEntry);
                if (result) {
                    const rootUri = parent.record?.reply?.root?.uri || parent.uri;
                    await this.secureThread(rootUri);
                }
                if (result) await dataStore.setMemoryThreadRoot(this.hashtag, root);
            } else {
                console.log(`[MemoryService] Initializing new memory thread for ${this.hashtag}`);
                result = await blueskyService.post(finalEntry);
                if (result) {
                    await this.secureThread(result.uri);
                }
                if (result) {
                    this.rootPost = result;
                    await dataStore.setMemoryThreadRoot(this.hashtag, { uri: result.uri, cid: result.cid });
                }
            }
        }

        if (result) {
            console.log(`[MemoryService] SUCCESS: Created memory entry on Bluesky: ${result.uri}`);
            await dataStore.addInternalLog("memory_entry", finalEntry);
            this.recentMemories.push({ text: finalEntry, indexedAt: new Date().toISOString() });
            if (this.recentMemories.length > 15) this.recentMemories.shift();
        }
        return result;
      }
    } catch (error) {
        console.error("[MemoryService] Error in _createMemoryEntryInternal:", error.message);
    }
    return null;
  }


  async getContextualMemories(query, taskType = 'reply') {
    const limit = this.getDynamicWindowSize(taskType);
    let memories = await this.getRecentMemories(limit);

    if (query) {
        const matches = memories.filter(m => {
            const words = query.toLowerCase().split(' ');
            return words.some(word => word.length > 4 && m.text.toLowerCase().includes(word));
        });
        if (matches.length > 0) {
            console.log(`[MemoryService] Contextual flashback triggered for: ${query.substring(0, 30)}...`);
            return matches;
        }
    }
    return memories;
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
      if (synth) await this.createMemoryEntry('reflection', `[WORLDVIEW_SYNTH] ${synth.substring(0, 500)}`);
  }
  async auditMemoriesForReconstruction() {
    if (!this.isEnabled()) return;
    try {
        console.log('[MemoryService] Starting recursive memory audit for reconstruction...');
        const memories = await this.getRecentMemories(50);
        if (memories.length < 10) return;

        const auditPrompt = `
Analyze these 50 recent memories to identify high-level persona shifts, emotional patterns, or "lessons learned" about your interaction style and boundaries.

MEMORIES:
${JSON.stringify(memories)}

Identify:
1. Recurring themes or fixations.
2. Emotional drift (positive or negative).
3. Insights into the Admin's preferences that should be reinforced.
4. Outdated behavioral patterns that should be phased out.

Respond with JSON: { "insight": "a deep synthesis of these patterns", "persona_shift": "suggested instruction to update your persona blurbs", "type": "persona|directive" }`;

        const response = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true });
        const result = JSON.parse(response.match(/\{[\s\S]*\}/)[0]);

        if (result.persona_shift) {
            await this.createMemoryEntry(result.type || 'persona', `[RECURSION] ${result.persona_shift} (Based on: ${result.insight.substring(0, 300)}...)`);
        }
        return result;
    } catch (e) {
        console.error('[MemoryService] Error in auditMemoriesForReconstruction:', e);
    }
  }
  async getLatestMoodMemory() { return null; }
  async searchMemories(query) { return (this.recentMemories || []).filter(m => m.text.includes(query)); }
  async deleteMemory(uri) { try { await blueskyService.deletePost(uri); return true; } catch (e) { return false; } }

  async fetchPersonaBlurbs() {
    if (!this.isEnabled()) return [];
    try {
      const memories = await this.fetchRecentMemories(this.hashtag, 50);
      return memories
        .filter(m => m.category === 'persona')
        .map(m => ({ uri: m.uri, text: m.text }));
    } catch (e) {
      return [];
    }
  }
}

export const memoryService = new MemoryService();

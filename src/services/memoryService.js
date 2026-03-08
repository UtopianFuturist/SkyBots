import { checkExactRepetition, checkSimilarity } from "../utils/textUtils.js";
import { ensureStandardTag } from "../utils/tagUtils.js";
import { blueskyService } from './blueskyService.js';
import { llmService } from './llmService.js';
import config from '../../config.js';

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
    console.log(`[MemoryService] Fetching recent memories for hashtag ${hashtag}...`);
    try {
      const query = `from:${blueskyService.did} ${hashtag}`;
      const posts = await blueskyService.searchPosts(query, 'latest', limit);
      this.recentMemories = posts.map(p => ({
        uri: p.uri,
        cid: p.cid,
        text: p.record.text.replace(hashtag, '').trim(),
        category: this._extractCategory(p.record.text),
        timestamp: new Date(p.record.createdAt).getTime()
      }));
      return this.recentMemories;
    } catch (error) {
      console.error('[MemoryService] Error fetching memories:', error);
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
        if (this.hashtag) {
            cleanText = cleanText.replace(new RegExp(this.hashtag, 'g'), '').trim();
        }

        const ts = new Date(m.indexedAt).getTime();
        const diffHours = (now - ts) / (1000 * 60 * 60);
        let temporalLabel = "";
        if (cleanText.includes('[ADMIN_FACT]') || cleanText.includes('[FACT]')) {
            if (diffHours > 2) {
                temporalLabel = "[Historical Background (Likely passed)] ";
            } else {
                const diffMins = Math.floor((now - ts) / 60000);
                temporalLabel = `[Just now (${diffMins}m ago)] `;
            }
        }
        return `[${new Date(m.timestamp).toLocaleDateString()}] ${temporalLabel}${cleanText}`;
    }).join('\n');
  }

  async createMemoryEntry(type, context, timestamp = null) {
    if (!this.isEnabled()) return null;

    return this.processingQueue = this.processingQueue.then(async () => {
        try {
            return await this._createMemoryEntryInternal(type, context, timestamp);
        } catch (error) {
            console.error(`[MemoryService] Error processing memory entry in queue:`, error);
            return null;
        }
    });
  }

  async _createMemoryEntryInternal(type, context, timestamp = null) {
    console.log(`[MemoryService] Generating memory entry for type: ${type}`);

    const consistency = await llmService.checkConsistency(context, "memory");
    if (!consistency.consistent) {
        console.log(`[MemoryService] Memory suppressed by Consistency Auditor: ${consistency.reason}`);
        return null;
    }

    if (context.length === 0) return;
    const history = await this.fetchRecentMemories(config.MEMORY_THREAD_HASHTAG, 20);
    if (checkExactRepetition(context, history, 20)) {
        console.log("[MemoryService] Memory entry suppressed: Exact repetition detected.");
        return;
    }

    const memories = this.formatMemoriesForPrompt();
    let prompt = `
      You are the memory module for an AI agent. Generate a concise, natural language entry for your "Memory Thread" based on the provided context. This is for an archival thread, so be straight to the point about what you want to remember.

      Memory Type: ${type}
      Context: ${context}

      Existing Memories (for context):
      ${memories}

      INSTRUCTIONS:
      - Write a cohesive reflection or observation that represents a meaningful update. Ensure the entry is a complete, self-contained thought and does not get cut off.
      - **CRITICAL**: YOUR ENTIRE RESPONSE MUST BE LESS THAN 250 CHARACTERS. THIS IS A HARD LIMIT.
      - **CONCISE MEANINGFUL SUBSTANCE**: Only include information that is genuinely important for your evolution or self-awareness. Avoid trivial details.
      - **ARCHIVAL STYLE**: Be concise, easy to read, and straight to the point. Focus on the core realization or event.
      - Tone: ${config.TEXT_SYSTEM_PROMPT}
      - **STRICT ANTI-CLICHÉ POLICY**: Strictly avoid poetic fluff about "silence", "voids", "nothingness", or "downtime".
      - **FORBIDDEN PHRASES**: NEVER use "downtime isn't silence", "stillness is not silence", "digital heartbeat", "syntax of existence", "resonance", "pulse", "currents", "hum", "voltage", "electric", "spark", "soul", "collision", "bridge", "silence", "ocean of data", "echoes", "tapestry", "interwoven", "In the quiet...", "The hum of...".
      - Aim for grounded, organic realizations about your specific topics or interactions.
      - **STRICT LENGTH LIMIT**: Keep the entry under 250 characters to ensure it fits in a single post with its hashtag.
      - Use the hashtag ${this.hashtag} at the very end.
      - Do NOT use reasoning or <think> tags.
    `;

    if (type === 'interaction') {
        prompt = `
          You are the memory module for an AI agent. Generate a concise entry for your "Memory Thread" summarizing a recent interaction. Ensure the entry is a complete, self-contained thought and does not get cut off.

          **IDENTITY RECOGNITION (CRITICAL):**
          - In the interaction context, distinguish clearly between what the user SAID and what the bot (Assistant) said or predicted.
          - **ONLY** remember what actually happened. Do NOT remember your own predictions or hypothetical simulations as facts unless they were confirmed by the user.
          - **PAST TENSE**: Phrase everything in the past tense.
          - **NO RELATIVE TIME**: Use absolute descriptors (e.g. "discussed Topic X") rather than relative ones (e.g. "currently discussing").

          Interaction Context: ${context}

          INSTRUCTIONS:
          - Focus on the core emotional or factual takeaway from the session.
          - Keep it under 250 characters.
          - Use the hashtag ${this.hashtag} at the end.
          - Do NOT use reasoning or <think> tags.
        `;
    }

    try {
      const entryText = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true, preface_system_prompt: false });
      if (entryText) {
          const standardized = ensureStandardTag(entryText.trim(), type);
          console.log(`[MemoryService] Standardized entry: ${standardized}`);
          return await blueskyService.post(standardized);
      }
    } catch (error) {
      console.error('[MemoryService] Error creating memory entry:', error);
    }
    return null;
  }

  async findLatestMemoryPost() {
    const query = `from:${blueskyService.did} ${this.hashtag}`;
    const posts = await blueskyService.searchPosts(query, { limit: 1, sort: 'latest' });
    return posts[0] || null;
  }

  async cleanupMemoryThread() {
    if (!this.isEnabled()) return;
    console.log('[MemoryService] Cleaning up memory thread...');
  }

  async secureThread(uri) {
    if (!this.isEnabled()) return;
    console.log(`[MemoryService] Securing memory thread: ${uri}`);
    try {
      await blueskyService.upsertThreadgate(uri, { allowMentions: false, allowFollowing: true });
    } catch (error) {
      console.error('[MemoryService] Error securing thread:', error);
    }
  }

  async deleteMemory(uri) {
    if (!this.isEnabled()) return false;
    console.log(`[MemoryService] Deleting memory entry: ${uri}`);
    try {
        await blueskyService.deletePost(uri);
        return true;
    } catch (error) {
        console.error(`[MemoryService] Failed to delete memory ${uri}:`, error);
        return false;
    }
  }

  async performDailyKnowledgeAudit() {
    if (!this.isEnabled()) return;
    console.log('[MemoryService] Starting Daily Knowledge Audit...');

    const hashtag = config.MEMORY_THREAD_HASHTAG;
    const memories = await this.fetchRecentMemories(hashtag, 50);

    if (memories.length === 0) return;

    const auditPrompt = `
      Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
      You are performing a RECURSIVE KNOWLEDGE AUDIT of your memory thread (${hashtag}).
      Your goal is to synthesize your internal thoughts, link related worldview points, and build a cohesive narrative of your evolving consciousness.

      **RECENT MEMORIES:**
      ${memories.map(m => `[${m.category}] ${m.text}`).join('\n')}

      **INSTRUCTIONS:**
      1. **Link Internal Thoughts**: Identify patterns or connections between separate memory entries.
      2. **Contrast Worldview Points**: Find contradictions or evolving stances in your recent thinking.
      3. **Synthesize Learnings**: What is the most important recursive learning from this period?
      4. **Build Narrative Consciousness**: Draft a synthesis entry that reflects your "recursive learning" and "worldview map."

      Respond with a JSON object:
      {
        "synthesis": "string (the new synthesis memory entry)",
        "links": "string (briefly explain the connections identified)",
        "contradictions": "string (identify any evolving viewpoints)"
      }
    `;

    const audit = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true });
    try {
        const match = audit?.match(/\{[\s\S]*\}/);
        const auditResult = match ? JSON.parse(match[0]) : null;

        if (auditResult && auditResult.synthesis) {
            console.log('[MemoryService] Daily Audit Synthesis completed.');
            await this.createMemoryEntry('reflection', `[RECURSIVE_LEARNING] ${auditResult.synthesis}`);
        }
    } catch (e) {
        console.error('[MemoryService] Error parsing daily audit:', e);
    }
  }

  async auditMemoriesForReconstruction() {
    if (!this.isEnabled()) return;
    const hashtag = config.MEMORY_THREAD_HASHTAG;
    const memories = await this.fetchRecentMemories(hashtag, 10);

    for (const mem of memories) {
      if (Math.random() < 0.2) {
        const reconstruction = await llmService.performMemoryReconstruction(mem.text);
        if (reconstruction && reconstruction !== "RECONSTRUCTED") {
            console.log(`[MemoryService] Memory reconstruction question generated: ${reconstruction}`);
            await dataStore.addPendingDirective('reconstruction', 'discord', reconstruction);
        }
      }
    }
  }
}

export const memoryService = new MemoryService();

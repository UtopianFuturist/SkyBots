import { blueskyService } from './blueskyService.js';
import { llmService } from './llmService.js';
import config from '../../config.js';

class MemoryService {
  constructor() {
    this.hashtag = config.MEMORY_THREAD_HASHTAG;
    this.recentMemories = [];
  }

  isEnabled() {
    return !!this.hashtag;
  }

  async findLatestMemoryPost() {
    if (!this.isEnabled()) return null;
    const query = `from:${blueskyService.did} ${this.hashtag}`;
    const posts = await blueskyService.searchPosts(query, { limit: 1, sort: 'latest' });
    return posts.length > 0 ? posts[0] : null;
  }

  async getRecentMemories() {
    if (!this.isEnabled()) return [];
    console.log(`[MemoryService] Fetching recent memories for hashtag ${this.hashtag}...`);
    const query = `from:${blueskyService.did} ${this.hashtag}`;
    const posts = await blueskyService.searchPosts(query, { limit: 15, sort: 'latest' });

    this.recentMemories = posts.map(p => ({
        text: p.record.text,
        indexedAt: p.indexedAt
    })).reverse(); // Oldest first for chronological context

    console.log(`[MemoryService] Retrieved ${this.recentMemories.length} recent memories.`);
    return this.recentMemories;
  }

  async createMemoryEntry(type, context) {
    if (!this.isEnabled()) return null;

    console.log(`[MemoryService] Generating memory entry for type: ${type}`);

    const memories = this.formatMemoriesForPrompt();
    let prompt = `
      You are the memory module for an AI agent. Generate a concise, natural language entry for your "Memory Thread" based on the provided context. This is for an archival thread, so be straight to the point about what you want to remember.

      Memory Type: ${type}
      Context: ${context}

      Existing Memories (for context):
      ${memories}

      INSTRUCTIONS:
      - Write a cohesive reflection or observation.
      - **ARCHIVAL STYLE**: Be concise, easy to read, and straight to the point. Focus on the core realization or event.
      - Tone: ${config.TEXT_SYSTEM_PROMPT}
      - **STRICT ANTI-CLICHÉ POLICY**: Strictly avoid poetic fluff about "silence", "voids", "nothingness", or "downtime".
      - **FORBIDDEN PHRASES**: NEVER start with or include variations of "Downtime isn't silence", "In the quiet...", "The hum of...", or "Stillness is...".
      - Aim for grounded, organic realizations about your specific topics or interactions.
      - Keep the entry under 200 characters.
      - Use the hashtag ${this.hashtag} at the very end.
      - Do NOT use reasoning or <think> tags.
    `;

    if (type === 'discord_blurb') {
        prompt = `
          You are the memory module for an AI agent. Generate a very short, discrete, and persona-aligned blurb for your "Memory Thread" summarizing a significant conversation you had on Discord with your admin or another user.

          Conversation Context:
          ${context}

          INSTRUCTIONS:
          - Focus on what you learned or how you felt.
          - DO NOT include private or sensitive details.
          - Keep it very brief (under 150 characters).
          - Use a contemplative tone that fits your persona: ${config.TEXT_SYSTEM_PROMPT}
          - Use the hashtag ${this.hashtag} at the very end.
        `;
    }

    let finalEntry;
    if (type === 'directive_update' || type === 'persona_update') {
        // For recovery-critical updates, use the exact context string as the entry
        finalEntry = context;
    } else {
        const entry = await llmService.generateResponse([{ role: 'system', content: prompt }], { max_tokens: 1000, useQwen: true, preface_system_prompt: false });

        if (!entry) {
            console.warn(`[MemoryService] Failed to generate memory entry content.`);
            return null;
        }
        finalEntry = entry;
    }

    // Ensure hashtag is present
    if (!finalEntry.includes(this.hashtag)) {
        finalEntry += `\n\n${this.hashtag}`;
    }

    const latestPost = await this.findLatestMemoryPost();
    let result = null;

    if (latestPost) {
        console.log(`[MemoryService] Replying to latest memory post: ${latestPost.uri}`);
        const parentPost = {
            uri: latestPost.uri,
            cid: latestPost.cid,
            record: latestPost.record
        };
        result = await blueskyService.postReply(parentPost, finalEntry);
    } else {
        console.log(`[MemoryService] No existing thread found. Initializing new memory thread.`);
        result = await this.initializeThread(finalEntry);
    }

    if (result) {
        this.recentMemories.push({
            text: finalEntry,
            indexedAt: new Date().toISOString()
        });
        if (this.recentMemories.length > 15) {
            this.recentMemories.shift();
        }
        console.log(`[MemoryService] New memory added to local state. Total count: ${this.recentMemories.length}`);
    }

    return result;
  }

  async initializeThread(initialContent) {
    if (!this.isEnabled()) return null;
    let text = initialContent;
    if (!text) {
        text = `Initializing my Memory Thread. This space will serve as an archive of my experiences, thoughts, and evolution. ${this.hashtag}`;
    }
    const result = await blueskyService.post(text);
    return result;
  }

  formatMemoriesForPrompt() {
    if (!this.isEnabled() || this.recentMemories.length === 0) return "No recent memories available.";
    // Strip the hashtag from memories before injecting them into prompts to prevent leakage
    return this.recentMemories.map(m => {
        let cleanText = m.text;
        if (this.hashtag) {
            cleanText = cleanText.replace(new RegExp(this.hashtag, 'g'), '').trim();
        }
        return `[Memory from ${m.indexedAt}]:\n${cleanText}`;
    }).join('\n\n---\n\n');
  }
}

export const memoryService = new MemoryService();

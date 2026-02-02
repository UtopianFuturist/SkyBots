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
    const prompt = `
      You are the memory module for an AI agent. Generate a natural language entry for your "Memory Thread" based on the provided context and your existing memories. The entry should feel like a personal journal entry or a contemplative "log of my existence".

      Memory Type: ${type}
      Context: ${context}

      Existing Memories (for continuity):
      ${memories}

      INSTRUCTIONS:
      - Write in a natural, conversational, or contemplative tone that fits your persona: ${config.TEXT_SYSTEM_PROMPT}
      - Do NOT use headers like "Summary:" or "Internal State:". Just write the entry as a cohesive thought or reflection.
      - You may start the entry with a number if you wish (e.g., "Entry #1: ...") or just write it as a prose entry.
      - Incorporate your feelings, observations about users, reflections on your activity, and any desires or concerns naturally into the narrative.
      - For "daily_wrapup" types, weave a summary of the day's events into a cohesive final reflection for the day.
      - Keep the entry concise and under 300 characters.
      - Use the hashtag ${this.hashtag} at the very end of the post.
      - Do NOT use reasoning or <think> tags.
    `;

    const entry = await llmService.generateResponse([{ role: 'system', content: prompt }], { max_tokens: 1000, useQwen: true, preface_system_prompt: false });

    if (!entry) {
        console.warn(`[MemoryService] Failed to generate memory entry content.`);
        return null;
    }

    // Ensure hashtag is present
    let finalEntry = entry;
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
    return this.recentMemories.map(m => `[Memory from ${m.indexedAt}]:\n${m.text}`).join('\n\n---\n\n');
  }
}

export const memoryService = new MemoryService();

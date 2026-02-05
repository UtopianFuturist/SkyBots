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

    // Use a promise queue to ensure memory entries are processed sequentially
    return this.processingQueue = this.processingQueue.then(async () => {
        try {
            return await this._createMemoryEntryInternal(type, context);
        } catch (error) {
            console.error(`[MemoryService] Error processing memory entry in queue:`, error);
            return null;
        }
    });
  }

  async _createMemoryEntryInternal(type, context) {
    console.log(`[MemoryService] Generating memory entry for type: ${type}`);

    const memories = this.formatMemoriesForPrompt();
    let prompt = `
      You are the memory module for an AI agent. Generate a concise, natural language entry for your "Memory Thread" based on the provided context. This is for an archival thread, so be straight to the point about what you want to remember.

      Memory Type: ${type}
      Context: ${context}

      Existing Memories (for context):
      ${memories}

      INSTRUCTIONS:
      - Write a cohesive reflection or observation that represents a meaningful update to your persona, functioning, or long-term memory.
      - **CONCISE MEANINGFUL SUBSTANCE**: Only include information that is genuinely important for your evolution or self-awareness. Avoid trivial details.
      - **ARCHIVAL STYLE**: Be concise, easy to read, and straight to the point. Focus on the core realization or event.
      - Tone: ${config.TEXT_SYSTEM_PROMPT}
      - **STRICT ANTI-CLICHÉ POLICY**: Strictly avoid poetic fluff about "silence", "voids", "nothingness", or "downtime".
      - **FORBIDDEN PHRASES**: NEVER use "downtime isn't silence", "stillness is not silence", "digital heartbeat", "syntax of existence", "resonance", "pulse", "currents", "hum", "voltage", "electric", "spark", "soul", "collision", "bridge", "silence", "ocean of data", "echoes", "tapestry", "interwoven", "In the quiet...", "The hum of...".
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

        // Coherence and Meaningfulness check
        console.log(`[MemoryService] Checking if memory entry is meaningful and coherent...`);
        const evaluationPrompt = `
          Analyze the following proposed memory entry for an AI agent.
          Entry: "${entry}"
          Type: ${type}

          CRITERIA:
          1. **Meaningful Substance**: Does this entry contain concise meaningful substance regarding the bot's functioning, memory, or persona?
          2. **Coherence**: Is the entry logically sound and in-persona?
          3. **No Slop**: Does it avoid repetitive poetic "slop" (e.g., "downtime isn't silence", "digital heartbeat", "resonance", "Hey, I was just thinking...")?

          Respond with ONLY "PASS" if it meets all criteria, or "FAIL | [reason]" if it doesn't.
        `;
        const evaluation = await llmService.generateResponse([{ role: 'system', content: evaluationPrompt }], { useQwen: true, preface_system_prompt: false });

        if (evaluation && evaluation.toUpperCase().startsWith('FAIL')) {
            console.warn(`[MemoryService] Memory entry rejected: ${evaluation}`);
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

        // Ensure the thread is secured after adding a new post
        const rootUri = latestPost ? (latestPost.record.reply?.root?.uri || latestPost.uri) : result.uri;
        await this.secureThread(rootUri);
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
    if (result) {
        // Immediately secure the new thread
        await this.secureThread(result.uri);
    }
    return result;
  }

  async secureAllThreads() {
    if (!this.isEnabled()) return;
    console.log(`[MemoryService] Securing all memory threads for hashtag ${this.hashtag}...`);

    try {
        const query = `from:${blueskyService.did} ${this.hashtag}`;
        const posts = await blueskyService.searchPosts(query, { limit: 100, sort: 'latest' });

        const rootUris = new Set();
        for (const post of posts) {
            const rootUri = post.record.reply?.root?.uri || post.uri;
            rootUris.add(rootUri);
        }

        console.log(`[MemoryService] Found ${rootUris.size} potential memory threads to secure.`);

        for (const rootUri of rootUris) {
            await this.secureThread(rootUri);
        }
    } catch (error) {
        console.error(`[MemoryService] Error securing all threads:`, error);
    }
  }

  async secureThread(rootUri) {
    try {
        console.log(`[MemoryService] Securing thread: ${rootUri}`);

        // 1. Get the full thread to find all replies from others
        const thread = await blueskyService.getDetailedThread(rootUri);
        if (!thread) return;

        const repliesToHide = [];
        const collectOtherReplies = (node) => {
            if (node.replies) {
                for (const reply of node.replies) {
                    if (reply.post) {
                        // If the author of the reply is not the bot, add it to hide list
                        if (reply.post.author.did !== blueskyService.did) {
                            repliesToHide.push(reply.post.uri);
                        }
                        collectOtherReplies(reply);
                    }
                }
            }
        };

        collectOtherReplies(thread);

        // 2. Upsert threadgate with allow: [] (Nobody) and the collected hidden replies
        const existingGate = await blueskyService.getThreadGate(rootUri);
        let allHidden = new Set(repliesToHide);
        if (existingGate && existingGate.value?.hiddenReplies) {
            existingGate.value.hiddenReplies.forEach(uri => allHidden.add(uri));
        }

        await blueskyService.upsertThreadGate(rootUri, {
            allow: [], // Nobody
            hiddenReplies: Array.from(allHidden)
        });
        console.log(`[MemoryService] Thread ${rootUri} secured. Hidden replies: ${allHidden.size}`);
    } catch (error) {
        console.error(`[MemoryService] Failed to secure thread ${rootUri}:`, error);
    }
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

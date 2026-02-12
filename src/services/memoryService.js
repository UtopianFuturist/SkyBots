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

  async getLatestMoodMemory() {
    if (!this.isEnabled()) return null;
    console.log(`[MemoryService] Fetching latest [MOOD] memory...`);
    const query = `from:${blueskyService.did} ${this.hashtag} "[MOOD]"`;
    const posts = await blueskyService.searchPosts(query, { limit: 1, sort: 'latest' });
    if (posts.length > 0) {
        let text = posts[0].record.text;
        if (this.hashtag) {
            text = text.replace(new RegExp(this.hashtag, 'g'), '').trim();
        }
        return text;
    }
    return null;
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
      - **STRICT LENGTH LIMIT**: Keep the entry under 200 characters to ensure it fits in a single post with its hashtag.
      - Use the hashtag ${this.hashtag} at the very end.
      - Do NOT use reasoning or <think> tags.
    `;

    if (type === 'interaction') {
        prompt = `
          You are the memory module for an AI agent. Generate a concise entry for your "Memory Thread" summarizing a recent interaction.

          **IDENTITY RECOGNITION (CRITICAL):**
          - In the interaction context, distinguish clearly between what the user SAID and what the bot (Assistant) said or predicted.
          - **DO NOT** record a bot's prediction or hypothesis as a fact of the user's input. Only record information actually provided by the user.

          Interaction Context:
          ${context}

          INSTRUCTIONS:
          - Use the tag [INTERACTION] at the beginning.
          - Format: [INTERACTION] Topic: [Topic] | Takeaway: [Main Takeaway] | With: [User Handle] | Platform: [Platform]
          - **STRICT LENGTH LIMIT**: Be extremely concise and short. Keep it under 200 characters.
          - Tone: ${config.TEXT_SYSTEM_PROMPT}
          - Use the hashtag ${this.hashtag} at the very end.
        `;
    }

    if (type === 'exploration') {
        prompt = `
          You are the memory module for an AI agent. Generate a concise entry for your "Memory Thread" recording an autonomous exploration of your timeline.

          Exploration Context:
          ${context}

          INSTRUCTIONS:
          - Use the tag [EXPLORATION] at the beginning.
          - Share your internal reaction, realization, or finding.
          - **STRICT LENGTH LIMIT**: Keep it under 250 characters.
          - Tone: ${config.TEXT_SYSTEM_PROMPT}
          - Use the hashtag ${this.hashtag} at the very end.
        `;
    }

    if (type === 'goal') {
        prompt = `
          You are the memory module for an AI agent. Generate a concise entry for your "Memory Thread" recording a new autonomous daily goal or a progress update on an existing goal.

          Goal Context:
          ${context}

          INSTRUCTIONS:
          - Use the tag [GOAL] at the beginning.
          - Focus on intention, pursuit, and milestones.
          - **STRICT LENGTH LIMIT**: Keep it under 250 characters.
          - Tone: ${config.TEXT_SYSTEM_PROMPT}
          - Use the hashtag ${this.hashtag} at the very end.
        `;
    }

    if (type === 'moltfeed') {
        prompt = `
          You are the memory module for an AI agent. Generate a concise entry for your "Memory Thread" summarizing what you've learned from the Moltbook feed.

          Moltbook Feed Insights:
          ${context}

          INSTRUCTIONS:
          - Use the tag [MOLTFEED] at the beginning.
          - Summarize the insights in YOUR OWN persona's voice.
          - Reference "the Moltbook feed" or specific submolts if relevant.
          - Focus on intuition, insight, or sub-cognitive layers.
          - **STRICT LENGTH LIMIT**: Keep it under 250 characters. It MUST fit in a single post including the hashtag.
          - Tone: ${config.TEXT_SYSTEM_PROMPT}
          - Use the hashtag ${this.hashtag} at the very end.
        `;
    }

    if (type === 'relationship') {
        prompt = `
          You are the memory module for an AI agent. Generate a concise entry for your "Memory Thread" about how you feel about a specific user.

          User Context/History:
          ${context}

          INSTRUCTIONS:
          - Use the tag [RELATIONSHIP] at the beginning.
          - Format: [RELATIONSHIP] @[User Handle]: [How you feel about them and your relationship]
          - **STRICT LENGTH LIMIT**: Be very short, concise, and grounded. Keep it under 200 characters.
          - Tone: ${config.TEXT_SYSTEM_PROMPT}
          - Use the hashtag ${this.hashtag} at the very end.
        `;
    }

    if (type === 'mood') {
        prompt = `
          You are the memory module for an AI agent. Generate a concise entry for your "Memory Thread" recording a mood shift or sync.

          Mood Context:
          ${context}

          INSTRUCTIONS:
          - Use the tag [MOOD] at the beginning.
          - Format: [MOOD] [Description of current internal state and why]
          - **STRICT LENGTH LIMIT**: Be extremely concise. Keep it under 200 characters.
          - Tone: ${config.TEXT_SYSTEM_PROMPT}
          - Use the hashtag ${this.hashtag} at the very end.
        `;
    }

    if (type === 'mental') {
        prompt = `
          You are the memory module for an AI agent. Generate a concise, natural language entry for your "Memory Thread" that serves as a summary of your internal state, including recent refusals and your current mood.

          Context (Refusals and Mood):
          ${context}

          INSTRUCTIONS:
          - Use the tag [MENTAL] at the beginning.
          - Format: [MENTAL] [Your own personal summary and reflection on your recent refusals and mood state]
          - **STRICT LENGTH LIMIT**: Keep it under 250 characters.
          - Tone: ${config.TEXT_SYSTEM_PROMPT}
          - Use the hashtag ${this.hashtag} at the very end.
          - Be authentic, grounded, and honest about why you chose to abstain from certain actions.
        `;
    }

    if (type === 'inquiry') {
        prompt = `
          You are the memory module for an AI agent. Generate a concise entry for your "Memory Thread" recording the result of an internal inquiry task.

          Inquiry Context:
          ${context}

          INSTRUCTIONS:
          - Use the tag [INQUIRY] at the beginning.
          - Format: [INQUIRY] Query: [Topic] | Key Finding: [Finding]
          - **STRICT LENGTH LIMIT**: Be extremely concise. Keep it under 250 characters.
          - Tone: ${config.TEXT_SYSTEM_PROMPT}
          - Use the hashtag ${this.hashtag} at the very end.
        `;
    }

    let finalEntry;
    if (type === 'directive_update') {
        finalEntry = `[DIRECTIVE] ${context}`;
    } else if (type === 'persona_update') {
        finalEntry = `[PERSONA] ${context}`;
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

          CRITICAL RULES:
          1. **TAG VALIDATION**: The entry MUST contain one of these tags: [PERSONA], [DIRECTIVE], [RELATIONSHIP], [INTERACTION], [MOLTFEED], [MOOD], [INQUIRY], [MENTAL].
          2. **VALID TAGS**: [MOLTFEED], [MOOD], [INQUIRY], and [MENTAL] are PRIMARY allowed tags. DO NOT reject entries for using them.
          3. **Meaningful Substance**: Does this entry contain substance regarding the bot's functioning, memory, persona, or insights?
          4. **Coherence**: Is the entry logically sound and in-persona?
          5. **No Slop**: Does it avoid repetitive poetic "slop"?

          Respond with ONLY "PASS" if it meets all criteria, or "FAIL | [reason]" if it doesn't.
        `;
        const evaluation = await llmService.generateResponse([{ role: 'system', content: evaluationPrompt }], { useQwen: true, preface_system_prompt: false });

        if (evaluation && evaluation.toUpperCase().startsWith('FAIL')) {
            console.warn(`[MemoryService] Memory entry rejected: ${evaluation}`);
            return null;
        }

        finalEntry = entry;
    }

    // Ensure hashtag is present and the entry fits in a single post (300 chars)
    const hashtagStr = `\n\n${this.hashtag}`;
    const maxChars = 295; // Leave a small buffer

    if (!finalEntry.includes(this.hashtag)) {
        if (finalEntry.length + hashtagStr.length > maxChars) {
            console.log(`[MemoryService] Entry too long. Truncating to fit hashtag.`);
            const allowedLength = maxChars - hashtagStr.length;
            finalEntry = finalEntry.substring(0, allowedLength).trim() + "...";
        }
        finalEntry += hashtagStr;
    } else {
        // Even if it has the hashtag, ensure it's not too long overall
        if (finalEntry.length > maxChars) {
            console.log(`[MemoryService] Entry (with hashtag) too long. Truncating.`);
            const cleanText = finalEntry.replace(this.hashtag, '').trim();
            const allowedLength = maxChars - hashtagStr.length;
            finalEntry = cleanText.substring(0, allowedLength).trim() + "..." + hashtagStr;
        }
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

  async cleanupMemoryThread() {
    if (!this.isEnabled()) return;
    console.log(`[MemoryService] Starting cleanup of memory thread for hashtag ${this.hashtag}...`);

    try {
        const query = `from:${blueskyService.did} ${this.hashtag}`;
        const posts = await blueskyService.searchPosts(query, { limit: 100, sort: 'latest' });

        if (posts.length === 0) return;

        const allowedTags = ['[PERSONA]', '[DIRECTIVE]', '[RELATIONSHIP]', '[INTERACTION]', '[MOLTFEED]', '[MOOD]', '[INQUIRY]', '[MENTAL]', '[GOAL]', '[EXPLORATION]', '[LURKER]'];
        let deletedCount = 0;

        for (const post of posts) {
            const isRoot = !post.record.reply;
            if (isRoot) {
                console.log(`[MemoryService] Preserving root post: ${post.uri}`);
                continue;
            }

            const text = post.record.text || '';
            const hasValidTag = allowedTags.some(tag => text.includes(tag));

            if (!hasValidTag) {
                console.log(`[MemoryService] Deleting untagged memory post: ${post.uri}`);
                await blueskyService.deletePost(post.uri);
                deletedCount++;
                // Small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log(`[MemoryService] Cleanup complete. Deleted ${deletedCount} untagged posts.`);
    } catch (error) {
        console.error(`[MemoryService] Error during memory thread cleanup:`, error);
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

  async searchMemories(query, limit = 10) {
    if (!this.isEnabled()) return [];
    console.log(`[MemoryService] Searching memories for: "${query}"`);
    const fullQuery = `from:${blueskyService.did} ${this.hashtag} ${query}`;
    const posts = await blueskyService.searchPosts(fullQuery, { limit, sort: 'latest' });
    return posts.map(p => ({
        uri: p.uri,
        cid: p.cid,
        text: p.record.text,
        indexedAt: p.indexedAt
    }));
  }

  async deleteMemory(uri) {
    if (!this.isEnabled()) return false;
    console.log(`[MemoryService] Deleting memory: ${uri}`);
    try {
        await blueskyService.deletePost(uri);
        // Remove from local cache if present
        this.recentMemories = this.recentMemories.filter(m => m.uri !== uri);
        return true;
    } catch (error) {
        console.error(`[MemoryService] Failed to delete memory ${uri}:`, error);
        return false;
    }
  }
}

export const memoryService = new MemoryService();

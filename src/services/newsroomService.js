import { blueskyService } from './blueskyService.js';
import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import config from '../../config.js';

class NewsroomService {
    constructor() {
        this.sources = ['apnews.bsky.social', 'reuters.com']; // Standard trusted news on Bsky
    }

    async getDailyBrief(topics) {
        console.log('[Newsroom] Generating daily brief for topics:', topics.join(', '));
        try {
            let newsText = "";
            for (const source of this.sources) {
                const posts = await blueskyService.getUserPosts(source);
                newsText += `--- SOURCE: @${source} ---\n` + posts.slice(0, 10).join('\n') + '\n';
            }

            const prompt = `
                You are "The Newsroom". Analyze the following recent news from AP and Reuters on Bluesky.
                Filter for information relevant to these interests: ${topics.join(', ')}.

                **GOAL:**
                Provide a concise "Daily Narrative Brief" for the bot. Identify:
                1. Major shifts in discourse.
                2. Real-world events that impact the bot's persona (agnostically).
                3. Potential keywords for the Firehose.

                NEWS DATA:
                ${newsText.substring(0, 4000)}

                Respond with JSON:
                {
                    "brief": "a short narrative summary",
                    "new_keywords": ["string"],
                    "suggested_vibe": "neutral|concerned|excited|reflective"
                }
            `;

            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true, preface_system_prompt: false });
            const match = res ? res.match(/\{[\s\S]*\}/) : null;
            if (match) {
                return JSON.parse(match[0]);
            }
        } catch (e) {
            console.error('[Newsroom] Error:', e);
        }
        return { brief: "No significant news found today.", new_keywords: [], suggested_vibe: "neutral" };
    }
}

export const newsroomService = new NewsroomService();

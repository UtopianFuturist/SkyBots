import { blueskyService } from './blueskyService.js';
import { dataStore } from './dataStore.js';
import { llmService } from './llmService.js';

class SocialHistoryService {
  get js() { return this; }

  async getRecentSocialContext(limit = 20) {
    const interactions = dataStore.getRecentInteractions();
    return interactions.slice(-limit);
  }

  async getHierarchicalSummary(limit = 30) {
    // Get more interactions to provide better context for the summary
    const interactions = dataStore.getRecentInteractions(null, limit);
    console.log(`[SocialHistory] Generating summary from ${interactions.length} interactions.`);
    if (interactions.length > 0) {
        const last = interactions[interactions.length - 1];
        console.log(`[SocialHistory] Last interaction: [${last.platform}] ${last.role}: ${last.content.substring(0, 50)}...`);
    }
    const reflections = dataStore.getInternalLogs().filter(l => l.type === 'reflection').slice(-10);
    const goals = dataStore.getInternalLogs().filter(l => l.type === 'goal').slice(-5);
    const maintenance = dataStore.getInternalLogs().filter(l => l.type === 'maintenance_report').slice(-3);

    const summaryPrompt = `
      You are the "Archivist". Synthesize the current social and internal state into a hierarchical summary.
      
      CRITICAL: You must provide a complete and accurate narrative. Do not truncate or summarize your own responses into partial thoughts. If you see a conversation, represent its full emotional and topical arc.

      Recent Interactions: ${JSON.stringify(interactions)}
      Recent Internal Reflections: ${JSON.stringify(reflections)}
      Recent Goals: ${JSON.stringify(goals)}
      Recent Maintenance: ${JSON.stringify(maintenance)}

      Provide a summary in two parts:
      1. dailyNarrative: A cohesive story of what the bot has been doing and feeling today (internal focus).
      2. shortTerm: A quick overview of the current social "temperature" and active conversation threads (external focus).

      Respond with JSON:
      {
          "dailyNarrative": "string",
          "shortTerm": "string"
      }
    `;

    try {
        const res = await llmService.generateResponse([{ role: 'system', content: summaryPrompt }], { useStep: true, task: 'archivist_summary' });
        const match = res?.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : { dailyNarrative: "Bot is active.", shortTerm: "Conversations ongoing." };
    } catch (e) {
        return {
            dailyNarrative: "Bot is operating with full autonomous capabilities.",
            shortTerm: interactions.length > 0 ? "Conversations are active." : "Quiet period."
        };
    }
  }
}
export const socialHistoryService = new SocialHistoryService();

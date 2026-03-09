import { blueskyService } from './blueskyService.js';
import { dataStore } from './dataStore.js';

class SocialHistoryService {
  get js() { return this; }

  async getRecentSocialContext(limit = 15) {
    const interactions = dataStore.getRecentInteractions();
    return interactions.slice(-limit);
  }

  async getHierarchicalSummary(limit = 20) {
    const interactions = dataStore.getRecentInteractions();
    const shortTerm = interactions.length > 0 ? "Conversations are active." : "Quiet period.";
    return {
      shortTerm,
      dailyNarrative: "Bot is operating with full autonomous capabilities."
    };
  }
}
export const socialHistoryService = new SocialHistoryService();

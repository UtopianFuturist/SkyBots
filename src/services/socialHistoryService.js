import { blueskyService } from './blueskyService.js';
import { dataStore } from './dataStore.js';

class SocialHistoryService {
  get js() { return this; }

  async getRecentSocialContext(limit = 15) {
    const interactions = dataStore.getRecentInteractions();
    return interactions.slice(-limit);
  }

  async getHierarchicalSummary(limit = 20) {
    return {
      shortTerm: "Interaction patterns are normal.",
      dailyNarrative: "Bot is operating autonomously."
    };
  }
}
export const socialHistoryService = new SocialHistoryService();

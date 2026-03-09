import { blueskyService } from './blueskyService.js';
import { dataStore } from './dataStore.js';
import config from '../../config.js';

class SocialHistoryService {
  async getRecentSocialContext(limit = 15) {
    return [];
  }
  async summarizeSocialHistory(limit = 10) {
    return "Social history summary stub.";
  }
  async getHierarchicalSummary(limit = 20) {
    return { shortTerm: "No recent activity.", dailyNarrative: "The day has been quiet." };
  }
}
export const socialHistoryService = new SocialHistoryService();

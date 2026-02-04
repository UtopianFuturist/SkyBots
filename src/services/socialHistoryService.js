import { blueskyService } from './blueskyService.js';
import { dataStore } from './dataStore.js';
import config from '../../config.js';

class SocialHistoryService {
  async getRecentSocialContext(limit = 15) {
    console.log(`[SocialHistoryService] Gathering social context (limit: ${limit})...`);

    // 1. Get local interactions
    const localInteractions = dataStore.getRecentInteractions(limit);

    // 2. Get Bluesky on-network activity
    const bskyActivity = await blueskyService.getUserActivity(config.BLUESKY_IDENTIFIER, limit);

    // 3. Consolidate
    // We want to merge these and potentially resolve who we were talking to on Bluesky
    const consolidated = [];

    for (const act of bskyActivity) {
        let interaction = {
            type: act.type,
            text: act.text,
            timestamp: act.indexedAt,
            platform: 'bluesky',
            uri: act.uri
        };

        if (act.type === 'reply' && act.replyTo) {
            // Try to find the local record to see who we replied to
            const local = localInteractions.find(i => i.response === act.text);
            if (local) {
                interaction.to = `@${local.userHandle}`;
                interaction.userText = local.text;
            } else {
                // If not in local DB (maybe from another session), we could fetch the parent post
                // For now, mark it as unknown
                interaction.to = 'someone (not in local cache)';
            }
        }

        consolidated.push(interaction);
    }

    return consolidated;
  }

  async summarizeSocialHistory(limit = 10) {
    const history = await this.getRecentSocialContext(limit);
    if (history.length === 0) return "No recent social history found.";

    let summary = "Recent Bluesky Social History:\n";
    for (const item of history) {
        const date = new Date(item.timestamp).toLocaleString();
        if (item.type === 'reply') {
            summary += `- [${date}] Replied to ${item.to}: "${item.text.substring(0, 100)}${item.text.length > 100 ? '...' : ''}"\n`;
            if (item.userText) {
                summary += `  (They said: "${item.userText.substring(0, 50)}...")\n`;
            }
        } else if (item.type === 'post') {
            summary += `- [${date}] Posted: "${item.text.substring(0, 100)}${item.text.length > 100 ? '...' : ''}"\n`;
        } else {
            summary += `- [${date}] ${item.type}: "${item.text.substring(0, 100)}..."\n`;
        }
    }
    return summary;
  }
}

export const socialHistoryService = new SocialHistoryService();

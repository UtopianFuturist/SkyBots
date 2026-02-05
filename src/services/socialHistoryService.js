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

  /**
   * Provides a hierarchical summary of social activity:
   * 1. Short-term: Highly detailed activity from the last 60 minutes.
   * 2. Daily Narrative: A broader summary of the day's interactions.
   */
  async getHierarchicalSummary(limit = 20) {
    const history = await this.getRecentSocialContext(limit);
    if (history.length === 0) return { shortTerm: "No recent activity.", dailyNarrative: "The day has been quiet." };

    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const todayStart = new Date().setHours(0, 0, 0, 0);

    const lastHour = history.filter(h => new Date(h.timestamp).getTime() > oneHourAgo);
    const earlierToday = history.filter(h => {
        const ts = new Date(h.timestamp).getTime();
        return ts > todayStart && ts <= oneHourAgo;
    });

    let shortTerm = "RECENT (Last Hour):\n";
    if (lastHour.length === 0) {
        shortTerm += "- No interactions in the last hour.\n";
    } else {
        for (const item of lastHour) {
            const timeStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            shortTerm += `- [${timeStr}] ${item.type === 'reply' ? `To ${item.to}` : 'Post'}: ${item.text.substring(0, 80)}...\n`;
        }
    }

    let dailyNarrative = "DAILY NARRATIVE:\n";
    const todayAll = history.filter(h => new Date(h.timestamp).getTime() > todayStart);
    if (todayAll.length === 0) {
        dailyNarrative += "- No activity recorded today.";
    } else {
        // Group by user if possible
        const userInteractions = {};
        let standaloneCount = 0;

        for (const item of todayAll) {
            if (item.type === 'reply' && item.to) {
                userInteractions[item.to] = (userInteractions[item.to] || 0) + 1;
            } else {
                standaloneCount++;
            }
        }

        const userList = Object.entries(userInteractions)
            .map(([user, count]) => `${user} (${count}x)`)
            .join(', ');

        dailyNarrative += `- Total Interactions: ${todayAll.length}\n`;
        if (userList) dailyNarrative += `- Talking with: ${userList}\n`;
        dailyNarrative += `- Standalone Musing count: ${standaloneCount}\n`;

        // Add a "vibe" summary based on the most recent posts
        const lastFew = todayAll.slice(0, 3);
        const themes = lastFew.map(h => h.text.substring(0, 30)).join('; ');
        dailyNarrative += `- Recent Themes: ${themes}...`;
    }

    return { shortTerm, dailyNarrative };
  }
}

export const socialHistoryService = new SocialHistoryService();

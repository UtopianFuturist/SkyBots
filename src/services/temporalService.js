import { dataStore } from './dataStore.js';

class TemporalService {
  constructor() {
    this.decayInterval = 15 * 60 * 1000; // Check decay every 15 mins
  }

  /**
   * Resolves fuzzy time terms like "later", "soon", "in a bit" into concrete minute offsets.
   * @param {string} fuzzyTime
   * @returns {number} minutes
   */
  resolveFuzzyTime(fuzzyTime) {
    const lower = fuzzyTime.toLowerCase();
    if (lower.includes('soon') || lower.includes('in a bit')) return 30;
    if (lower.includes('later')) return 120;
    if (lower.includes('tonight')) return 360;
    if (lower.includes('morning')) return 720;
    if (lower.includes('tomorrow')) return 1440;

    // Check for "in X minutes/hours"
    const inMatch = lower.match(/in (\d+) (minute|hour|day)/);
    if (inMatch) {
      const val = parseInt(inMatch[1]);
      const unit = inMatch[2];
      if (unit.startsWith('minute')) return val;
      if (unit.startsWith('hour')) return val * 60;
      if (unit.startsWith('day')) return val * 1440;
    }

    return 60; // Default
  }

  /**
   * Gets the activity decay duration from DataStore or defaults.
   * @param {string} activity
   * @returns {number} minutes
   */
  getDecayMinutes(activity) {
    const rules = dataStore.getActivityDecayRules();
    return rules[activity.toLowerCase()] || 60;
  }

  /**
   * Synthesizes all temporal awareness data for the LLM.
   */
  async getEnhancedTemporalContext() {
    const now = new Date();
    const adminTz = dataStore.getAdminTimezone();
    const adminLocalTime = new Date(now.getTime() + (adminTz.offset * 60 * 1000));

    const events = dataStore.getTemporalEvents();
    const deadlines = dataStore.getDeadlines();
    const habits = dataStore.getHabits();

    let context = `
**ENHANCED TEMPORAL AWARENESS (ADMIN):**
- Admin Local Time: ${adminLocalTime.toLocaleString()} (Timezone: ${adminTz.timezone})
- Period: ${this._getTimeOfDayLabel(adminLocalTime.getHours())}
`;

    if (events.length > 0) {
      context += `\n**ACTIVE TEMPORAL HOOKS (SENSITIVE):**\n`;
      events.forEach(e => {
        const remaining = Math.round((e.expires_at - Date.now()) / 60000);
        context += `- "${e.text}" (Expires in approx ${remaining} minutes)\n`;
      });
    }

    if (deadlines.length > 0) {
      context += `\n**UPCOMING DEADLINES:**\n`;
      deadlines.forEach(d => {
        context += `- ${d.task} (Target: ${d.targetDate})\n`;
      });
    }

    if (habits.length > 0) {
      const topHabits = habits.sort((a, b) => b.frequency - a.frequency).slice(0, 3);
      context += `\n**DETECTED ADMIN HABITS:**\n`;
      topHabits.forEach(h => {
        context += `- ${h.pattern} (Seen ${h.frequency} times)\n`;
      });
    }

    // Calendar Context (Simple for now)
    const holidays = this._getSimpleCalendarContext(adminLocalTime);
    if (holidays) {
      context += `\n**CALENDAR CONTEXT:** ${holidays}\n`;
    }

    return context;
  }

  _getTimeOfDayLabel(hour) {
    if (hour >= 5 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 21) return 'Evening';
    return 'Night';
  }

  _getSimpleCalendarContext(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // Very basic hardcoded holidays for demonstration
    if (month === 1 && day === 1) return "New Year's Day";
    if (month === 12 && day === 25) return "Christmas Day";
    if (month === 10 && day === 31) return "Halloween";
    if (month === 2 && day === 14) return "Valentine's Day";

    return null;
  }
}

export const temporalService = new TemporalService();

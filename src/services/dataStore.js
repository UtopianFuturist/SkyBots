import { JSONFilePreset } from 'lowdb/node';
import path from 'path';
import config from '../../config.js';

class DataStore {
  constructor() {
    this.db = null;
    this.dbPath = path.resolve(process.cwd(), 'src/data/db.json');
  }

  async init() {
    const defaultData = {
      interaction_hunger: 0.5,
      intimacy_scores: {},
      last_interaction_times: {},
      discord_conversations: {},
      discord_channel_summaries: {},
      discord_user_facts: {},
      bluesky_instructions: "",
      moltbook_instructions: "",
      persona_updates: "",
      pending_directives: [],
      interaction_heat: {},
      user_soul_mappings: {},
      linguistic_patterns: {},
      mood_history: [],
      current_mood: { valence: 0.5, arousal: 0.5, stability: 0.5, label: 'balanced' },
      admin_did: null,
      admin_exhaustion: 0,
      refusal_counts: { global: 0, discord: 0, bluesky: 0 },
      boundary_lockouts: {},
      admin_emotional_states: [],
      admin_feedback: [],
      last_admin_vibe_check: 0,
      post_topics: config.POST_TOPICS ? config.POST_TOPICS.split(',').map(t => t.trim()) : [],
      image_subjects: config.IMAGE_SUBJECTS ? config.IMAGE_SUBJECTS.split(',').map(t => t.trim()) : [],
      discord_scheduled_tasks: [],
      scheduled_posts: [],
      exhausted_themes: [],
      discord_exhausted_themes: [],
      nuance_gradience: 5,
      world_facts: [],
      admin_facts: [],
      agency_logs: [],
      recent_thoughts: [],
      config: {
        bluesky_post_cooldown: parseInt(config.BLUESKY_POST_COOLDOWN) || 120,
        moltbook_post_cooldown: 240,
        max_thread_chunks: 3
      }
    };

    this.db = await JSONFilePreset(this.dbPath, defaultData);

    // Sync env variables if db is empty
    if ((this.db.data.post_topics || []).length === 0 && config.POST_TOPICS) {
        this.db.data.post_topics = config.POST_TOPICS.split(',').map(t => t.trim());
    }
    if ((this.db.data.image_subjects || []).length === 0 && config.IMAGE_SUBJECTS) {
        this.db.data.image_subjects = config.IMAGE_SUBJECTS.split(',').map(t => t.trim());
    }

    await this.db.write();
    console.log('[DataStore] Initialized and synced.');
  }

  // Helper methods
  getDiscordScheduledTasks() { return this.db.data.discord_scheduled_tasks || []; }
  async addDiscordScheduledTask(task) {
      this.db.data.discord_scheduled_tasks.push({ ...task, timestamp: Date.now() });
      await this.db.write();
  }
  async removeDiscordScheduledTask(index) {
      this.db.data.discord_scheduled_tasks.splice(index, 1);
      await this.db.write();
  }

  getScheduledPosts() { return this.db.data.scheduled_posts || []; }
  async addScheduledPost(platform, content, embed, delayMins) {
      const timestamp = Date.now() + (delayMins * 60 * 1000);
      this.db.data.scheduled_posts.push({ platform, content, embed, timestamp });
      await this.db.write();
  }
  async removeScheduledPost(index) {
      this.db.data.scheduled_posts.splice(index, 1);
      await this.db.write();
  }

  async saveDiscordInteraction(channelId, role, content, metadata = {}) {
    if (!this.db.data.discord_conversations[channelId]) {
      this.db.data.discord_conversations[channelId] = [];
    }
    this.db.data.discord_conversations[channelId].push({
      role,
      content,
      timestamp: Date.now(),
      ...metadata
    });
    // Keep last 100 messages
    if (this.db.data.discord_conversations[channelId].length > 100) {
      this.db.data.discord_conversations[channelId].shift();
    }
    await this.db.write();
  }

  getDiscordConversation(channelId) {
    return this.db.data.discord_conversations[channelId] || [];
  }

  async updateDiscordChannelSummary(channelId, summary, vibe) {
    this.db.data.discord_channel_summaries[channelId] = { summary, vibe, timestamp: Date.now() };
    await this.db.write();
  }

  getDiscordChannelSummary(channelId) {
    return this.db.data.discord_channel_summaries[channelId];
  }

  async updateDiscordUserFact(userId, fact) {
    if (!this.db.data.discord_user_facts[userId]) this.db.data.discord_user_facts[userId] = [];
    this.db.data.discord_user_facts[userId].push(fact);
    if (this.db.data.discord_user_facts[userId].length > 20) this.db.data.discord_user_facts[userId].shift();
    await this.db.write();
  }

  getDiscordUserFacts(userId) {
    return this.db.data.discord_user_facts[userId] || [];
  }

  async setAdminDid(did) { this.db.data.admin_did = did; await this.db.write(); }
  getAdminDid() { return this.db.data.admin_did; }

  async updateAdminExhaustion(delta) {
    this.db.data.admin_exhaustion = Math.max(0, Math.min(1, (this.db.data.admin_exhaustion || 0) + delta));
    await this.db.write();
  }
  getAdminExhaustion() { return this.db.data.admin_exhaustion || 0; }

  async incrementRefusalCount(platform) {
    this.db.data.refusal_counts.global++;
    this.db.data.refusal_counts[platform]++;
    await this.db.write();
  }
  async resetRefusalCount(platform) {
    if (platform === 'global') {
        this.db.data.refusal_counts = { global: 0, discord: 0, bluesky: 0 };
    } else {
        this.db.data.refusal_counts[platform] = 0;
    }
    await this.db.write();
  }
  getRefusalCounts() { return this.db.data.refusal_counts; }

  async setBoundaryLockout(userId, mins) {
    this.db.data.boundary_lockouts[userId] = Date.now() + (mins * 60 * 1000);
    await this.db.write();
  }
  async clearBoundaryLockout(userId) {
    delete this.db.data.boundary_lockouts[userId];
    await this.db.write();
  }
  isUserLockedOut(userId) {
    const lockout = this.db.data.boundary_lockouts[userId];
    return lockout && lockout > Date.now();
  }

  async addAdminEmotionalState(state) {
    this.db.data.admin_emotional_states.push(state);
    if (this.db.data.admin_emotional_states.length > 10) this.db.data.admin_emotional_states.shift();
    await this.db.write();
  }
  getAdminLastEmotionalStates() { return this.db.data.admin_emotional_states || []; }

  async addAdminFeedback(feedback) {
    this.db.data.admin_feedback.push({ feedback, timestamp: Date.now() });
    await this.db.write();
  }

  getMood() { return this.db.data.current_mood; }
  async updateMood(mood) { this.db.data.current_mood = { ...this.db.data.current_mood, ...mood }; await this.db.write(); }

  getConfig() { return this.db.data.config; }
  async updateConfig(key, value) { this.db.data.config[key] = value; await this.db.write(); return true; }

  getExhaustedThemes() { return this.db.data.exhausted_themes || []; }
  async addExhaustedTheme(theme) {
      if (!this.db.data.exhausted_themes.includes(theme)) {
          this.db.data.exhausted_themes.push(theme);
          if (this.db.data.exhausted_themes.length > 50) this.db.data.exhausted_themes.shift();
          await this.db.write();
      }
  }

  getDiscordExhaustedThemes() { return this.db.data.discord_exhausted_themes || []; }
  async addDiscordExhaustedTheme(theme) {
      if (!this.db.data.discord_exhausted_themes.includes(theme)) {
          this.db.data.discord_exhausted_themes.push(theme);
          if (this.db.data.discord_exhausted_themes.length > 20) this.db.data.discord_exhausted_themes.shift();
          await this.db.write();
      }
  }

  async addWorldFact(entity, fact, source) {
      this.db.data.world_facts.push({ entity, fact, source, timestamp: Date.now() });
      await this.db.write();
  }
  async addAdminFact(fact) {
      this.db.data.admin_facts.push({ fact, timestamp: Date.now() });
      await this.db.write();
  }

  async logAgencyAction(intent, decision, reason) {
      this.db.data.agency_logs.push({ intent, decision, reason, timestamp: Date.now() });
      if (this.db.data.agency_logs.length > 100) this.db.data.agency_logs.shift();
      await this.db.write();
  }

  async addRecentThought(platform, content) {
      this.db.data.recent_thoughts.push({ platform, content, timestamp: Date.now() });
      if (this.db.data.recent_thoughts.length > 50) this.db.data.recent_thoughts.shift();
      await this.db.write();
  }
  getRecentThoughts() { return this.db.data.recent_thoughts || []; }

  getTimezone() { return this.db.data.timezone || "UTC"; }
  async setTimezone(tz) { this.db.data.timezone = tz; await this.db.write(); }

  async addPendingDirective(type, platform, instruction) {
      this.db.data.pending_directives.push({ type, platform, instruction, timestamp: Date.now() });
      await this.db.write();
  }
  getPendingDirectives() { return this.db.data.pending_directives || []; }

  async addPersonaUpdate(update) {
      this.db.data.persona_updates += "\\n" + update;
      await this.db.write();
  }
  getPersonaUpdates() { return this.db.data.persona_updates || ""; }

  getBlueskyInstructions() { return this.db.data.bluesky_instructions || ""; }
}

export const dataStore = new DataStore();

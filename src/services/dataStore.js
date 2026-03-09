import { JSONFilePreset } from 'lowdb/node';
import path from 'path';
import config from '../../config.js';

class DataStore {
  constructor() {
    this._db = null;
    this.dbPath = path.resolve(process.cwd(), 'src/data/db.json');
  }

  async init() {
    const defaultData = {
      interaction_hunger: 0.5,
      current_mood: { label: 'balanced' },
      admin_did: null,
      refusal_counts: { global: 0, discord: 0, bluesky: 0 },
      post_topics: config.POST_TOPICS ? config.POST_TOPICS.split(',').map(t => t.trim()) : [],
      image_subjects: config.IMAGE_SUBJECTS ? config.IMAGE_SUBJECTS.split(',').map(t => t.trim()) : [],
      config: {
        bluesky_post_cooldown: parseInt(config.BLUESKY_POST_COOLDOWN) || 120,
        max_thread_chunks: 3
      },
      current_goal: { goal: "Autonomous exploration", description: "Default startup goal", timestamp: Date.now() },
      repliedPosts: [],
      discord_conversations: {},
      interactions: [],
      recent_thoughts: [],
      exhausted_themes: [],
      deep_keywords: []
    };
    this.db = await JSONFilePreset(this.dbPath, defaultData);
    await this.db.write();
  }

  get js() { return this; }
  get db() { return this._db; }
  set db(val) { this._db = val; }
  async write() { await this.db.write(); }

  async addAdminFact(f) { await this.write(); }
  async addBlueskyInstruction(i) { await this.write(); }
  async addExhaustedTheme(t) { this.db.data.exhausted_themes.push(t); await this.write(); }
  async addFirehoseMatch(m) { await this.write(); }
  async addPersonaUpdate(u) { await this.write(); }
  async addRepliedPost(p) { this.db.data.repliedPosts.push(p); await this.write(); }
  async addRecentThought(p, c) { this.db.data.recent_thoughts.push({ platform: p, content: c, timestamp: Date.now() }); await this.write(); }
  async addStrategyAudit(a) { await this.write(); }
  async blockUser(h) { await this.write(); }
  getAdminDid() { return this.db.data.admin_did; }
  getAdminExhaustion() { return 0; }
  getAdminFacts() { return []; }
  getBlueskyInstructions() { return ""; }
  getConfig() { return this.db.data.config; }
  getCurrentGoal() { return this.db.data.current_goal; }
  getDeepKeywords() { return this.db.data.deep_keywords || []; }
  getDiscordConversation(c) { return this.db.data.discord_conversations?.[c] || []; }
  getDiscordRelationshipMode() { return 'acquaintance'; }
  getDiscordScheduledTasks() { return []; }
  getExhaustedThemes() { return this.db.data.exhausted_themes || []; }
  getFirehoseMatches() { return []; }
  getGoalSubtasks() { return []; }
  getInteractionHeat() { return { warmth: 0.5 }; }
  getMood() { return this.db.data.current_mood; }
  getPersonaUpdates() { return ""; }
  getPostContinuations() { return []; }
  getPredictiveEmpathyMode() { return 'neutral'; }
  getRecentInteractions() { return []; }
  getRefusalCounts() { return this.db.data.refusal_counts; }
  getRelationalDebtScore() { return 0; }
  getRelationalMetrics() { return {}; }
  hasReplied(p) { return (this.db.data.repliedPosts || []).includes(p); }
  isLurkerMode() { return false; }
  isResting() { return false; }
  async logAgencyAction(i, d, r) { await this.write(); }
  async recordUserToneShift(u, t, i) { await this.write(); }
  async removeDiscordScheduledTask(i) { await this.write(); }
  async resetRefusalCount(p) { await this.write(); }
  async saveDiscordInteraction(c, r, ct) { if (!this.db.data.discord_conversations[c]) this.db.data.discord_conversations[c] = []; this.db.data.discord_conversations[c].push({ role: r, content: ct, timestamp: Date.now() }); await this.write(); }
  async saveInteraction(i) { this.db.data.interactions.push(i); await this.write(); }
  async setAdminDid(d) { this.db.data.admin_did = d; await this.write(); }
  async setCurrentGoal(g, d) { this.db.data.current_goal = { goal: g, description: d, timestamp: Date.now() }; await this.write(); }
  async setDeepKeywords(k) { this.db.data.deep_keywords = k; await this.write(); }
  async setPredictiveEmpathyMode(m) { await this.write(); }
  async updateConfig(k, v) { this.db.data.config[k] = v; await this.write(); return true; }
  async updateLastAutonomousPostTime(t) { this.db.data.lastAutonomousPostTime = t; await this.write(); }
  async updateRelationalMetrics(m) { await this.write(); }
  async updateUserDossier(u, d) { await this.write(); }
  async updateUserSummary(u, s) { await this.write(); }
  async updateSocialResonance(v, d) { await this.write(); }
  async mergeDiscordHistory(c, n) { this.db.data.discord_conversations[c] = n; await this.write(); return n; }
}
export const dataStore = new DataStore();

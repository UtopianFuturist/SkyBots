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
      current_mood: { label: 'balanced', score: 0.5, intensity: 0.5 },
      admin_did: null,
      refusal_counts: { global: 0, discord: 0, bluesky: 0 },
      post_topics: config.POST_TOPICS ? config.POST_TOPICS.split(',').map(t => t.trim()) : [],
      image_subjects: config.IMAGE_SUBJECTS ? config.IMAGE_SUBJECTS.split(',').map(t => t.trim()) : [],
      config: {
        bluesky_post_cooldown: parseInt(config.BLUESKY_POST_COOLDOWN) || 120,
        max_thread_chunks: 3,
        interaction_threshold: 0.7,
        post_topics: config.POST_TOPICS ? config.POST_TOPICS.split(',').map(t => t.trim()) : [],
        image_subjects: config.IMAGE_SUBJECTS ? config.IMAGE_SUBJECTS.split(',').map(t => t.trim()) : []
      },
      current_goal: { goal: "Autonomous exploration", description: "Default startup goal", timestamp: Date.now() },
      repliedPosts: [],
      discord_conversations: {},
      interactions: [],
      recent_thoughts: [],
      exhausted_themes: [],
      deep_keywords: [],
      scheduled_tasks: [],
      scheduled_posts: [],
      agency_logs: [],
      persona_advice: [],
      relational_reflections: [],
      admin_interests: {},
      relationship_season: 'spring',
      curiosity_reservoir: [],
      strong_relationship: false,
      post_continuations: [],
      energy_level: 0.8,
      last_autonomous_post_time: null,
      last_memory_cleanup_time: null,
      last_mental_reflection_time: null,
      last_moltfeed_summary_time: null,
      life_arcs: [],
      network_sentiment: 0.5,
      boundary_lockout: null,
      resting_until: null,
      shielding_active: false,
      user_dossiers: {},
      user_summaries: {},
      social_resonance: 0.5,
      trace_logs: []
    };

    this.db = await JSONFilePreset(this.dbPath, defaultData);

    // Self-healing: Ensure all keys from defaultData exist
    let changed = false;
    const heal = (target, defaults) => {
        for (const key in defaults) {
            if (target[key] === undefined) {
                target[key] = defaults[key];
                changed = true;
            } else if (typeof defaults[key] === 'object' && defaults[key] !== null && !Array.isArray(defaults[key])) {
                heal(target[key], defaults[key]);
            }
        }
    };

    heal(this.db.data, defaultData);
    if (changed) await this.db.write();
  }

  get js() { return this; }
  get db() { return this._db; }
  set db(val) { this._db = val; }
  async write() { if (this.db) await this.db.write(); }

  // Generic
  async update(fn) { await this.db.update(fn); }

  // Admin & Identity
  async setAdminDid(d) { this.db.data.admin_did = d; await this.write(); }
  getAdminDid() { return this.db.data.admin_did; }
  getAdminExhaustion() { return 0; }
  getAdminFacts() { return []; }
  async addAdminFact(f) { await this.write(); }
  getAdminInterests() { return this.db.data.admin_interests || {}; }
  async updateAdminInterests(i) { this.db.data.admin_interests = i; await this.write(); }

  // Config
  getConfig() { return this.db.data.config || {}; }
  async updateConfig(k, v) {
    if (!this.db.data.config) this.db.data.config = {};
    this.db.data.config[k] = v;
    await this.write();
    return true;
  }

  // Goals
  getCurrentGoal() { return this.db.data.current_goal || { goal: "None", description: "", timestamp: 0 }; }
  async setCurrentGoal(g, d) { this.db.data.current_goal = { goal: g, description: d, timestamp: Date.now() }; await this.write(); }
  setGoal(g) { this.db.data.current_goal.goal = g; this.write(); }
  getGoalSubtasks() { return []; }
  async addGoalEvolution(e) { await this.write(); }

  // History & Replied
  async addRepliedPost(p) {
    if (!this.db.data.repliedPosts) this.db.data.repliedPosts = [];
    if (!this.db.data.repliedPosts.includes(p)) this.db.data.repliedPosts.push(p);
    await this.write();
  }
  hasReplied(p) { return (this.db.data.repliedPosts || []).includes(p); }
  async saveInteraction(i) {
    if (!this.db.data.interactions) this.db.data.interactions = [];
    this.db.data.interactions.push(i);
    await this.write();
  }
  getRecentInteractions() { return (this.db.data.interactions || []).slice(-20); }

  // Discord
  getDiscordConversation(c) {
    if (!this.db.data.discord_conversations) this.db.data.discord_conversations = {};
    return this.db.data.discord_conversations[c] || [];
  }
  async saveDiscordInteraction(c, r, ct) {
    if (!this.db.data.discord_conversations) this.db.data.discord_conversations = {};
    if (!this.db.data.discord_conversations[c]) this.db.data.discord_conversations[c] = [];
    this.db.data.discord_conversations[c].push({ role: r, content: ct, timestamp: Date.now() });
    await this.write();
  }
  getDiscordScheduledTasks() { return (this.db.data.scheduled_tasks || []).filter(t => t.platform === 'discord'); }
  async removeDiscordScheduledTask(i) {
    if (this.db.data.scheduled_tasks) {
        this.db.data.scheduled_tasks.splice(i, 1);
        await this.write();
    }
  }
  getDiscordRelationshipMode() { return 'friendly'; }

  // Scheduling
  getScheduledPosts() { return this.db.data.scheduled_posts || []; }
  async addScheduledPost(p) {
    if (!this.db.data.scheduled_posts) this.db.data.scheduled_posts = [];
    this.db.data.scheduled_posts.push(p);
    await this.write();
  }
  async removeScheduledPost(i) {
    if (this.db.data.scheduled_posts) {
        this.db.data.scheduled_posts.splice(i, 1);
        await this.write();
    }
  }

  // Mood & State
  getMood() { return this.db.data.current_mood || { label: 'balanced' }; }
  getEnergyLevel() { return this.db.data.energy_level || 0.8; }
  async setEnergyLevel(l) { this.db.data.energy_level = l; await this.write(); }
  isResting() { return this.db.data.resting_until && Date.now() < this.db.data.resting_until; }
  async setRestingUntil(t) { this.db.data.resting_until = t; await this.write(); }
  isLurkerMode() { return false; }
  isPining() { return false; }
  isShieldingActive() { return this.db.data.shielding_active; }
  async setShieldingActive(a) { this.db.data.shielding_active = a; await this.write(); }

  // Themes & Keywords
  getExhaustedThemes() { return this.db.data.exhausted_themes || []; }
  async addExhaustedTheme(t) {
    if (!this.db.data.exhausted_themes) this.db.data.exhausted_themes = [];
    if (!this.db.data.exhausted_themes.includes(t)) this.db.data.exhausted_themes.push(t);
    await this.write();
  }
  getDeepKeywords() { return this.db.data.deep_keywords || []; }
  async setDeepKeywords(k) { this.db.data.deep_keywords = k; await this.write(); }
  getLastDeepKeywordRefresh() { return 0; }

  // Thoughts & Logs
  async addRecentThought(p, c) {
    if (!this.db.data.recent_thoughts) this.db.data.recent_thoughts = [];
    this.db.data.recent_thoughts.push({ platform: p, content: c, timestamp: Date.now() });
    await this.write();
  }
  getRecentThoughts() { return this.db.data.recent_thoughts || []; }
  async logAgencyAction(i, d, r) {
    if (!this.db.data.agency_logs) this.db.data.agency_logs = [];
    this.db.data.agency_logs.push({ id: i, description: d, result: r, timestamp: Date.now() });
    await this.write();
  }
  getAgencyLogs() { return this.db.data.agency_logs || []; }
  async addAgencyReflection(r) { await this.write(); }
  async addPersonaAdvice(a) {
    if (!this.db.data.persona_advice) this.db.data.persona_advice = [];
    this.db.data.persona_advice.push(a);
    await this.write();
  }
  async addStrategyAudit(a) { await this.write(); }
  async addTraceLog(l) {
    if (!this.db.data.trace_logs) this.db.data.trace_logs = [];
    this.db.data.trace_logs.push(l);
    await this.write();
  }

  // Social & Users
  async updateUserDossier(u, d) {
    if (!this.db.data.user_dossiers) this.db.data.user_dossiers = {};
    this.db.data.user_dossiers[u] = d;
    await this.write();
  }
  async updateUserSummary(u, s) {
    if (!this.db.data.user_summaries) this.db.data.user_summaries = {};
    this.db.data.user_summaries[u] = s;
    await this.write();
  }
  async updateSocialResonance(v, d) { this.db.data.social_resonance = v; await this.write(); }
  async blockUser(h) { await this.write(); }
  async unblockUser(h) { await this.write(); }
  isUserLockedOut(u) { return false; }
  async setBoundaryLockout(u, t) { this.db.data.boundary_lockout = { user: u, until: t }; await this.write(); }

  // Relational
  getRelationalMetrics() { return {}; }
  async updateRelationalMetrics(m) { await this.write(); }
  getRelationalDebtScore() { return 0; }
  async updateRelationshipSeason(s) { this.db.data.relationship_season = s; await this.write(); }
  async addRelationalReflection(r) {
    if (!this.db.data.relational_reflections) this.db.data.relational_reflections = [];
    this.db.data.relational_reflections.push(r);
    await this.write();
  }
  async setStrongRelationship(s) { this.db.data.strong_relationship = s; await this.write(); }
  async updateCuriosityReservoir(q) { this.db.data.curiosity_reservoir = q; await this.write(); }
  getPredictiveEmpathyMode() { return 'neutral'; }
  async setPredictiveEmpathyMode(m) { await this.write(); }

  // Timestamps
  getLastAutonomousPostTime() { return this.db.data.last_autonomous_post_time; }
  async updateLastAutonomousPostTime(t) { this.db.data.last_autonomous_post_time = t; await this.write(); }
  getLastMemoryCleanupTime() { return this.db.data.last_memory_cleanup_time; }
  async updateLastMemoryCleanupTime(t) { this.db.data.last_memory_cleanup_time = t; await this.write(); }
  getLastMentalReflectionTime() { return this.db.data.last_mental_reflection_time; }
  async updateLastMentalReflectionTime(t) { this.db.data.last_mental_reflection_time = t; await this.write(); }
  getLastMoltfeedSummaryTime() { return this.db.data.last_moltfeed_summary_time; }
  async updateLastMoltfeedSummaryTime(t) { this.db.data.last_moltfeed_summary_time = t; await this.write(); }

  // Others
  getFirehoseMatches() { return []; }
  async addFirehoseMatch(m) { await this.write(); }
  async addBlueskyInstruction(i) { await this.write(); }
  async addPersonaUpdate(u) { await this.write(); }
  getPostContinuations() { return this.db.data.post_continuations || []; }
  async removePostContinuation(i) {
    if (this.db.data.post_continuations) {
        this.db.data.post_continuations.splice(i, 1);
        await this.write();
    }
  }
  getLifeArcs() { return this.db.data.life_arcs || []; }
  async updateLifeArc(a) { await this.write(); }
  getNetworkSentiment() { return this.db.data.network_sentiment; }
  async setNetworkSentiment(s) { this.db.data.network_sentiment = s; await this.write(); }
  getRefusalCounts() { return this.db.data.refusal_counts || {}; }
  async incrementRefusalCount(p) {
    if (!this.db.data.refusal_counts) this.db.data.refusal_counts = {};
    this.db.data.refusal_counts[p] = (this.db.data.refusal_counts[p] || 0) + 1;
    await this.write();
  }

  // Stubs for missing but referenced
  async addCoEvolutionEntry(e) { await this.write(); }
  async addDiscoveredCapability(c) { await this.write(); }
  async addEmergentTrend(t) { await this.write(); }
  async addInsideJoke(j) { await this.write(); }
  async addLinguisticMutation(m) { await this.write(); }
  getInsideJokes() { return []; }
  async muteThread(u) { await this.write(); }
  async setAdminHomeMentionedAt(t) { await this.write(); }
  async setAdminWorkMentionedAt(t) { await this.write(); }
}

export const dataStore = new DataStore();

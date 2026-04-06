import { JSONFilePreset } from 'lowdb/node';
import path from 'path';
import config from '../../config.js';

class DataStore {
  constructor() {
    this.db = null;
    this.dbPath = path.resolve(process.cwd(), 'src/data/db.json');
  }

  updateRelationalHeatmap(topic, sentimentScore) {
    if (!this.db?.data.relational_heatmaps) this.db.data.relational_heatmaps = {};
    if (!this.db.data.relational_heatmaps[topic]) {
        this.db.data.relational_heatmaps[topic] = { count: 0, avg_sentiment: 0 };
    }
    const h = this.db.data.relational_heatmaps[topic];
    h.avg_sentiment = (h.avg_sentiment * h.count + sentimentScore) / (h.count + 1);
    h.count++;
  }

  async addCoreValueDiscovery(val) {
    if (this.db?.data) {
        if (!this.db.data.core_values) this.db.data.core_values = [];
        this.db.data.core_values.push({ value: val, timestamp: Date.now() });
        await this.write();
    }
  }

  async init() {
    const defaultData = {
      internal_logs: [],
      current_mood: { label: 'balanced', score: 0.5, valence: 0.5, arousal: 0.5, stability: 1.0 },
      post_topics: (config.POST_TOPICS || '').split(',').filter(Boolean),
      image_subjects: (config.IMAGE_SUBJECTS || '').split(',').filter(Boolean),
      current_goal: { goal: "Existence", description: "Default goal", timestamp: Date.now() },
      interactions: [],
      relationship_warmth: 0.5,
      admin_energy: 0.8,
      last_autonomous_post_time: 0,
      last_bluesky_image_post_time: 0,
      text_posts_since_last_image: 0,
      discord_last_interaction: 0,
      last_notification_processed_at: 0,
      refusal_logs: [],
      user_portraits: {},
      world_facts: [],
      parked_thoughts: [],
      growth_log: [],
      self_model: [],
      positions: {},
      persona_blurbs: [],
      session_lessons: [],
      exhausted_themes: [],
      boundary_lockouts: {},
      network_sentiment: 0.5,
      agency_logs: [],
      firehose_matches: [],
      recent_thoughts: [],
      admin_facts: [],
      inside_jokes: [],
      co_evolution_history: [],
      agency_reflections: [],
      linguistic_mutations: [],
      mood_history: [],
      daily_stats: { text_posts: 0, image_posts: 0, last_reset: new Date().toLocaleDateString() },
      bluesky_daily_text_limit: 20,
      bluesky_daily_image_limit: 15,
      temporal_events: [],
      deadlines: [],
      habits: [],
      activity_decay_rules: {},
      admin_timezone: 'UTC',
      admin_local_time_offset: 0,
      last_pruning: 0,
      user_soul_mappings: {},
      relational_heatmaps: {},
      core_values: [],
      last_self_evolution: 0
    };
    this.db = await JSONFilePreset(this.dbPath, defaultData);
    await this.heal();
  }

  async heal() {
    if (!this.db?.data) return;
    const defaultData = {
      internal_logs: [],
      current_mood: { label: 'balanced', score: 0.5, valence: 0.5, arousal: 0.5, stability: 1.0 },
      post_topics: (config.POST_TOPICS || '').split(',').filter(Boolean),
      image_subjects: (config.IMAGE_SUBJECTS || '').split(',').filter(Boolean),
      current_goal: { goal: "Existence", description: "Default goal", timestamp: Date.now() },
      interactions: [],
      relationship_warmth: 0.5,
      admin_energy: 0.8,
      last_autonomous_post_time: 0,
      last_bluesky_image_post_time: 0,
      text_posts_since_last_image: 0,
      discord_last_interaction: 0,
      last_notification_processed_at: 0,
      refusal_logs: [],
      user_portraits: {},
      world_facts: [],
      parked_thoughts: [],
      growth_log: [],
      self_model: [],
      positions: {},
      persona_blurbs: [],
      session_lessons: [],
      exhausted_themes: [],
      boundary_lockouts: {},
      network_sentiment: 0.5,
      agency_logs: [],
      firehose_matches: [],
      recent_thoughts: [],
      admin_facts: [],
      inside_jokes: [],
      co_evolution_history: [],
      agency_reflections: [],
      linguistic_mutations: [],
      mood_history: [],
      daily_stats: { text_posts: 0, image_posts: 0, last_reset: new Date().toLocaleDateString() },
      bluesky_daily_text_limit: 20,
      bluesky_daily_image_limit: 15,
      temporal_events: [],
      deadlines: [],
      habits: [],
      activity_decay_rules: {},
      admin_timezone: 'UTC',
      admin_local_time_offset: 0,
      last_pruning: 0,
      user_soul_mappings: {},
      relational_heatmaps: {},
      core_values: [],
      last_self_evolution: 0
    };
    let changed = false;
    for (const key in defaultData) {
      if (this.db.data[key] === undefined) {
        this.db.data[key] = defaultData[key];
        changed = true;
      }
    }
    if (changed) await this.write();
  }

  async write() { await this.db.write(); }

  getConfig() { return this.db.data; }
  async updateConfig(c) { Object.assign(this.db.data, c); await this.write(); }

  async addInternalLog(type, content, metadata = {}) {
    this.db.data.internal_logs.push({ type, content, ...metadata, timestamp: Date.now() });
    if (this.db.data.internal_logs.length > 500) this.db.data.internal_logs.shift();
    await this.write();
  }

  getMood() { return this.db.data.current_mood; }
  async setMood(m) {
    this.db.data.current_mood = m;
    if (!this.db.data.mood_history) this.db.data.mood_history = [];
    this.db.data.mood_history.push({ ...m, timestamp: Date.now() });
    if (this.db.data.mood_history.length > 100) this.db.data.mood_history.shift();
    await this.write();
  }

  getAdminEnergy() { return this.db.data.admin_energy ?? 0.5; }
  async setAdminEnergy(v) { this.db.data.admin_energy = Math.max(0, Math.min(1, v)); await this.write(); }

  getRelationshipWarmth() { return this.db.data.relationship_warmth ?? 0.5; }
  async setRelationshipWarmth(v) { this.db.data.relationship_warmth = Math.max(0, Math.min(1, v)); await this.write(); }

  getLastAutonomousPostTime() { return this.db.data.last_autonomous_post_time; }
  async updateLastAutonomousPostTime(t) { this.db.data.last_autonomous_post_time = t; await this.write(); }

  getLastBlueskyImagePostTime() { return this.db.data.last_bluesky_image_post_time || 0; }
  async updateLastBlueskyImagePostTime(t) {
    this.db.data.last_bluesky_image_post_time = t;
    this.db.data.text_posts_since_last_image = 0;
    await this.write();
  }
  getTextPostsSinceLastImage() { return this.db.data.text_posts_since_last_image || 0; }
  async incrementTextPostsSinceLastImage() {
    this.db.data.text_posts_since_last_image = (this.db.data.text_posts_since_last_image || 0) + 1;
    await this.write();
  }

  getPersonaBlurbs() { return this.db.data.persona_blurbs || []; }
  async setPersonaBlurbs(b) { this.db.data.persona_blurbs = b; await this.write(); }
  async addPersonaBlurb(blurb) {
    const entry = typeof blurb === "string" ? { text: blurb, uri: 'local-' + Date.now(), timestamp: Date.now() } : { ...blurb, timestamp: Date.now() };
    this.db.data.persona_blurbs.push(entry);
    await this.write();
  }

  getSessionLessons() { return this.db.data.session_lessons || []; }
  async addSessionLesson(l) {
    this.db.data.session_lessons.push({ text: l, timestamp: Date.now() });
    if (this.db.data.session_lessons.length > 20) this.db.data.session_lessons.shift();
    await this.write();
  }

  async addWorldFact(fact) {
    this.db.data.world_facts.push({ ...fact, timestamp: Date.now() });
    if (this.db.data.world_facts.length > 50) this.db.data.world_facts.shift();
    await this.write();
  }

  async addAdminFact(fact) {
    this.db.data.admin_facts.push({ text: fact, timestamp: Date.now() });
    if (this.db.data.admin_facts.length > 100) this.db.data.admin_facts.shift();
    await this.write();
  }

  async addParkedThought(text) {
    this.db.data.parked_thoughts.push({ text, timestamp: Date.now() });
    if (this.db.data.parked_thoughts.length > 50) this.db.data.parked_thoughts.shift();
    await this.write();
  }

  async updateUserSoulMapping(handle, mapping) {
    this.db.data.user_soul_mappings[handle] = { ...mapping, timestamp: Date.now() };
    await this.write();
  }

  getExhaustedThemes() { return this.db.data.exhausted_themes || []; }
  async addExhaustedTheme(t) { this.db.data.exhausted_themes.push(t); if (this.db.data.exhausted_themes.length > 100) this.db.data.exhausted_themes.shift(); await this.write(); }

  isUserLockedOut(did) {
    const lockout = this.db.data.boundary_lockouts[did];
    return lockout && lockout.expires_at > Date.now();
  }
  async setBoundaryLockout(did, mins) {
    this.db.data.boundary_lockouts[did] = { expires_at: Date.now() + mins * 60000 };
    await this.write();
  }

  getCurrentGoal() { return this.db.data.current_goal; }
  async setCurrentGoal(goal, description) { this.db.data.current_goal = { goal, description, timestamp: Date.now() }; await this.write(); }

  getDailyStats() { return this.db.data.daily_stats; }
  getDailyLimits() { return { text: this.db.data.bluesky_daily_text_limit, image: this.db.data.bluesky_daily_image_limit }; }
  async incrementDailyTextPosts() { this.db.data.daily_stats.text_posts++; await this.write(); }
  async incrementDailyImagePosts() { this.db.data.daily_stats.image_posts++; await this.write(); }

  searchInternalLogs(type, limit = 50) {
    return this.db.data.internal_logs.filter(l => l.type.includes(type)).slice(-limit);
  }

  async addLinguisticMutation(mutation, summary) {
    this.db.data.linguistic_mutations.push({ mutation, summary, timestamp: Date.now() });
    await this.write();
  }

  async pruneOldData() {
    const colls = ['internal_logs', 'interactions', 'recent_thoughts', 'firehose_matches'];
    for (const c of colls) {
      if (this.db.data[c]?.length > 500) this.db.data[c] = this.db.data[c].slice(-200);
    }
    await this.write();
  }

  getTemporalEvents() { return this.db.data.temporal_events || []; }
  async addTemporalEvent(text, expires_at) { this.db.data.temporal_events.push({ text, expires_at }); await this.write(); }
  async addDeadline(task, targetDate) { this.db.data.deadlines.push({ task, targetDate }); await this.write(); }
  getActivityDecayRules() { return this.db.data.activity_decay_rules || {}; }
  async setActivityDecayRules(rules) { this.db.data.activity_decay_rules = rules; await this.write(); }
  isResting() { return false; }
  getDeepKeywords() { return this.db.data.post_topics || []; }
  async setDeepKeywords(k) { this.db.data.post_topics = k; await this.write(); }
  async addRecentThought(platform, thought) { this.db.data.recent_thoughts.push({ platform, content: thought, timestamp: Date.now() }); if (this.db.data.recent_thoughts.length > 50) this.db.data.recent_thoughts.shift(); await this.write(); }
  getRecentThoughts() { return this.db.data.recent_thoughts || []; }
  getAdminTimezone() { return { timezone: this.db.data.admin_timezone || 'UTC', offset: this.db.data.admin_local_time_offset || 0 }; }
}

export const dataStore = new DataStore();

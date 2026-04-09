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
      internal_logs: [],
      current_mood: { label: 'balanced', score: 0.5 },
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
      user_soul_mappings: {},
      world_facts: [],
      admin_facts: [],
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
      post_continuations: [],
      linguistic_mutations: [],
      temporal_events: [],
      deadlines: [],
      habits: [],
      activity_decay_rules: {},
      social_resonance: {},
      life_arcs: [],
      admin_home_mentioned_at: 0,
      admin_work_mentioned_at: 0,
      mood_history: [],
      relational_metrics: { trust: 0.5, intimacy: 0.5, friction: 0, season: 'spring' },
      inside_jokes: [],
      co_evolution_history: [],
      discord_scheduled_tasks: [],
      scheduled_posts: [],
      admin_interests: {},
      relational_reflections: [],
      strong_relationship: false,
      curiosity_reservoir: [],
      persona_advice: [],
      admin_did: null,
      admin_bluesky_usage: {},
      daily_stats: { text_posts: 0, image_posts: 0, last_reset: Date.now() },
      bluesky_daily_text_limit: 10,
      bluesky_daily_image_limit: 3
    };
    this.db = await JSONFilePreset(this.dbPath, defaultData);
    await this.heal();
  }

  async heal() {
    const defaultData = {
      internal_logs: [],
      current_mood: { label: 'balanced', score: 0.5 },
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
      user_soul_mappings: {},
      world_facts: [],
      admin_facts: [],
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
      post_continuations: [],
      linguistic_mutations: [],
      temporal_events: [],
      deadlines: [],
      habits: [],
      activity_decay_rules: {},
      social_resonance: {},
      life_arcs: [],
      admin_home_mentioned_at: 0,
      admin_work_mentioned_at: 0,
      mood_history: [],
      relational_metrics: { trust: 0.5, intimacy: 0.5, friction: 0, season: 'spring' },
      inside_jokes: [],
      co_evolution_history: [],
      discord_scheduled_tasks: [],
      scheduled_posts: [],
      admin_interests: {},
      relational_reflections: [],
      strong_relationship: false,
      curiosity_reservoir: [],
      persona_advice: [],
      admin_did: null,
      admin_bluesky_usage: {},
      daily_stats: { text_posts: 0, image_posts: 0, last_reset: Date.now() },
      bluesky_daily_text_limit: 10,
      bluesky_daily_image_limit: 3
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
  async update(fn) { fn(this.db.data); await this.write(); }
  getConfig() { return this.db.data; }
  async updateConfig(c) { Object.assign(this.db.data, c); await this.write(); }
  async addInternalLog(type, content, metadata = {}) {
    this.db.data.internal_logs.push({ type, content, ...metadata, timestamp: Date.now() });
    if (this.db.data.internal_logs.length > 500) this.db.data.internal_logs.shift();
    await this.write();
  }
  getInternalLogs() { return this.db.data.internal_logs || []; }
  getMood() { return this.db.data.current_mood; }
  async setMood(m) {
    this.db.data.current_mood = m;
    if (!this.db.data.mood_history) this.db.data.mood_history = [];
    this.db.data.mood_history.push({ ...m, timestamp: Date.now() });
    if (this.db.data.mood_history.length > 100) this.db.data.mood_history.shift();
    await this.write();
  }
  getAdminEnergy() { return this.db.data.admin_energy ?? 0.8; }
  async setAdminEnergy(v) { this.db.data.admin_energy = Math.max(0, Math.min(1, v)); await this.write(); }
  getRelationshipWarmth() { return this.db.data.relationship_warmth ?? 0.5; }
  async setRelationshipWarmth(v) { this.db.data.relationship_warmth = Math.max(0, Math.min(1, v)); await this.write(); }
  getLastAutonomousPostTime() { return this.db.data.last_autonomous_post_time; }
  async updateLastAutonomousPostTime(t) { this.db.data.last_autonomous_post_time = t; await this.write(); }
  getLastBlueskyImagePostTime() { return this.db.data.last_bluesky_image_post_time || 0; }
  async updateLastBlueskyImagePostTime(t) { this.db.data.last_bluesky_image_post_time = t; this.db.data.text_posts_since_last_image = 0; await this.write(); }
  getTextPostsSinceLastImage() { return this.db.data.text_posts_since_last_image || 0; }
  async incrementTextPostsSinceLastImage() { this.db.data.text_posts_since_last_image = (this.db.data.text_posts_since_last_image || 0) + 1; await this.write(); }
  getPersonaBlurbs() { return this.db.data.persona_blurbs || []; }
  async setPersonaBlurbs(b) { this.db.data.persona_blurbs = b; await this.write(); }
  async addPersonaBlurb(blurb) {
    const entry = typeof blurb === "string" ? { text: blurb, uri: 'local-' + Date.now(), timestamp: Date.now() } : { ...blurb, timestamp: Date.now() };
    this.db.data.persona_blurbs.push(entry);
    await this.write();
  }
  async addPersonaUpdate(u) { this.db.data.persona_blurbs.push({ text: u, timestamp: Date.now() }); await this.write(); }
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
  getAdminFacts() { return this.db.data.admin_facts || []; }
  async addParkedThought(text) {
    this.db.data.parked_thoughts.push({ text, timestamp: Date.now() });
    if (this.db.data.parked_thoughts.length > 50) this.db.data.parked_thoughts.shift();
    await this.write();
  }
  async updateUserSoulMapping(handle, mapping) { this.db.data.user_soul_mappings[handle] = { ...mapping, timestamp: Date.now() }; await this.write(); }
  getExhaustedThemes() { return this.db.data.exhausted_themes || []; }
  async addExhaustedTheme(t) { this.db.data.exhausted_themes.push(t); if (this.db.data.exhausted_themes.length > 100) this.db.data.exhausted_themes.shift(); await this.write(); }
  isUserLockedOut(did) { const lockout = this.db.data.boundary_lockouts[did]; return lockout && lockout.expires_at > Date.now(); }
  async setBoundaryLockout(did, mins) { this.db.data.boundary_lockouts[did] = { expires_at: Date.now() + mins * 60000 }; await this.write(); }
  getCurrentGoal() { return this.db.data.current_goal; }
  async setCurrentGoal(goal, description) { this.db.data.current_goal = { goal, description, timestamp: Date.now() }; await this.write(); }
  getDailyStats() { return this.db.data.daily_stats; }
  getDailyLimits() { return { text: this.db.data.bluesky_daily_text_limit, image: this.db.data.bluesky_daily_image_limit }; }
  async incrementDailyTextPosts() { this.db.data.daily_stats.text_posts++; await this.write(); }
  async incrementDailyImagePosts() { this.db.data.daily_stats.image_posts++; await this.write(); }
  searchInternalLogs(type, limit = 50) { return (this.db.data.internal_logs || []).filter(l => l.type && l.type.includes(type)).slice(-limit); }
  async addLinguisticMutation(mutation, summary) { this.db.data.linguistic_mutations.push({ mutation, summary, timestamp: Date.now() }); await this.write(); }
  async pruneOldData() {
    const colls = ['internal_logs', 'interactions', 'recent_thoughts', 'firehose_matches'];
    for (const c of colls) if (this.db.data[c]?.length > 500) this.db.data[c] = this.db.data[c].slice(-200);
    this.db.data.last_pruning = Date.now(); await this.write();
  }
  getTemporalEvents() { return this.db.data.temporal_events || []; }
  async addTemporalEvent(text, expires_at) { this.db.data.temporal_events.push({ text, expires_at }); await this.write(); }
  getDeadlines() { return this.db.data.deadlines || []; }
  getHabits() { return this.db.data.habits || []; }
  async addDeadline(task, targetDate) { this.db.data.deadlines.push({ task, targetDate }); await this.write(); }
  async addHabit(pattern) {
      const existing = (this.db.data.habits || []).find(h => h.pattern === pattern);
      if (existing) { existing.frequency++; existing.last_seen = Date.now(); }
      else { if (!this.db.data.habits) this.db.data.habits = []; this.db.data.habits.push({ pattern, frequency: 1, last_seen: Date.now() }); }
      await this.write();
  }
  getActivityDecayRules() { return this.db.data.activity_decay_rules || {}; }
  async setActivityDecayRules(rules) { this.db.data.activity_decay_rules = rules; await this.write(); }
  isResting() { return false; }
  getDeepKeywords() { return this.db.data.post_topics || []; }
  async setDeepKeywords(k) { this.db.data.post_topics = k; await this.write(); }
  async addRecentThought(platform, thought) { this.db.data.recent_thoughts.push({ platform, content: thought, timestamp: Date.now() }); if (this.db.data.recent_thoughts.length > 50) this.db.data.recent_thoughts.shift(); await this.write(); }
  getRecentThoughts() { return this.db.data.recent_thoughts || []; }
  getAdminTimezone() { return { timezone: this.db.data.admin_timezone || 'UTC', offset: this.db.data.admin_local_time_offset || 0 }; }
  getRecentInteractions(platform = null, limit = 20) {
    let filtered = this.db.data.interactions || [];
    if (platform) filtered = filtered.filter(i => i.platform === platform);
    return filtered.slice(-limit);
  }
  getFirehoseMatches(limit = 30) { return (this.db.data.firehose_matches || []).slice(-limit); }
  getNetworkSentiment() { return this.db.data.network_sentiment ?? 0.5; }
  async setNetworkSentiment(s) { this.db.data.network_sentiment = s; await this.write(); }
  async updateSocialResonance(topic, value) { if (!this.db.data.social_resonance) this.db.data.social_resonance = {}; this.db.data.social_resonance[topic] = value; await this.write(); }
  async saveDiscordInteraction(channelId, role, content) {
      if (!this.db.data.interactions) this.db.data.interactions = [];
      this.db.data.interactions.push({ platform: 'discord', channelId, role, content, timestamp: Date.now() });
      this.db.data.discord_last_interaction = Date.now();
      await this.write();
  }
  getRelationalMetrics() { return this.db.data.relational_metrics || {}; }
  async updateRelationalMetrics(m) { Object.assign(this.db.data.relational_metrics, m); await this.write(); }
  getLifeArcs() { return this.db.data.life_arcs || []; }
  async updateLifeArc(adminId, arc, status) {
      const existing = (this.db.data.life_arcs || []).find(a => a.arc === arc);
      if (existing) existing.status = status;
      else { if (!this.db.data.life_arcs) this.db.data.life_arcs = []; this.db.data.life_arcs.push({ arc, status }); }
      await this.write();
  }
  getInsideJokes() { return this.db.data.inside_jokes || []; }
  async addInsideJoke(adminId, joke, context) { this.db.data.inside_jokes.push({ joke, context, timestamp: Date.now() }); await this.write(); }
  async addCoEvolutionEntry(note) { this.db.data.co_evolution_history.push({ note, timestamp: Date.now() }); await this.write(); }
  async setAdminHomeMentionedAt(t) { this.db.data.admin_home_mentioned_at = t; await this.write(); }
  async setAdminWorkMentionedAt(t) { this.db.data.admin_work_mentioned_at = t; await this.write(); }
  getRelationalDebtScore() { return this.db.data.relational_debt_score ?? 0; }
  getPredictiveEmpathyMode() { return this.db.data.predictive_empathy_mode ?? 'neutral'; }
  async setPredictiveEmpathyMode(m) { this.db.data.predictive_empathy_mode = m; await this.write(); }
  getDiscordScheduledTasks() { return this.db.data.discord_scheduled_tasks || []; }
  async removeDiscordScheduledTask(index) { if (index >= 0 && index < this.db.data.discord_scheduled_tasks.length) { this.db.data.discord_scheduled_tasks.splice(index, 1); await this.write(); } }
  getScheduledPosts() { return this.db.data.scheduled_posts || []; }
  async removeScheduledPost(index) { if (index >= 0 && index < this.db.data.scheduled_posts.length) { this.db.data.scheduled_posts.splice(index, 1); await this.write(); } }
  getAdminInterests() { return this.db.data.admin_interests || {}; }
  async updateAdminInterests(i) { Object.assign(this.db.data.admin_interests, i); await this.write(); }
  async updateRelationshipSeason(s) { if (!this.db.data.relational_metrics) this.db.data.relational_metrics = {}; this.db.data.relational_metrics.season = s; await this.write(); }
  async addRelationalReflection(r) { this.db.data.relational_reflections.push({ text: r, timestamp: Date.now() }); await this.write(); }
  async setStrongRelationship(v) { this.db.data.strong_relationship = v; await this.write(); }
  async updateCuriosityReservoir(q) { this.db.data.curiosity_reservoir = q; await this.write(); }
  getAdminDid() { return this.db.data.admin_did; }
  async setAdminDid(d) { this.db.data.admin_did = d; await this.write(); }
  getAgencyLogs() { return this.db.data.agency_logs || []; }
  async addPersonaAdvice(a) { this.db.data.persona_advice.push({ text: a, timestamp: Date.now() }); await this.write(); }
  isPining() { return !!this.db.data.internal_logs?.find(l => l.type === "pining"); }
  async getAdminExhaustion() { return this.db.data.relational_metrics?.exhaustion || 0; }
  getDiscordRelationshipMode() { return this.db.data.relational_metrics?.mode || "companion"; }
  getPostContinuations() { return this.db.data.post_continuations || []; }
  async addPostContinuation(c) { this.db.data.post_continuations.push({ ...c, scheduled_at: c.scheduled_at || Date.now() }); await this.write(); }
  async removePostContinuation(index) { if (index >= 0 && index < this.db.data.post_continuations.length) { this.db.data.post_continuations.splice(index, 1); await this.write(); } }
  getRefusalCounts() { return { total: (this.db.data.refusal_logs || []).length }; }
  getDiscordConversation(channelId) { return (this.db.data.interactions || []).filter(i => i.platform === "discord" && i.channelId === channelId); }
  getLastDiscordGiftTime() { return this.db.data.last_discord_gift_time || 0; }
}

export const dataStore = new DataStore();

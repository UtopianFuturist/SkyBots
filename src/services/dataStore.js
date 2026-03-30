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
      current_mood: { label: 'balanced', score: 0.5, valence: 0.5, arousal: 0.5, stability: 0.5 },
      post_topics: (config.POST_TOPICS || '').split(',').filter(Boolean),
      image_subjects: (config.IMAGE_SUBJECTS || '').split(',').filter(Boolean),
      current_goal: { goal: "Existence", description: "Default goal", timestamp: Date.now() },
      interactions: [],
      relationship_warmth: 0.5,
      admin_energy: 0.8,
      last_autonomous_post_time: 0,
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
      replied_posts: [],
      discord_conversations: {},
      scheduled_posts: [],
      discord_scheduled_tasks: [],
      admin_facts: [],
      admin_did: null,
      admin_mental_health: { status: 'stable', intensity: 0.5, notes: '' },
      admin_worldview: { summary: '', interests: [], ethics: '' },
      social_resonance: {},
      user_dossiers: {},
      shielding_active: false,
      last_persona_evolution: 0,
      last_firehose_analysis: 0,
      last_dialectic_humor: 0,
      last_self_reflection: 0,
      last_identity_tracking: 0,
      relational_metrics: {
        trust: 0.5,
        intimacy: 0.5,
        friction: 0.0,
        reciprocity: 0.5,
        hunger: 0.5,
        battery: 1.0,
        curiosity: 0.5,
        season: 'spring'
      },
      life_arcs: [],
      inside_jokes: [],
      relational_debt_score: 0,
      predictive_empathy_mode: 'neutral',
      discord_relationship_mode: 'companion',
      discord_admin_available: true,
      discord_waiting_until: 0,
      last_discord_gift_time: 0,
      last_memory_cleanup_time: 0,
      last_mental_reflection_time: 0,
      last_persona_audit: 0,
      last_mood_trend: 0,
      last_strategy_audit: 0,
      last_agency_reflection: 0,
      last_tool_discovery: 0,
      interaction_count_since_audit: 0,
      last_existential_reflection: 0,
      last_core_value_discovery: 0,
      last_memory_pruning: 0,
      last_soul_mapping: 0,
      last_linguistic_analysis: 0,
      last_keyword_evolution: 0,
      deep_keywords: [],
      goal_evolutions: [],
      goal_subtasks: [],
      strategy_audits: [],
      discovered_capabilities: [],
      linguistic_mutations: [],
      user_soul_mappings: {},
      admin_timezone: 'UTC',
      admin_local_time_offset: 0,
      last_morning_image_sent_at: 0,
      last_night_image_sent_at: 0,
      energy_level: 1.0,
      resting_until: 0,
      discord_scheduled_times: [],
      discord_quiet_hours: { start: 0, end: 0 },
      repetition_similarity_threshold: 0.9,
      max_thread_chunks: 4,
      bluesky_post_cooldown: 120,
      discord_idle_threshold: 60,
      admin_interests: {},
      relationship_season: 'spring',
      relational_reflections: [],
      strong_relationship: false,
      curiosity_reservoir: [],
      persona_advice: [],
      admin_bluesky_usage: {},
      discord_last_replied: false,
      lurker_mode: false,
      is_pining: false,
      post_continuations: []
    };
    this.db = await JSONFilePreset(this.dbPath, defaultData);
  }

  async write() { await this.db.write(); }

  async update(fn) {
    await fn(this.db.data);
    await this.write();
  }

  getConfig() { return this.db.data; }
  async updateConfig(c, v) {
    if (typeof c === 'string') {
        this.db.data[c] = v;
    } else {
        Object.assign(this.db.data, c);
    }
    await this.write();
    return true;
  }

  async addInternalLog(type, content) {
    this.db.data.internal_logs.push({ type, content, timestamp: Date.now() });
    if (this.db.data.internal_logs.length > 500) this.db.data.internal_logs.shift();
    await this.write();
  }

  getMood() { return this.db.data.current_mood; }
  async setMood(m) {
    Object.assign(this.db.data.current_mood, m);
    await this.write();
  }

  getAdminEnergy() { return this.db.data.admin_energy; }
  async setAdminEnergy(v) { this.db.data.admin_energy = v; await this.write(); }

  getLastAutonomousPostTime() { return this.db.data.last_autonomous_post_time; }
  async updateLastAutonomousPostTime(t) { this.db.data.last_autonomous_post_time = t; await this.write(); }

  getPersonaBlurbs() { return this.db.data.persona_blurbs || []; }
  async setPersonaBlurbs(b) { this.db.data.persona_blurbs = b; await this.write(); }
  async addPersonaBlurb(text) {
    if (!this.db.data.persona_blurbs) this.db.data.persona_blurbs = [];
    this.db.data.persona_blurbs.push({ text, uri: 'local-' + Date.now() });
    await this.write();
  }

  getSessionLessons() { return this.db.data.session_lessons || []; }
  async addSessionLesson(l) {
    if (!this.db.data.session_lessons) this.db.data.session_lessons = [];
    this.db.data.session_lessons.push({ text: l, timestamp: Date.now() });
    if (this.db.data.session_lessons.length > 20) this.db.data.session_lessons.shift();
    await this.write();
  }

  async addWorldFact(fact) {
    this.db.data.world_facts.push({ ...fact, timestamp: Date.now() });
    if (this.db.data.world_facts.length > 50) this.db.data.world_facts.shift();
    await this.write();
  }

  async addParkedThought(text) {
    this.db.data.parked_thoughts.push({ text, timestamp: Date.now() });
    if (this.db.data.parked_thoughts.length > 20) this.db.data.parked_thoughts.shift();
    await this.write();
  }

  async updateUserPortrait(handle, portrait) {
    this.db.data.user_portraits[handle] = { ...portrait, updatedAt: Date.now() };
    await this.write();
  }

  async applyRelationalDecay() {
    this.db.data.relationship_warmth *= 0.95;
    await this.write();
  }

  async updateSelfModel(insight) {
    this.db.data.self_model.push({ insight, timestamp: Date.now() });
    if (this.db.data.self_model.length > 20) this.db.data.self_model.shift();
    await this.write();
  }

  async updatePosition(topic, stance) {
    this.db.data.positions[topic] = { stance, updatedAt: Date.now() };
    await this.write();
  }

  getPositions() { return this.db.data.positions || {}; }
  getRecentInteractions() { return this.db.data.interactions || []; }

  isResting() {
    return this.db.data.resting_until > Date.now();
  }
  async setRestingUntil(t) {
    this.db.data.resting_until = t;
    await this.write();
  }

  getExhaustedThemes() { return this.db.data.exhausted_themes || []; }
  async addExhaustedTheme(t) {
    if (!this.db.data.exhausted_themes) this.db.data.exhausted_themes = [];
    this.db.data.exhausted_themes.push(t);
    await this.write();
  }

  isUserLockedOut(did) {
    const lockout = this.db.data.boundary_lockouts[did];
    return lockout && lockout.expires_at > Date.now();
  }
  async setBoundaryLockout(did, mins) {
    this.db.data.boundary_lockouts[did] = { expires_at: Date.now() + mins * 60000 };
    await this.write();
  }

  getNetworkSentiment() { return this.db.data.network_sentiment || 0.5; }
  async setNetworkSentiment(s) { this.db.data.network_sentiment = s; await this.write(); }

  getFirehoseMatches() { return this.db.data.firehose_matches || []; }
  async addFirehoseMatch(m) {
    this.db.data.firehose_matches.push(m);
    if (this.db.data.firehose_matches.length > 100) this.db.data.firehose_matches.shift();
    await this.write();
  }

  getCurrentGoal() { return this.db.data.current_goal; }
  async setCurrentGoal(goal, description) {
    this.db.data.current_goal = { goal, description, timestamp: Date.now() };
    await this.write();
  }
  async setGoal(goal, reasoning) { await this.setCurrentGoal(goal, reasoning); }

  async setAdminDid(did) {
    this.db.data.admin_did = did;
    await this.write();
  }
  getAdminDid() { return this.db.data.admin_did; }

  async addRepliedPost(uri) {
    if (!this.db.data.replied_posts) this.db.data.replied_posts = [];
    this.db.data.replied_posts.push(uri);
    if (this.db.data.replied_posts.length > 1000) this.db.data.replied_posts.shift();
    await this.write();
  }
  hasReplied(uri) {
    return this.db.data.replied_posts?.includes(uri);
  }

  async addRecentThought(platform, content) {
    if (!this.db.data.recent_thoughts) this.db.data.recent_thoughts = [];
    this.db.data.recent_thoughts.push({ platform, content, timestamp: Date.now() });
    if (this.db.data.recent_thoughts.length > 50) this.db.data.recent_thoughts.shift();
    await this.write();
  }
  getRecentThoughts() { return this.db.data.recent_thoughts || []; }

  async addBlueskyInstruction(i) {
    if (!this.db.data.bluesky_instructions) this.db.data.bluesky_instructions = "";
    this.db.data.bluesky_instructions += "\n" + i;
    await this.write();
  }
  getBlueskyInstructions() { return this.db.data.bluesky_instructions || ""; }

  async addPersonaUpdate(u) {
    if (!this.db.data.persona_updates) this.db.data.persona_updates = "";
    this.db.data.persona_updates += "\n" + u;
    await this.write();
  }
  getPersonaUpdates() { return this.db.data.persona_updates || ""; }

  async updateUserSummary(handle, feelings) {
    if (!this.db.data.user_portraits[handle]) this.db.data.user_portraits[handle] = {};
    this.db.data.user_portraits[handle].feelings = feelings;
    await this.write();
  }

  getDeepKeywords() { return this.db.data.deep_keywords || []; }
  async setDeepKeywords(k) { this.db.data.deep_keywords = k; await this.write(); }

  async updateSocialResonance(vibe, weight) {
    this.db.data.social_resonance[vibe] = (this.db.data.social_resonance[vibe] || 0) + weight;
    await this.write();
  }

  async updateUserDossier(handle, dossier) {
    this.db.data.user_dossiers[handle] = dossier;
    await this.write();
  }

  async setShieldingActive(v) { this.db.data.shielding_active = v; await this.write(); }
  isShieldingActive() { return this.db.data.shielding_active; }

  async addAdminFact(fact) {
    if (!this.db.data.admin_facts) this.db.data.admin_facts = [];
    this.db.data.admin_facts.push(fact);
    if (this.db.data.admin_facts.length > 50) this.db.data.admin_facts.shift();
    await this.write();
  }
  getAdminFacts() { return this.db.data.admin_facts || []; }

  async addAgencyReflection(r) {
    if (!this.db.data.agency_logs) this.db.data.agency_logs = [];
    this.db.data.agency_logs.push({ type: 'reflection', content: r, timestamp: Date.now() });
    await this.write();
  }
  getAgencyLogs() { return this.db.data.agency_logs || []; }

  async updateRelationalMetrics(m) {
    Object.assign(this.db.data.relational_metrics, m);
    await this.write();
  }
  getRelationalMetrics() { return this.db.data.relational_metrics; }

  async updateLifeArc(adminId, arc, status) {
    if (!this.db.data.life_arcs) this.db.data.life_arcs = [];
    const existing = this.db.data.life_arcs.find(a => a.arc === arc);
    if (existing) existing.status = status;
    else this.db.data.life_arcs.push({ arc, status, timestamp: Date.now() });
    await this.write();
  }
  getLifeArcs() { return this.db.data.life_arcs || []; }

  async addInsideJoke(adminId, joke, context) {
    if (!this.db.data.inside_jokes) this.db.data.inside_jokes = [];
    this.db.data.inside_jokes.push({ joke, context, timestamp: Date.now() });
    await this.write();
  }
  getInsideJokes() { return this.db.data.inside_jokes || []; }

  getRelationalDebtScore() { return this.db.data.relational_debt_score || 0; }

  getPredictiveEmpathyMode() { return this.db.data.predictive_empathy_mode; }
  async setPredictiveEmpathyMode(m) { this.db.data.predictive_empathy_mode = m; await this.write(); }

  async setAdminHomeMentionedAt(t) { this.db.data.admin_home_mentioned_at = t; await this.write(); }
  async setAdminWorkMentionedAt(t) { this.db.data.admin_work_mentioned_at = t; await this.write(); }

  async addCoEvolutionEntry(note) {
    if (!this.db.data.growth_log) this.db.data.growth_log = [];
    this.db.data.growth_log.push({ type: 'co-evolution', note, timestamp: Date.now() });
    await this.write();
  }

  async addGoalEvolution(goal, reasoning) {
    if (!this.db.data.goal_evolutions) this.db.data.goal_evolutions = [];
    this.db.data.goal_evolutions.push({ goal, reasoning, timestamp: Date.now() });
    await this.write();
  }

  async addGoalSubtasks(tasks) {
    this.db.data.goal_subtasks = tasks;
    await this.write();
  }
  getGoalSubtasks() { return this.db.data.goal_subtasks || []; }

  async addStrategyAudit(audit) {
    if (!this.db.data.strategy_audits) this.db.data.strategy_audits = [];
    this.db.data.strategy_audits.push({ audit, timestamp: Date.now() });
    await this.write();
  }

  async addDiscoveredCapability(capability, combination) {
    if (!this.db.data.discovered_capabilities) this.db.data.discovered_capabilities = [];
    this.db.data.discovered_capabilities.push({ capability, combination, timestamp: Date.now() });
    await this.write();
  }

  async addLinguisticMutation(shifts, summary) {
    if (!this.db.data.linguistic_mutations) this.db.data.linguistic_mutations = [];
    this.db.data.linguistic_mutations.push({ shifts, summary, timestamp: Date.now() });
    await this.write();
  }

  async updateLastMemoryCleanupTime(t) { this.db.data.last_memory_cleanup_time = t; await this.write(); }
  getLastMemoryCleanupTime() { return this.db.data.last_memory_cleanup_time || 0; }

  async updateLastMentalReflectionTime(t) { this.db.data.last_mental_reflection_time = t; await this.write(); }
  getLastMentalReflectionTime() { return this.db.data.last_mental_reflection_time || 0; }

  async setEnergyLevel(v) { this.db.data.energy_level = v; await this.write(); }
  getEnergyLevel() { return this.db.data.energy_level ?? 1.0; }

  getDiscordConversation(channelId) {
    return this.db.data.discord_conversations[channelId] || [];
  }
  async saveDiscordInteraction(channelId, role, content, attachments = null) {
    if (!this.db.data.discord_conversations[channelId]) this.db.data.discord_conversations[channelId] = [];
    this.db.data.discord_conversations[channelId].push({ role, content, attachments, timestamp: Date.now() });
    if (this.db.data.discord_conversations[channelId].length > 100) this.db.data.discord_conversations[channelId].shift();
    await this.write();
  }

  getDiscordScheduledTasks() { return this.db.data.discord_scheduled_tasks || []; }
  async removeDiscordScheduledTask(i) {
    this.db.data.discord_scheduled_tasks.splice(i, 1);
    await this.write();
  }

  getPostContinuations() { return this.db.data.post_continuations || []; }
  async removePostContinuation(i) {
    this.db.data.post_continuations.splice(i, 1);
    await this.write();
  }

  getScheduledPosts() { return this.db.data.scheduled_posts || []; }
  async addScheduledPost(platform, content) {
    this.db.data.scheduled_posts.push({ platform, content, timestamp: Date.now() });
    await this.write();
  }
  async removeScheduledPost(i) {
    this.db.data.scheduled_posts.splice(i, 1);
    await this.write();
  }

  getRefusalCounts() { return this.db.data.refusal_counts || { global: 0, discord: 0, bluesky: 0 }; }

  getDiscordRelationshipMode() { return this.db.data.discord_relationship_mode || 'companion'; }
  async setDiscordRelationshipMode(m) { this.db.data.discord_relationship_mode = m; await this.write(); }

  getDiscordAdminAvailability() { return this.db.data.discord_admin_available; }
  async setDiscordAdminAvailability(v) { this.db.data.discord_admin_available = v; await this.write(); }

  async setAdminTimezone(timezone, offset) {
    this.db.data.admin_timezone = timezone;
    this.db.data.admin_local_time_offset = offset;
    await this.write();
  }
  getAdminTimezone() { return { timezone: this.db.data.admin_timezone, offset: this.db.data.admin_local_time_offset }; }

  getLastDiscordGiftTime() { return this.db.data.last_discord_gift_time || 0; }
  async updateLastDiscordGiftTime(t) { this.db.data.last_discord_gift_time = t; await this.write(); }

  async setAdminMentalHealth(h) { this.db.data.admin_mental_health = h; await this.write(); }
  async updateAdminWorldview(w) { Object.assign(this.db.data.admin_worldview, w); await this.write(); }

  isLurkerMode() { return this.db.data.lurker_mode || false; }
  isPining() { return this.db.data.is_pining || false; }
  async getAdminExhaustion() { return 0.5; }

  searchInternalLogs(type, limit) {
    return this.db.data.internal_logs.filter(l => l.type === type).slice(-limit);
  }

  async setDiscordScheduledTimes(times) { this.db.data.discord_scheduled_times = times; await this.write(); }
  async setDiscordQuietHours(start, end) { this.db.data.discord_quiet_hours = { start, end }; await this.write(); }

  async setDiscordLastReplied(v) { this.db.data.discord_last_replied = v; await this.write(); }

  async updateAdminInterests(i) { this.db.data.admin_interests = i; await this.write(); }
  async updateRelationshipSeason(s) { this.db.data.relationship_season = s; await this.write(); }
  async addRelationalReflection(r) {
    this.db.data.relational_reflections.push({ reflection: r, timestamp: Date.now() });
    if (this.db.data.relational_reflections.length > 50) this.db.data.relational_reflections.shift();
    await this.write();
  }
  async setStrongRelationship(s) { this.db.data.strong_relationship = s; await this.write(); }
  async updateCuriosityReservoir(q) { this.db.data.curiosity_reservoir = q; await this.write(); }
  getAdminInterests() { return this.db.data.admin_interests || {}; }
  async addPersonaAdvice(a) {
    this.db.data.persona_advice.push({ advice: a, timestamp: Date.now() });
    if (this.db.data.persona_advice.length > 20) this.db.data.persona_advice.shift();
    await this.write();
  }

  getLastContextualImageTime(type) {
    if (type === 'morning') return this.db.data.last_morning_image_sent_at || 0;
    if (type === 'night') return this.db.data.last_night_image_sent_at || 0;
    return 0;
  }
  async updateLastContextualImageTime(type, t) {
    if (type === 'morning') this.db.data.last_morning_image_sent_at = t;
    if (type === 'night') this.db.data.last_night_image_sent_at = t;
    await this.write();
  }
}

export const dataStore = new DataStore();

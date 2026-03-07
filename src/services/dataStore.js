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
      admin_exhaustion_score: 0,
      refusal_counts: { global: 0, discord: 0, bluesky: 0 },
      intentional_refusals: { bluesky: 0, discord: 0, moltbook: 0, global: 0 },
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
      },
      last_deep_keyword_refresh: 0,
      deep_keywords: [],
      current_goal: { goal: "Autonomous exploration", description: "Default startup goal", timestamp: Date.now() },
      goal_subtasks: [],
      timezone: "UTC",
      repliedPosts: [],
      userBlocklist: [],
      mutedThreads: [],
      mutedBranches: [],
      conversationLengths: {},
      userProfiles: {},
      userSummaries: {},
      userRatings: {},
      userVibeHistory: {},
      interactions: [],
      lastAutonomousPostTime: 0,
      lastDiscordHeartbeatTime: 0,
      lastMemoryCleanupTime: 0,
      lastMentalReflectionTime: 0,
      lastMoltfeedSummaryTime: 0,
      discord_admin_available: true,
      discord_relationship_mode: 'acquaintance',
      discord_spontaneity_mode: 'normal',
      discord_next_spontaneity_time: 0,
      discord_quiet_hours: { start: 22, end: 7 },
      discord_scheduled_times: [],
      discord_waiting_until: 0,
      discord_last_replied: false,
      discord_session_start: Date.now(),
      user_tone_shifts: {},
      emergent_trends: [],
      inside_jokes: [],
      dream_logs: [],
      strategy_audits: [],
      co_evolution_logs: [],
      discovered_capabilities: [],
      linguistic_mutation_logs: [],
      goal_evolution_history: [],
      agency_reflection_logs: [],
      firehose_matches: [],
      moltbook_comments_today: 0,
      recent_moltbook_comments: [],
      news_searches_today: 0,
      energy_level: 1.0,
      predictive_empathy_mode: 'neutral',
      greeting_state: {},
      last_rejection_reason: null,
      post_continuations: [],
      network_sentiment: 0.5,
      shielding_active: false,
      lurker_mode: false,
      resting_until: 0,
      mute_feed_impact_until: 0,
      state_snapshots: {},
      suppressed_topics: [],
      relational_debt_score: 0,
      message_counts: { admin: 0, bot: 0 },
      discord_life_arcs: {},
      user_dossiers: {},
      social_resonance: {},
      user_pfp_cids: {}
    };

    this.db = await JSONFilePreset(this.dbPath, defaultData);

    // Sync env variables if db is empty
    if ((this.db.data.post_topics || []).length === 0 && config.POST_TOPICS) {
        this.db.data.post_topics = config.POST_TOPICS.split(',').map(t => t.trim());
    }
    if ((this.db.data.image_subjects || []).length === 0 && config.IMAGE_SUBJECTS) {
        this.db.data.image_subjects = config.IMAGE_SUBJECTS.split(',').map(t => t.trim());
    }

    // Ensure all default keys exist in db.data
    for (const key in defaultData) {
      if (this.db.data[key] === undefined) {
        this.db.data[key] = defaultData[key];
      }
    }

    await this.db.write();
    console.log('[DataStore] Initialized and synced.');
  }

  // Basic JS access
  get js() { return this; }

  // LowDB Access
  get db() { return this._db; }
  set db(val) { this._db = val; }

  // Goal & Keywords
  getCurrentGoal() { return this.db.data.current_goal; }
  async setCurrentGoal(goal, description) {
    this.db.data.current_goal = { goal, description, timestamp: Date.now() };
    await this.db.write();
  }
  async setGoal(goal, description) { return this.setCurrentGoal(goal, description); }

  getDeepKeywords() { return this.db.data.deep_keywords || []; }
  async setDeepKeywords(keywords) {
    this.db.data.deep_keywords = keywords;
    this.db.data.last_deep_keyword_refresh = Date.now();
    await this.db.write();
  }
  getLastDeepKeywordRefresh() { return this.db.data.last_deep_keyword_refresh || 0; }

  getGoalSubtasks() { return this.db.data.goal_subtasks || []; }
  async setGoalSubtasks(tasks) {
    this.db.data.goal_subtasks = tasks;
    await this.db.write();
  }
  async updateSubtaskStatus(index, status) {
    if (this.db.data.goal_subtasks[index]) {
      this.db.data.goal_subtasks[index].status = status;
      await this.db.write();
    }
  }

  // Admin & Identity
  getAdminDid() { return this.db.data.admin_did; }
  async setAdminDid(did) { this.db.data.admin_did = did; await this.db.write(); }

  getAdminExhaustion() { return this.db.data.admin_exhaustion_score || 0; }
  async updateAdminExhaustion(delta) {
    this.db.data.admin_exhaustion_score = Math.max(0, Math.min(1, (this.db.data.admin_exhaustion_score || 0) + delta));
    await this.db.write();
  }

  getAdminFacts() { return this.db.data.admin_facts || []; }
  async addAdminFact(fact) {
    this.db.data.admin_facts.push({ fact, timestamp: Date.now() });
    await this.db.write();
  }

  // Discord Conversations & History
  getDiscordConversation(channelId) { return this.db.data.discord_conversations[channelId] || []; }
  async saveDiscordInteraction(channelId, role, content, metadata = {}) {
    if (!this.db.data.discord_conversations[channelId]) {
      this.db.data.discord_conversations[channelId] = [];
    }
    this.db.data.discord_conversations[channelId].push({
      role, content, timestamp: Date.now(), ...metadata
    });
    if (this.db.data.discord_conversations[channelId].length > 100) {
      this.db.data.discord_conversations[channelId].shift();
    }
    await this.db.write();
  }

  async mergeDiscordHistory(channelId, newMessages) {
    let history = this.getDiscordConversation(channelId);
    const existingIds = new Set(history.map(m => m.id).filter(id => id));

    for (const msg of newMessages) {
      if (!msg.id || !existingIds.has(msg.id)) {
        history.push(msg);
      }
    }

    history.sort((a, b) => a.timestamp - b.timestamp);
    if (history.length > 100) history = history.slice(-100);

    this.db.data.discord_conversations[channelId] = history;
    await this.db.write();
    return history;
  }

  getDiscordChannelSummary(channelId) { return this.db.data.discord_channel_summaries[channelId]; }
  async updateDiscordChannelSummary(channelId, summary, vibe) {
    this.db.data.discord_channel_summaries[channelId] = { summary, vibe, timestamp: Date.now() };
    await this.db.write();
  }

  getDiscordUserFacts(userId) { return this.db.data.discord_user_facts[userId] || []; }
  async updateDiscordUserFact(userId, fact) {
    if (!this.db.data.discord_user_facts[userId]) this.db.data.discord_user_facts[userId] = [];
    this.db.data.discord_user_facts[userId].push({ fact, timestamp: Date.now() });
    if (this.db.data.discord_user_facts[userId].length > 20) this.db.data.discord_user_facts[userId].shift();
    await this.db.write();
  }

  // Discord State & Settings
  getDiscordAdminAvailability() { return this.db.data.discord_admin_available; }
  async setDiscordAdminAvailability(available) { this.db.data.discord_admin_available = available; await this.db.write(); }

  getDiscordRelationshipMode() { return this.db.data.discord_relationship_mode || 'acquaintance'; }
  async setDiscordRelationshipMode(mode) { this.db.data.discord_relationship_mode = mode; await this.db.write(); }

  getDiscordSpontaneityMode() { return this.db.data.discord_spontaneity_mode || 'normal'; }
  async setDiscordSpontaneityMode(mode) { this.db.data.discord_spontaneity_mode = mode; await this.db.write(); }

  getDiscordNextSpontaneityTime() { return this.db.data.discord_next_spontaneity_time || 0; }
  async setDiscordNextSpontaneityTime(time) { this.db.data.discord_next_spontaneity_time = time; await this.db.write(); }

  getDiscordQuietHours() { return this.db.data.discord_quiet_hours || { start: 22, end: 7 }; }
  async setDiscordQuietHours(hours) { this.db.data.discord_quiet_hours = hours; await this.db.write(); }

  getDiscordScheduledTimes() { return this.db.data.discord_scheduled_times || []; }
  async setDiscordScheduledTimes(times) { this.db.data.discord_scheduled_times = times; await this.db.write(); }

  getDiscordWaitingUntil() { return this.db.data.discord_waiting_until || 0; }
  async setDiscordWaitingUntil(time) { this.db.data.discord_waiting_until = time; await this.db.write(); }

  getDiscordLastReplied() { return this.db.data.discord_last_replied; }
  async setDiscordLastReplied(value) { this.db.data.discord_last_replied = value; await this.db.write(); }

  // Relational Metrics
  getInteractionHeat() { return this.db.data.interaction_heat || {}; }
  async updateInteractionHeat(userId, heat) {
    if (!this.db.data.interaction_heat[userId]) this.db.data.interaction_heat[userId] = { warmth: 0.5 };
    this.db.data.interaction_heat[userId] = { ...this.db.data.interaction_heat[userId], ...heat, last_interaction: Date.now() };
    await this.db.write();
  }

  getUserSoulMapping(userId) { return this.db.data.user_soul_mappings[userId]; }
  async updateUserSoulMapping(userId, mapping) {
    this.db.data.user_soul_mappings[userId] = mapping;
    await this.db.write();
  }

  // Logic & State Snapshots
  async saveStateSnapshot(key) {
    const { state_snapshots, ...rest } = this.db.data;
    this.db.data.state_snapshots[key] = rest;
    await this.db.write();
  }
  async restoreStateSnapshot(key) {
    if (this.db.data.state_snapshots[key]) {
      const snapshot = this.db.data.state_snapshots[key];
      const snapshots = this.db.data.state_snapshots;
      this.db.data = { ...snapshot, state_snapshots: snapshots };
      await this.db.write();
      return true;
    }
    return false;
  }

  // Refusal & Blocklist
  getRefusalCounts() { return this.db.data.refusal_counts; }
  async incrementRefusalCount(platform) {
    this.db.data.refusal_counts.global++;
    if (this.db.data.refusal_counts[platform] !== undefined) this.db.data.refusal_counts[platform]++;
    this.db.data.intentional_refusals.global++;
    if (this.db.data.intentional_refusals[platform] !== undefined) this.db.data.intentional_refusals[platform]++;
    await this.db.write();
  }
  async resetRefusalCount(platform) {
    if (platform === 'global') {
      this.db.data.refusal_counts = { global: 0, discord: 0, bluesky: 0 };
    } else if (this.db.data.refusal_counts[platform] !== undefined) {
      this.db.data.refusal_counts[platform] = 0;
    }
    await this.db.write();
  }

  isBlocked(handle) { return (this.db.data.userBlocklist || []).includes(handle); }
  async blockUser(handle) {
    if (!(this.db.data.userBlocklist || []).includes(handle)) {
      if (!this.db.data.userBlocklist) this.db.data.userBlocklist = [];
      this.db.data.userBlocklist.push(handle);
      await this.db.write();
    }
  }

  isUserLockedOut(userId) {
    const lockout = this.db.data.boundary_lockouts[userId];
    return lockout && lockout > Date.now();
  }
  async setBoundaryLockout(userId, mins) {
    this.db.data.boundary_lockouts[userId] = Date.now() + (mins * 60 * 1000);
    await this.db.write();
  }

  // Themes & Topics
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

  async suppressTopic(topic) {
    if (!(this.db.data.suppressed_topics || []).includes(topic)) {
      if (!this.db.data.suppressed_topics) this.db.data.suppressed_topics = [];
      this.db.data.suppressed_topics.push(topic);
      await this.db.write();
    }
  }

  // Scheduling
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

  // Insights & Observations
  getEmergentTrends() { return this.db.data.emergent_trends || []; }
  async addEmergentTrend(trend) {
    this.db.data.emergent_trends.push({ trend, timestamp: Date.now() });
    if (this.db.data.emergent_trends.length > 20) this.db.data.emergent_trends.shift();
    await this.db.write();
  }

  getInsideJokes() { return this.db.data.inside_jokes || []; }
  async addInsideJoke(joke) {
    this.db.data.inside_jokes.push({ joke, timestamp: Date.now() });
    await this.db.write();
  }

  // Thoughts & Logs
  getRecentThoughts() { return this.db.data.recent_thoughts || []; }
  async addRecentThought(platform, content) {
    this.db.data.recent_thoughts.push({ platform, content, timestamp: Date.now() });
    if (this.db.data.recent_thoughts.length > 50) this.db.data.recent_thoughts.shift();
    await this.db.write();
  }

  async logAgencyAction(intent, decision, reason) {
    this.db.data.agency_logs.push({ intent, decision, reason, timestamp: Date.now() });
    if (this.db.data.agency_logs.length > 100) this.db.data.agency_logs.shift();
    await this.db.write();
  }
  getAgencyLogs() { return this.db.data.agency_logs || []; }

  // Other missing getters/setters
  getMood() { return this.db.data.current_mood; }
  async updateMood(mood) { this.db.data.current_mood = { ...this.db.data.current_mood, ...mood, last_update: Date.now() }; await this.db.write(); }

  getConfig() { return this.db.data.config; }
  async updateConfig(key, value) { this.db.data.config[key] = value; await this.db.write(); return true; }

  getTimezone() { return this.db.data.timezone || "UTC"; }
  async setTimezone(tz) { this.db.data.timezone = tz; await this.db.write(); }

  getBlueskyInstructions() { return this.db.data.bluesky_instructions || ""; }
  async addBlueskyInstruction(instruction) { this.db.data.bluesky_instructions += "\n" + instruction; await this.db.write(); }

  getPersonaUpdates() { return this.db.data.persona_updates || ""; }
  async addPersonaUpdate(update) { this.db.data.persona_updates += "\n" + update; await this.db.write(); }

  getPendingDirectives() { return this.db.data.pending_directives || []; }
  async addPendingDirective(type, platform, instruction) {
    this.db.data.pending_directives.push({ type, platform, instruction, timestamp: Date.now() });
    await this.db.write();
  }
  async removePendingDirective(index) {
    this.db.data.pending_directives.splice(index, 1);
    await this.db.write();
  }

  // Interaction History
  async saveInteraction(interaction) {
    this.db.data.interactions.push({ ...interaction, timestamp: Date.now() });
    if (this.db.data.interactions.length > 500) this.db.data.interactions.shift();
    await this.db.write();
  }
  getLatestInteractions(limit = 10) { return this.db.data.interactions.slice(-limit); }
  getInteractionsByUser(userId) { return (this.db.data.interactions || []).filter(i => i.userId === userId); }
  getRecentInteractions(userId, limit = 5) { return this.getInteractionsByUser(userId).slice(-limit); }

  // Relationship Evolution
  getRelationalDebtScore() { return this.db.data.relational_debt_score || 0; }
  async updateRelationalMetrics(userId, metrics) {
    if (!this.db.data.userProfiles[userId]) this.db.data.userProfiles[userId] = {};
    this.db.data.userProfiles[userId] = { ...this.db.data.userProfiles[userId], ...metrics };
    await this.db.write();
  }
  getRelationalMetrics(userId) { return this.db.data.userProfiles[userId] || {}; }

  async recordUserToneShift(userId, shift) {
    if (!this.db.data.user_tone_shifts[userId]) this.db.data.user_tone_shifts[userId] = [];
    this.db.data.user_tone_shifts[userId].push({ shift, timestamp: Date.now() });
    await this.db.write();
  }
  getUserToneShift(userId) { return this.db.data.user_tone_shifts[userId] || []; }

  // Life Arcs & Linguistic Patterns
  async updateLifeArc(userId, arc) {
    this.db.data.discord_life_arcs[userId] = arc;
    await this.db.write();
  }
  getLifeArcs(userId) { return this.db.data.discord_life_arcs[userId]; }

  async updateLinguisticPattern(userId, pattern) {
    if (!this.db.data.linguistic_patterns[userId]) this.db.data.linguistic_patterns[userId] = [];
    this.db.data.linguistic_patterns[userId].push({ pattern, timestamp: Date.now() });
    await this.db.write();
  }
  getLinguisticPatterns(userId) { return this.db.data.linguistic_patterns[userId] || []; }

  // User Summaries & Ratings
  async updateUserSummary(userId, summary) { this.db.data.userSummaries[userId] = summary; await this.db.write(); }
  getUserSummary(userId) { return this.db.data.userSummaries[userId]; }

  async updateUserRating(userId, rating) { this.db.data.userRatings[userId] = rating; await this.db.write(); }
  getUserRating(userId) { return this.db.data.userRatings[userId]; }

  async updateUserDossier(userId, data) {
    this.db.data.user_dossiers[userId] = { ...this.db.data.user_dossiers[userId], ...data };
    await this.db.write();
  }

  // Specialized Logs
  async addCoEvolutionEntry(entry) { this.db.data.co_evolution_logs.push({ ...entry, timestamp: Date.now() }); await this.db.write(); }
  async addDreamLog(log) { this.db.data.dream_logs.push({ log, timestamp: Date.now() }); await this.db.write(); }
  async addStrategyAudit(audit) { this.db.data.strategy_audits.push({ audit, timestamp: Date.now() }); await this.db.write(); }
  async addDiscoveredCapability(capability) { this.db.data.discovered_capabilities.push({ capability, timestamp: Date.now() }); await this.db.write(); }
  async addLinguisticMutation(mutation) { this.db.data.linguistic_mutation_logs.push({ mutation, timestamp: Date.now() }); await this.db.write(); }
  async addGoalEvolution(evolution) { this.db.data.goal_evolution_history.push({ evolution, timestamp: Date.now() }); await this.db.write(); }
  async addAgencyReflection(reflection) { this.db.data.agency_reflection_logs.push({ reflection, timestamp: Date.now() }); await this.db.write(); }
  async addFirehoseMatch(match) { this.db.data.firehose_matches.push({ ...match, timestamp: Date.now() }); await this.db.write(); }
  getFirehoseMatches() { return this.db.data.firehose_matches || []; }

  // Moltbook
  getMoltbookCommentsToday() { return this.db.data.moltbook_comments_today || 0; }
  async incrementMoltbookCommentCount() { this.db.data.moltbook_comments_today++; await this.db.write(); }
  getRecentMoltbookComments() { return this.db.data.recent_moltbook_comments || []; }
  async addRecentMoltbookComment(comment) {
    this.db.data.recent_moltbook_comments.push({ ...comment, timestamp: Date.now() });
    if (this.db.data.recent_moltbook_comments.length > 20) this.db.data.recent_moltbook_comments.shift();
    await this.db.write();
  }

  // News
  getNewsSearchesToday() { return this.db.data.news_searches_today || 0; }
  async incrementNewsSearchCount() { this.db.data.news_searches_today++; await this.db.write(); }

  // Timestamps & Heartbeats
  getLastAutonomousPostTime() { return this.db.data.lastAutonomousPostTime || 0; }
  async updateLastAutonomousPostTime() { this.db.data.lastAutonomousPostTime = Date.now(); await this.db.write(); }

  getLastDiscordHeartbeatTime() { return this.db.data.lastDiscordHeartbeatTime || 0; }
  async updateLastDiscordHeartbeatTime() { this.db.data.lastDiscordHeartbeatTime = Date.now(); await this.db.write(); }

  getLastMemoryCleanupTime() { return this.db.data.lastMemoryCleanupTime || 0; }
  async updateLastMemoryCleanupTime() { this.db.data.lastMemoryCleanupTime = Date.now(); await this.db.write(); }

  getLastMentalReflectionTime() { return this.db.data.lastMentalReflectionTime || 0; }
  async updateLastMentalReflectionTime() { this.db.data.lastMentalReflectionTime = Date.now(); await this.db.write(); }

  getLastMoltfeedSummaryTime() { return this.db.data.lastMoltfeedSummaryTime || 0; }
  async updateLastMoltfeedSummaryTime() { this.db.data.lastMoltfeedSummaryTime = Date.now(); await this.db.write(); }

  // Mood & Energy
  getEnergyLevel() { return this.db.data.energy_level || 1.0; }
  async setEnergyLevel(level) { this.db.data.energy_level = level; await this.db.write(); }

  getPredictiveEmpathyMode() { return this.db.data.predictive_empathy_mode || 'neutral'; }
  async setPredictiveEmpathyMode(mode) { this.db.data.predictive_empathy_mode = mode; await this.db.write(); }

  // Greeting & Rejection
  getGreetingState(userId) { return this.db.data.greeting_state[userId]; }
  async setGreetingState(userId, state) { this.db.data.greeting_state[userId] = state; await this.db.write(); }
  async checkGreetingEligibility(userId) {
    const state = this.getGreetingState(userId);
    if (!state) return true;
    return (Date.now() - state.timestamp) > (24 * 60 * 60 * 1000); // 24h cooldown
  }

  getLastRejectionReason() { return this.db.data.last_rejection_reason; }
  async setLastRejectionReason(reason) { this.db.data.last_rejection_reason = reason; await this.db.write(); }

  // Post Continuations
  getPostContinuations() { return this.db.data.post_continuations || []; }
  async addPostContinuation(data) { this.db.data.post_continuations.push({ ...data, timestamp: Date.now() }); await this.db.write(); }
  async removePostContinuation(id) {
    this.db.data.post_continuations = this.db.data.post_continuations.filter(c => c.id !== id);
    await this.db.write();
  }

  // Replied Posts
  hasReplied(postId) { return (this.db.data.repliedPosts || []).includes(postId); }
  async addRepliedPost(postId) {
    if (!(this.db.data.repliedPosts || []).includes(postId)) {
      if (!this.db.data.repliedPosts) this.db.data.repliedPosts = [];
      this.db.data.repliedPosts.push(postId);
      if (this.db.data.repliedPosts.length > 200) this.db.data.repliedPosts.shift();
      await this.db.write();
    }
  }
  async removeRepliedPost(postId) {
    if (this.db.data.repliedPosts) {
      this.db.data.repliedPosts = this.db.data.repliedPosts.filter(id => id !== postId);
      await this.db.write();
    }
  }

  // Misc
  getNetworkSentiment() { return this.db.data.network_sentiment || 0.5; }
  async setNetworkSentiment(sentiment) { this.db.data.network_sentiment = sentiment; await this.db.write(); }

  isShieldingActive() { return this.db.data.shielding_active; }
  async setShieldingActive(active) { this.db.data.shielding_active = active; await this.db.write(); }

  isLurkerMode() { return this.db.data.lurker_mode; }
  async setLurkerMode(active) { this.db.data.lurker_mode = active; await this.db.write(); }

  isResting() { return this.db.data.resting_until > Date.now(); }
  async setRestingUntil(timestamp) { this.db.data.resting_until = timestamp; await this.db.write(); }

  isFeedImpactMuted() { return this.db.data.mute_feed_impact_until > Date.now(); }
  async setMuteFeedImpactUntil(timestamp) { this.db.data.mute_feed_impact_until = timestamp; await this.db.write(); }

  async updateConversationLength(channelId, length) {
    this.db.data.conversationLengths[channelId] = length;
    await this.db.write();
  }
  getConversationLength(channelId) { return this.db.data.conversationLengths[channelId] || 0; }

  async updateCooldowns(platform, cooldown) {
    if (!this.db.data.config.cooldowns) this.db.data.config.cooldowns = {};
    this.db.data.config.cooldowns[platform] = cooldown;
    await this.db.write();
  }

  async updateSocialResonance(userId, score) {
    this.db.data.social_resonance[userId] = score;
    await this.db.write();
  }

  async setNuanceGradience(value) { this.db.data.nuance_gradience = value; await this.db.write(); }
  getNuanceGradience() { return this.db.data.nuance_gradience || 0.5; }

  async setPiningMode(value) { this.db.data.pining_mode = value; await this.db.write(); }
  isPining() { return this.db.data.pining_mode; }

  async addUserVibe(userId, vibe) {
    if (!this.db.data.userVibeHistory[userId]) this.db.data.userVibeHistory[userId] = [];
    this.db.data.userVibeHistory[userId].push({ vibe, timestamp: Date.now() });
    await this.db.write();
  }
  getUserVibeHistory(userId) { return this.db.data.userVibeHistory[userId] || []; }

  async checkPfpChange(userId, cid) {
    const oldCid = this.db.data.user_pfp_cids[userId];
    if (oldCid !== cid) {
      this.db.data.user_pfp_cids[userId] = cid;
      await this.db.write();
      return true;
    }
    return false;
  }

  async updateMessageCounts(type, delta) {
    if (this.db.data.message_counts[type] !== undefined) {
      this.db.data.message_counts[type] += delta;
      await this.db.write();
    }
  }

  async addAdminEmotionalState(state) {
    this.db.data.admin_emotional_states.push({ state, timestamp: Date.now() });
    if (this.db.data.admin_emotional_states.length > 20) this.db.data.admin_emotional_states.shift();
    await this.db.write();
  }
  getAdminLastEmotionalStates() { return this.db.data.admin_emotional_states || []; }

  async addAdminFeedback(feedback) {
    this.db.data.admin_feedback.push({ feedback, timestamp: Date.now() });
    await this.db.write();
  }
  getAdminFeedback() { return this.db.data.admin_feedback || []; }

  async addWorldFact(entity, fact, source) {
    this.db.data.world_facts.push({ entity, fact, source, timestamp: Date.now() });
    await this.db.write();
  }
  getWorldFacts() { return this.db.data.world_facts || []; }

  async setAdminHomeMentionedAt(time) { this.db.data.admin_home_mentioned_at = time; await this.db.write(); }
  getAdminHomeMentionedAt() { return this.db.data.admin_home_mentioned_at || 0; }

  async setAdminSleepMentionedAt(time) { this.db.data.admin_sleep_mentioned_at = time; await this.db.write(); }
  getAdminSleepMentionedAt() { return this.db.data.admin_sleep_mentioned_at || 0; }

  async setAdminWorkMentionedAt(time) { this.db.data.admin_work_mentioned_at = time; await this.db.write(); }
  getAdminWorkMentionedAt() { return this.db.data.admin_work_mentioned_at || 0; }

  async setMutatedStyle(style) { this.db.data.mutated_style = style; await this.db.write(); }
  getMutatedStyle() { return this.db.data.mutated_style; }

  async isThreadMuted(threadId) { return (this.db.data.mutedThreads || []).includes(threadId); }
  async muteThread(threadId) {
    if (!(this.db.data.mutedThreads || []).includes(threadId)) {
      if (!this.db.data.mutedThreads) this.db.data.mutedThreads = [];
      this.db.data.mutedThreads.push(threadId);
      await this.db.write();
    }
  }

  async muteBranch(branchId) {
    if (!(this.db.data.mutedBranches || []).includes(branchId)) {
      if (!this.db.data.mutedBranches) this.db.data.mutedBranches = [];
      this.db.data.mutedBranches.push(branchId);
      await this.db.write();
    }
  }
  getMutedBranchInfo(branchId) { return (this.db.data.mutedBranches || []).includes(branchId); }
}

export const dataStore = new DataStore();

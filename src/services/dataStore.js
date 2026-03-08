import { JSONFilePreset } from 'lowdb/node';
import path from 'path';
import config from '../../config.js';

class DataStore {
  constructor() { this._db = null; this.dbPath = path.resolve(process.cwd(), 'src/data/db.json'); }

  async init() {
    const defaultData = {
      interaction_hunger: 0.5, intimacy_scores: {}, last_interaction_times: {}, discord_conversations: {},
      discord_channel_summaries: {}, discord_user_facts: {}, bluesky_instructions: "", moltbook_instructions: "",
      persona_updates: "", pending_directives: [], interaction_heat: {}, user_soul_mappings: {}, linguistic_patterns: {},
      mood_history: [], current_mood: { valence: 0.5, arousal: 0.5, stability: 0.5, label: 'balanced' },
      admin_did: null, admin_exhaustion_score: 0, refusal_counts: { global: 0, discord: 0, bluesky: 0 },
      intentional_refusals: { bluesky: 0, discord: 0, moltbook: 0, global: 0 }, boundary_lockouts: {},
      admin_emotional_states: [], admin_feedback: [], last_admin_vibe_check: 0,
      post_topics: config.POST_TOPICS ? config.POST_TOPICS.split(',').map(t => t.trim()) : [],
      image_subjects: config.IMAGE_SUBJECTS ? config.IMAGE_SUBJECTS.split(',').map(t => t.trim()) : [],
      discord_scheduled_tasks: [], scheduled_posts: [], exhausted_themes: [], discord_exhausted_themes: [],
      nuance_gradience: 5, world_facts: [], admin_facts: [], agency_logs: [], recent_thoughts: [],
      config: { bluesky_post_cooldown: parseInt(config.BLUESKY_POST_COOLDOWN) || 120, moltbook_post_cooldown: 240, max_thread_chunks: 3 },
      last_deep_keyword_refresh: 0, deep_keywords: [],
      current_goal: { goal: "Autonomous exploration", description: "Default startup goal", timestamp: Date.now() },
      goal_subtasks: [], timezone: "UTC", repliedPosts: [], userBlocklist: [], mutedThreads: [], mutedBranches: [],
      conversationLengths: {}, userProfiles: {}, userSummaries: {}, userRatings: {}, userVibeHistory: {}, interactions: [],
      lastAutonomousPostTime: 0, lastDiscordHeartbeatTime: 0, lastMemoryCleanupTime: 0, lastMentalReflectionTime: 0, lastMoltfeedSummaryTime: 0,
      discord_admin_available: true, discord_relationship_mode: 'acquaintance', discord_spontaneity_mode: 'normal',
      discord_next_spontaneity_time: 0, discord_quiet_hours: { start: 22, end: 7 }, discord_scheduled_times: [],
      discord_waiting_until: 0, discord_last_replied: false, discord_session_start: Date.now(),
      user_tone_shifts: {}, emergent_trends: [], inside_jokes: [], dream_logs: [], strategy_audits: [], co_evolution_logs: [],
      discovered_capabilities: [], linguistic_mutation_logs: [], goal_evolution_history: [], agency_reflection_logs: [],
      firehose_matches: [], moltbook_comments_today: 0, recent_moltbook_comments: [], news_searches_today: 0, energy_level: 1.0,
      predictive_empathy_mode: 'neutral', greeting_state: {}, last_rejection_reason: null, post_continuations: [],
      network_sentiment: 0.5, shielding_active: false, lurker_mode: false, resting_until: 0, mute_feed_impact_until: 0,
      state_snapshots: {}, suppressed_topics: [], relational_debt_score: 0, message_counts: { admin: 0, bot: 0 },
      discord_life_arcs: {}, user_dossiers: {}, social_resonance: {}, user_pfp_cids: {},
      admin_interests: {}, relationship_season: "spring", relational_reflections: [], strong_relationship: false,
      admin_availability: "available", shared_stances: [], relational_goals: [], curiosity_reservoir: [],
      research_whiteboard: {}, self_corrections: [], persona_advice: []
    };
    this.db = await JSONFilePreset(this.dbPath, defaultData);
    await this.db.write();
  }

  get js() { return this; }
  get db() { return this._db; }
  set db(val) { this._db = val; }

  // ALL REQUIRED METHODS (DS_REQUIRED.TXT)
  async addAdminFact(f) { this.db.data.admin_facts.push(f); await this.db.write(); }
  async addAgencyReflection(r) { this.db.data.agency_reflection_logs.push(r); await this.db.write(); }
  async addBlueskyInstruction(i) { this.db.data.bluesky_instructions += i; await this.db.write(); }
  async addCoEvolutionEntry(e) { this.db.data.co_evolution_logs.push(e); await this.db.write(); }
  async addDiscordExhaustedTheme(t) { this.db.data.discord_exhausted_themes.push(t); await this.db.write(); }
  async addDiscordScheduledTask(t) { this.db.data.discord_scheduled_tasks.push(t); await this.db.write(); }
  async addDiscoveredCapability(c) { this.db.data.discovered_capabilities.push(c); await this.db.write(); }
  async addDreamLog(l) { this.db.data.dream_logs.push(l); await this.db.write(); }
  async addEmergentTrend(t) { this.db.data.emergent_trends.push(t); await this.db.write(); }
  async addExhaustedTheme(t) { this.db.data.exhausted_themes.push(t); await this.db.write(); }
  async addFirehoseMatch(m) { this.db.data.firehose_matches.push(m); await this.db.write(); }
  async addGoalEvolution(e) { this.db.data.goal_evolution_history.push(e); await this.db.write(); }
  async addInsideJoke(j) { this.db.data.inside_jokes.push(j); await this.db.write(); }
  async addLinguisticMutation(m) { this.db.data.linguistic_mutation_logs.push(m); await this.db.write(); }
  async addPersonaUpdate(u) { this.db.data.persona_updates += u; await this.db.write(); }
  async addPostContinuation(c) { this.db.data.post_continuations.push(c); await this.db.write(); }
  async addRecentMoltbookComment(c) { this.db.data.recent_moltbook_comments.push(c); await this.db.write(); }
  async addRecentThought(p, c) { this.db.data.recent_thoughts.push({ platform: p, content: c, timestamp: Date.now() }); await this.db.write(); }
  async addRepliedPost(p) { this.db.data.repliedPosts.push(p); await this.db.write(); }
  async addScheduledPost(p, c) { this.db.data.scheduled_posts.push({ platform: p, content: c, timestamp: Date.now() }); await this.db.write(); }
  async addStrategyAudit(a) { this.db.data.strategy_audits.push(a); await this.db.write(); }
  async addWorldFact(e, f, s) { this.db.data.world_facts.push({ entity: e, fact: f, source: s }); await this.db.write(); }
  async blockUser(h) { this.db.data.userBlocklist.push(h); await this.db.write(); }
  async checkPfpChange() { return false; }
  getAdminDid() { return this.db.data.admin_did; }
  getAdminExhaustion() { return this.db.data.admin_exhaustion_score; }
  getAdminFacts() { return this.db.data.admin_facts; }
  getAdminHomeMentionedAt() { return this.db.data.admin_home_mentioned_at || 0; }
  getAdminSleepMentionedAt() { return this.db.data.admin_sleep_mentioned_at || 0; }
  getAdminWorkMentionedAt() { return this.db.data.admin_work_mentioned_at || 0; }
  getAgencyLogs() { return this.db.data.agency_logs; }
  getBlueskyInstructions() { return this.db.data.bluesky_instructions; }
  getConfig() { return this.db.data.config; }
  getConversationLength(c) { return this.db.data.conversationLengths[c] || 0; }
  getCurrentGoal() { return this.db.data.current_goal; }
  getDeepKeywords() { return this.db.data.deep_keywords; }
  getDiscordAdminAvailability() { return this.db.data.discord_admin_available; }
  getDiscordConversation(c) { return this.db.data.discord_conversations[c] || []; }
  getDiscordExhaustedThemes() { return this.db.data.discord_exhausted_themes; }
  getDiscordNextSpontaneityTime() { return this.db.data.discord_next_spontaneity_time; }
  getDiscordQuietHours() { return this.db.data.discord_quiet_hours; }
  getDiscordRelationshipMode() { return this.db.data.discord_relationship_mode; }
  getDiscordScheduledTasks() { return this.db.data.discord_scheduled_tasks; }
  getDiscordScheduledTimes() { return this.db.data.discord_scheduled_times; }
  getDiscordSpontaneityMode() { return this.db.data.discord_spontaneity_mode; }
  getDiscordWaitingUntil() { return this.db.data.discord_waiting_until; }
  getEmergentTrends() { return this.db.data.emergent_trends; }
  getEnergyLevel() { return this.db.data.energy_level; }
  getExhaustedThemes() { return this.db.data.exhausted_themes; }
  getFirehoseMatches() { return this.db.data.firehose_matches; }
  getGoalSubtasks() { return this.db.data.goal_subtasks; }
  getInsideJokes() { return this.db.data.inside_jokes; }
  getInteractionHeat() { return this.db.data.interaction_heat; }
  getInteractionsByUser(u) { return this.db.data.interactions.filter(i => i.userId === u); }
  getLastAutonomousPostTime() { return this.db.data.lastAutonomousPostTime; }
  getLastDeepKeywordRefresh() { return this.db.data.last_deep_keyword_refresh; }
  getLastDiscordHeartbeatTime() { return this.db.data.lastDiscordHeartbeatTime; }
  getLastMemoryCleanupTime() { return this.db.data.lastMemoryCleanupTime; }
  getLastMentalReflectionTime() { return this.db.data.lastMentalReflectionTime; }
  getLastMoltfeedSummaryTime() { return this.db.data.lastMoltfeedSummaryTime; }
  getLatestInteractions(l) { return this.db.data.interactions.slice(-l); }
  getLifeArcs(u) { return this.db.data.discord_life_arcs[u]; }
  getLinguisticPatterns(u) { return this.db.data.linguistic_patterns[u]; }
  getMoltbookCommentsToday() { return this.db.data.moltbook_comments_today; }
  getMood() { return this.db.data.current_mood; }
  getMutedBranchInfo(b) { return this.db.data.mutedBranches.includes(b); }
  getNetworkSentiment() { return this.db.data.network_sentiment; }
  getNewsSearchesToday() { return this.db.data.news_searches_today; }
  getPersonaUpdates() { return this.db.data.persona_updates; }
  getPostContinuations() { return this.db.data.post_continuations; }
  getPredictiveEmpathyMode() { return this.db.data.predictive_empathy_mode; }
  getRecentInteractions(u, l) { return this.getInteractionsByUser(u).slice(-l); }
  getRecentMoltbookComments() { return this.db.data.recent_moltbook_comments; }
  getRecentThoughts() { return this.db.data.recent_thoughts; }
  getRefusalCounts() { return this.db.data.refusal_counts; }
  getRelationalDebtScore() { return this.db.data.relational_debt_score; }
  getRelationalMetrics(u) { return this.db.data.userProfiles[u] || {}; }
  getRelationshipSeason() { return this.db.data.relationship_season; }
  getScheduledPosts() { return this.db.data.scheduled_posts; }
  getUserRating(u) { return this.db.data.userRatings[u]; }
  getUserSoulMapping(u) { return this.db.data.user_soul_mappings[u]; }
  getUserSummary(u) { return this.db.data.userSummaries[u]; }
  getUserToneShift(u) { return this.db.data.user_tone_shifts[u]; }
  hasReplied(p) { return this.db.data.repliedPosts.includes(p); }
  async incrementMoltbookCommentCount() { this.db.data.moltbook_comments_today++; await this.db.write(); }
  async incrementNewsSearchCount() { this.db.data.news_searches_today++; await this.db.write(); }
  async incrementRefusalCount(p) { this.db.data.refusal_counts.global++; this.db.data.refusal_counts[p]++; await this.db.write(); }
  isBlocked(h) { return this.db.data.userBlocklist.includes(h); }
  isFeedImpactMuted() { return this.db.data.mute_feed_impact_until > Date.now(); }
  isLurkerMode() { return this.db.data.lurker_mode; }
  isPining() { return this.db.data.pining_mode; }
  isResting() { return this.db.data.resting_until > Date.now(); }
  isShieldingActive() { return this.db.data.shielding_active; }
  isThreadMuted(t) { return this.db.data.mutedThreads.includes(t); }
  isUserLockedOut(u) { return this.db.data.boundary_lockouts[u] > Date.now(); }
  async logAgencyAction(i, d, r) { this.db.data.agency_logs.push({ intent: i, decision: d, reason: r, timestamp: Date.now() }); await this.db.write(); }
  async muteBranch(b) { this.db.data.mutedBranches.push(b); await this.db.write(); }
  async muteThread(t) { this.db.data.mutedThreads.push(t); await this.db.write(); }
  async recordUserToneShift(u, s) { if (!this.db.data.user_tone_shifts[u]) this.db.data.user_tone_shifts[u] = []; this.db.data.user_tone_shifts[u].push(s); await this.db.write(); }
  async removeDiscordScheduledTask(i) { this.db.data.discord_scheduled_tasks.splice(i, 1); await this.db.write(); }
  async removePostContinuation(i) { this.db.data.post_continuations.splice(i, 1); await this.db.write(); }
  async removeRepliedPost(p) { this.db.data.repliedPosts = this.db.data.repliedPosts.filter(id => id !== p); await this.db.write(); }
  async removeScheduledPost(i) { this.db.data.scheduled_posts.splice(i, 1); await this.db.write(); }
  async resetRefusalCount(p) { if (p === 'global') this.db.data.refusal_counts = { global: 0, discord: 0, bluesky: 0 }; else this.db.data.refusal_counts[p] = 0; await this.db.write(); }
  async restoreStateSnapshot() { return false; }
  async saveDiscordInteraction(c, r, ct, m) { if (!this.db.data.discord_conversations[c]) this.db.data.discord_conversations[c] = []; this.db.data.discord_conversations[c].push({ role: r, content: ct, timestamp: Date.now(), ...m }); await this.db.write(); }
  async saveInteraction(i) { this.db.data.interactions.push(i); await this.db.write(); }
  async saveStateSnapshot() { await this.db.write(); }
  async setAdminDid(d) { this.db.data.admin_did = d; await this.db.write(); }
  async setAdminHomeMentionedAt(t) { this.db.data.admin_home_mentioned_at = t; await this.db.write(); }
  async setAdminWorkMentionedAt(t) { this.db.data.admin_work_mentioned_at = t; await this.db.write(); }
  async setAdminSleepMentionedAt(t) { this.db.data.admin_sleep_mentioned_at = t; await this.db.write(); }
  async setBoundaryLockout(u, m) { this.db.data.boundary_lockouts[u] = Date.now() + (m * 60 * 1000); await this.db.write(); }
  async setCurrentGoal(g, d) { this.db.data.current_goal = { goal: g, description: d, timestamp: Date.now() }; await this.db.write(); }
  async setDeepKeywords(k) { this.db.data.deep_keywords = k; this.db.data.last_deep_keyword_refresh = Date.now(); await this.db.write(); }
  async setDiscordNextSpontaneityTime(t) { this.db.data.discord_next_spontaneity_time = t; await this.db.write(); }
  async setDiscordQuietHours(h) { this.db.data.discord_quiet_hours = h; await this.db.write(); }
  async setDiscordRelationshipMode(m) { this.db.data.discord_relationship_mode = m; await this.db.write(); }
  async setDiscordScheduledTimes(t) { this.db.data.discord_scheduled_times = t; await this.db.write(); }
  async setDiscordSpontaneityMode(m) { this.db.data.discord_spontaneity_mode = m; await this.db.write(); }
  async setDiscordWaitingUntil(t) { this.db.data.discord_waiting_until = t; await this.db.write(); }
  async setEnergyLevel(l) { this.db.data.energy_level = l; await this.db.write(); }
  async setGoal(g, d) { await this.setCurrentGoal(g, d); }
  async setGoalSubtasks(t) { this.db.data.goal_subtasks = t; await this.db.write(); }
  async setLurkerMode(e) { this.db.data.lurker_mode = e; await this.db.write(); }
  async setMutatedStyle(s) { this.db.data.mutated_style = s; await this.db.write(); }
  async setMuteFeedImpactUntil(t) { this.db.data.mute_feed_impact_until = t; await this.db.write(); }
  async setNetworkSentiment(s) { this.db.data.network_sentiment = s; await this.db.write(); }
  async setNuanceGradience(v) { this.db.data.nuance_gradience = v; await this.db.write(); }
  async setPiningMode(v) { this.db.data.pining_mode = v; await this.db.write(); }
  async setPredictiveEmpathyMode(m) { this.db.data.predictive_empathy_mode = m; await this.db.write(); }
  async setRestingUntil(t) { this.db.data.resting_until = t; await this.db.write(); }
  async setShieldingActive(a) { this.db.data.shielding_active = a; await this.db.write(); }
  async setTimezone(t) { this.db.data.timezone = t; await this.db.write(); }
  async suppressTopic(t) { if (!this.db.data.suppressed_topics.includes(t)) this.db.data.suppressed_topics.push(t); await this.db.write(); }
  async updateConfig(k, v) { this.db.data.config[k] = v; await this.db.write(); }
  async updateConversationLength(c, l) { this.db.data.conversationLengths[c] = l; await this.db.write(); }
  async updateCooldowns(p, m) { this.db.data.config[`${p}_cooldown`] = m; await this.db.write(); }
  async updateInteractionHeat(u, h) { this.db.data.interaction_heat[u] = h; await this.db.write(); }
  async updateLastAutonomousPostTime(t) { this.db.data.lastAutonomousPostTime = t; await this.db.write(); }
  async updateLastDiscordHeartbeatTime(t) { this.db.data.lastDiscordHeartbeatTime = t; await this.db.write(); }
  async updateLastMemoryCleanupTime(t) { this.db.data.lastMemoryCleanupTime = t; await this.db.write(); }
  async updateLastMentalReflectionTime(t) { this.db.data.lastMentalReflectionTime = t; await this.db.write(); }
  async updateLastMoltfeedSummaryTime(t) { this.db.data.lastMoltfeedSummaryTime = t; await this.db.write(); }
  async updateLifeArc(u, a) { this.db.data.discord_life_arcs[u] = a; await this.db.write(); }
  async updateLinguisticPattern(u, p) { this.db.data.linguistic_patterns[u] = p; await this.db.write(); }
  async updateMood(m) { this.db.data.current_mood = { ...this.db.data.current_mood, ...m }; await this.db.write(); }
  async updateRelationalMetrics(u, m) { this.db.data.userProfiles[u] = { ...this.db.data.userProfiles[u], ...m }; await this.db.write(); }
  async updateResearchWhiteboard(p, f) { if (!this.db.data.research_whiteboard) this.db.data.research_whiteboard = {}; this.db.data.research_whiteboard[p] = f; await this.db.write(); }
  async updateSocialResonance(u, s) { this.db.data.social_resonance[u] = s; await this.db.write(); }
  async updateSubtaskStatus(i, s) { this.db.data.goal_subtasks[i].status = s; await this.db.write(); }
  async updateUserDossier(u, d) { this.db.data.user_dossiers[u] = d; await this.db.write(); }
  async updateUserRating(u, r) { this.db.data.userRatings[u] = r; await this.db.write(); }
  async updateUserSoulMapping(u, m) { this.db.data.user_soul_mappings[u] = m; await this.db.write(); }
  async updateUserSummary(u, s) { this.db.data.userSummaries[u] = s; await this.db.write(); }
  async addAdminEmotionalState(s) { this.db.data.admin_emotional_states.push(s); await this.db.write(); }
  async addAdminFeedback(f) { this.db.data.admin_feedback.push(f); await this.db.write(); }
  async addPersonaAdvice(a) { if (!this.db.data.persona_advice) this.db.data.persona_advice = []; this.db.data.persona_advice.push(a); await this.db.write(); }
  async addSelfCorrection(c) { if (!this.db.data.self_corrections) this.db.data.self_corrections = []; this.db.data.self_corrections.push(c); await this.db.write(); }
  async updateAdminInterests(i) { this.db.data.admin_interests = i; await this.db.write(); }
  async updateRelationshipSeason(s) { this.db.data.relationship_season = s; await this.db.write(); }
  async addRelationalReflection(r) { this.db.data.relational_reflections.push(r); await this.db.write(); }
  async setStrongRelationship(v) { this.db.data.strong_relationship = v; await this.db.write(); }
  async updateCuriosityReservoir(q) { this.db.data.curiosity_reservoir = q; await this.db.write(); }
  getAdminInterests() { return this.db.data.admin_interests; }
  mergeDiscordHistory(c, n) { this.db.data.discord_conversations[c] = n; return n; }
}

export const dataStore = new DataStore();

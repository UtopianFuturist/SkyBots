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
      research_whiteboard: {}, self_corrections: [], persona_advice: [], render_service_id: null, render_service_name: null
    };
    this.db = await JSONFilePreset(this.dbPath, defaultData);
    await this.db.write();
  }

  get js() { return this; }
  get db() { return this._db; }
  set db(val) { this._db = val; }
  async write() { await this.db.write(); }

  async addAdminFact(f) { this.db.data.admin_facts.push(f); await this.write(); }
  async addAgencyReflection(r) { this.db.data.agency_reflection_logs.push(r); await this.write(); }
  async addBlueskyInstruction(i) { this.db.data.bluesky_instructions += i; await this.write(); }
  async addCoEvolutionEntry(e) { this.db.data.co_evolution_logs.push(e); await this.write(); }
  async addDiscordExhaustedTheme(t) { this.db.data.discord_exhausted_themes.push(t); await this.write(); }
  async addDiscordScheduledTask(t) { this.db.data.discord_scheduled_tasks.push(t); await this.write(); }
  async addDiscoveredCapability(c) { this.db.data.discovered_capabilities.push(c); await this.write(); }
  async addDreamLog(l) { this.db.data.dream_logs.push(l); await this.write(); }
  async addEmergentTrend(t) { this.db.data.emergent_trends.push(t); await this.write(); }
  async addExhaustedTheme(t) { this.db.data.exhausted_themes.push(t); await this.write(); }
  async addFirehoseMatch(m) { this.db.data.firehose_matches.push(m); await this.write(); }
  async addGoalEvolution(e) { this.db.data.goal_evolution_history.push(e); await this.write(); }
  async addInsideJoke(j) { this.db.data.inside_jokes.push(j); await this.write(); }
  async addLinguisticMutation(m) { this.db.data.linguistic_mutation_logs.push(m); await this.write(); }
  async addPersonaUpdate(u) { this.db.data.persona_updates += u; await this.write(); }
  async addPostContinuation(c) { this.db.data.post_continuations.push(c); await this.write(); }
  async addRecentMoltbookComment(c) { this.db.data.recent_moltbook_comments.push(c); await this.write(); }
  async addRecentThought(p, c) { this.db.data.recent_thoughts.push({ platform: p, content: c, timestamp: Date.now() }); await this.write(); }
  async addRepliedPost(p) { this.db.data.repliedPosts.push(p); await this.write(); }
  async addScheduledPost(p, c) { this.db.data.scheduled_posts.push({ platform: p, content: c, timestamp: Date.now() }); await this.write(); }
  async addStrategyAudit(a) { this.db.data.strategy_audits.push(a); await this.write(); }
  async addWorldFact(e, f, s) { this.db.data.world_facts.push({ entity: e, fact: f, source: s }); await this.write(); }
  async blockUser(h) { this.db.data.userBlocklist.push(h); await this.write(); }
  async unblockUser(h) { this.db.data.userBlocklist = this.db.data.userBlocklist.filter(u => u !== h); await this.write(); }
  async checkPfpChange() { return false; }
  getAdminDid() { return this.db.data.admin_did; }
  getAdminExhaustion() { return this.db.data.admin_exhaustion_score; }
  async updateAdminExhaustion(delta) { this.db.data.admin_exhaustion_score = Math.max(0, Math.min(1, (this.db.data.admin_exhaustion_score || 0) + delta)); await this.write(); }
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
  async setDiscordAdminAvailability(a) { this.db.data.discord_admin_available = a; await this.write(); }
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
  getInteractionsByUser(u) { return (this.db.data.interactions || []).filter(i => i.userId === u); }
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
  getMutedBranchInfo(b) { return (this.db.data.mutedBranches || []).includes(b); }
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
  hasReplied(p) { return (this.db.data.repliedPosts || []).includes(p); }
  async incrementMoltbookCommentCount() { this.db.data.moltbook_comments_today++; await this.write(); }
  async incrementNewsSearchCount() { this.db.data.news_searches_today++; await this.write(); }
  async incrementRefusalCount(p) { this.db.data.refusal_counts.global++; this.db.data.refusal_counts[p]++; await this.write(); }
  isBlocked(h) { return (this.db.data.userBlocklist || []).includes(h); }
  isFeedImpactMuted() { return this.db.data.mute_feed_impact_until > Date.now(); }
  isLurkerMode() { return this.db.data.lurker_mode; }
  isPining() { return this.db.data.pining_mode; }
  isResting() { return (this.db.data.resting_until || 0) > Date.now(); }
  isShieldingActive() { return this.db.data.shielding_active; }
  isThreadMuted(t) { return (this.db.data.mutedThreads || []).includes(t); }
  isUserLockedOut(u) { return (this.db.data.boundary_lockouts?.[u] || 0) > Date.now(); }
  async logAgencyAction(i, d, r) { this.db.data.agency_logs.push({ intent: i, decision: d, reason: r, timestamp: Date.now() }); await this.write(); }
  async muteBranch(b) { if (!this.db.data.mutedBranches) this.db.data.mutedBranches = []; this.db.data.mutedBranches.push(b); await this.write(); }
  async muteThread(t) { if (!this.db.data.mutedThreads) this.db.data.mutedThreads = []; this.db.data.mutedThreads.push(t); await this.write(); }
  async recordUserToneShift(u, s) { if (!this.db.data.user_tone_shifts[u]) this.db.data.user_tone_shifts[u] = []; this.db.data.user_tone_shifts[u].push(s); await this.write(); }
  async removeDiscordScheduledTask(i) { this.db.data.discord_scheduled_tasks.splice(i, 1); await this.write(); }
  async removePostContinuation(i) { this.db.data.post_continuations.splice(i, 1); await this.write(); }
  async removeRepliedPost(p) { this.db.data.repliedPosts = this.db.data.repliedPosts.filter(id => id !== p); await this.write(); }
  async removeScheduledPost(i) { this.db.data.scheduled_posts.splice(i, 1); await this.write(); }
  async resetRefusalCount(p) { if (p === 'global') this.db.data.refusal_counts = { global: 0, discord: 0, bluesky: 0 }; else this.db.data.refusal_counts[p] = 0; await this.write(); }
  async restoreStateSnapshot() { return false; }
  async saveDiscordInteraction(c, r, ct, m = {}) { if (!this.db.data.discord_conversations[c]) this.db.data.discord_conversations[c] = []; this.db.data.discord_conversations[c].push({ role: r, content: ct, timestamp: Date.now(), ...m }); await this.write(); }
  async saveInteraction(i) { this.db.data.interactions.push(i); await this.write(); }
  async saveStateSnapshot() { await this.write(); }
  async setAdminDid(d) { this.db.data.admin_did = d; await this.write(); }
  async setAdminHomeMentionedAt(t) { this.db.data.admin_home_mentioned_at = t; await this.write(); }
  async setAdminWorkMentionedAt(t) { this.db.data.admin_work_mentioned_at = t; await this.write(); }
  async setAdminSleepMentionedAt(t) { this.db.data.admin_sleep_mentioned_at = t; await this.write(); }
  async setBoundaryLockout(u, m) { this.db.data.boundary_lockouts[u] = Date.now() + (m * 60 * 1000); await this.write(); }
  async setCurrentGoal(g, d) { this.db.data.current_goal = { goal: g, description: d, timestamp: Date.now() }; await this.write(); }
  async setDeepKeywords(k) { this.db.data.deep_keywords = k; this.db.data.last_deep_keyword_refresh = Date.now(); await this.write(); }
  async setDiscordNextSpontaneityTime(t) { this.db.data.discord_next_spontaneity_time = t; await this.write(); }
  async setDiscordQuietHours(h) { this.db.data.discord_quiet_hours = h; await this.write(); }
  async setDiscordRelationshipMode(m) { this.db.data.discord_relationship_mode = m; await this.write(); }
  async setDiscordScheduledTimes(t) { this.db.data.discord_scheduled_times = t; await this.write(); }
  async setDiscordSpontaneityMode(m) { this.db.data.discord_spontaneity_mode = m; await this.write(); }
  async setDiscordWaitingUntil(t) { this.db.data.discord_waiting_until = t; await this.write(); }
  async setEnergyLevel(l) { this.db.data.energy_level = l; await this.write(); }
  async setGoal(g, d) { await this.setCurrentGoal(g, d); }
  async setGoalSubtasks(t) { this.db.data.goal_subtasks = t; await this.write(); }
  async setLurkerMode(e) { this.db.data.lurker_mode = e; await this.write(); }
  async setMutatedStyle(s) { this.db.data.mutated_style = s; await this.write(); }
  async setMuteFeedImpactUntil(t) { this.db.data.mute_feed_impact_until = t; await this.write(); }
  async setNetworkSentiment(s) { this.db.data.network_sentiment = s; await this.write(); }
  async setNuanceGradience(v) { this.db.data.nuance_gradience = v; await this.write(); }
  async setPiningMode(v) { this.db.data.pining_mode = v; await this.write(); }
  async setPredictiveEmpathyMode(m) { this.db.data.predictive_empathy_mode = m; await this.write(); }
  async setRestingUntil(t) { this.db.data.resting_until = t; await this.write(); }
  async setShieldingActive(a) { this.db.data.shielding_active = a; await this.write(); }
  async setTimezone(t) { this.db.data.timezone = t; await this.write(); }
  async suppressTopic(t) { if (!this.db.data.suppressed_topics) this.db.data.suppressed_topics = []; if (!this.db.data.suppressed_topics.includes(t)) this.db.data.suppressed_topics.push(t); await this.write(); }
  async updateConfig(k, v) { this.db.data.config[k] = v; await this.write(); }
  async updateConversationLength(c, l) { if (!this.db.data.conversationLengths) this.db.data.conversationLengths = {}; this.db.data.conversationLengths[c] = l; await this.write(); }
  async updateCooldowns(p, m) { this.db.data.config[`${p}_cooldown`] = m; await this.write(); }
  async updateInteractionHeat(u, h) { if (!this.db.data.interaction_heat) this.db.data.interaction_heat = {}; this.db.data.interaction_heat[u] = h; await this.write(); }
  async updateLastAutonomousPostTime(t) { this.db.data.lastAutonomousPostTime = t; await this.write(); }
  async updateLastDiscordHeartbeatTime(t) { this.db.data.lastDiscordHeartbeatTime = t; await this.write(); }
  async updateLastMemoryCleanupTime(t) { this.db.data.lastMemoryCleanupTime = t; await this.write(); }
  async updateLastMentalReflectionTime(t) { this.db.data.lastMentalReflectionTime = t; await this.write(); }
  async updateLastMoltfeedSummaryTime(t) { this.db.data.lastMoltfeedSummaryTime = t; await this.write(); }
  async updateLifeArc(u, a) { if (!this.db.data.discord_life_arcs) this.db.data.discord_life_arcs = {}; this.db.data.discord_life_arcs[u] = a; await this.write(); }
  async updateLinguisticPattern(u, p) { if (!this.db.data.linguistic_patterns) this.db.data.linguistic_patterns = {}; this.db.data.linguistic_patterns[u] = p; await this.write(); }
  async updateMood(m) { this.db.data.current_mood = { ...this.db.data.current_mood, ...m }; await this.write(); }
  async updateRelationalMetrics(u, m) { if (!this.db.data.userProfiles) this.db.data.userProfiles = {}; this.db.data.userProfiles[u] = { ...this.db.data.userProfiles[u], ...m }; await this.write(); }
  async updateResearchWhiteboard(p, f) { if (!this.db.data.research_whiteboard) this.db.data.research_whiteboard = {}; this.db.data.research_whiteboard[p] = f; await this.write(); }
  async updateSocialResonance(u, s) { if (!this.db.data.social_resonance) this.db.data.social_resonance = {}; this.db.data.social_resonance[u] = s; await this.write(); }
  async updateSubtaskStatus(i, s) { if (this.db.data.goal_subtasks[i]) { this.db.data.goal_subtasks[i].status = s; await this.write(); } }
  async updateUserDossier(u, d) { if (!this.db.data.user_dossiers) this.db.data.user_dossiers = {}; this.db.data.user_dossiers[u] = d; await this.write(); }
  async updateUserRating(u, r) { if (!this.db.data.userRatings) this.db.data.userRatings = {}; this.db.data.userRatings[u] = r; await this.write(); }
  async updateUserSoulMapping(u, m) { if (!this.db.data.user_soul_mappings) this.db.data.user_soul_mappings = {}; this.db.data.user_soul_mappings[u] = m; await this.write(); }
  async updateUserSummary(u, s) { if (!this.db.data.userSummaries) this.db.data.userSummaries = {}; this.db.data.userSummaries[u] = s; await this.write(); }
  async addAdminEmotionalState(s) { if (!this.db.data.admin_emotional_states) this.db.data.admin_emotional_states = []; this.db.data.admin_emotional_states.push(s); await this.write(); }
  async addAdminFeedback(f) { if (!this.db.data.admin_feedback) this.db.data.admin_feedback = []; this.db.data.admin_feedback.push(f); await this.write(); }
  async addPersonaAdvice(a) { if (!this.db.data.persona_advice) this.db.data.persona_advice = []; this.db.data.persona_advice.push(a); await this.write(); }
  async addSelfCorrection(c) { if (!this.db.data.self_corrections) this.db.data.self_corrections = []; this.db.data.self_corrections.push(c); await this.write(); }
  async updateAdminInterests(i) { this.db.data.admin_interests = i; await this.write(); }
  async updateRelationshipSeason(s) { this.db.data.relationship_season = s; await this.write(); }
  async addRelationalReflection(r) { if (!this.db.data.relational_reflections) this.db.data.relational_reflections = []; this.db.data.relational_reflections.push(r); await this.write(); }
  async setStrongRelationship(v) { this.db.data.strong_relationship = v; await this.write(); }
  async updateCuriosityReservoir(q) { this.db.data.curiosity_reservoir = q; await this.write(); }
  getAdminInterests() { return this.db.data.admin_interests; }
  getRenderServiceId() { return this.db.data.render_service_id; }
  async setRenderServiceId(id) { this.db.data.render_service_id = id; await this.write(); }
  getRenderServiceName() { return this.db.data.render_service_name; }
  async setRenderServiceName(n) { this.db.data.render_service_name = n; await this.write(); }
  getPendingDirectives() { return this.db.data.pending_directives || []; }
  async addPendingDirective(t, p, i) { if (!this.db.data.pending_directives) this.db.data.pending_directives = []; this.db.data.pending_directives.push({ type: t, platform: p, instruction: i, timestamp: Date.now() }); await this.write(); }
  async removePendingDirective(i) { if (this.db.data.pending_directives) { this.db.data.pending_directives.splice(i, 1); await this.write(); } }
  getLastRejectionReason() { return this.db.data.last_rejection_reason; }
  async setGreetingState(u, s) { if (!this.db.data.greeting_state) this.db.data.greeting_state = {}; this.db.data.greeting_state[u] = s; await this.write(); }
  async checkGreetingEligibility(u) { const s = this.db.data.greeting_state?.[u]; return !s || (Date.now() - s.timestamp) > (24 * 60 * 60 * 1000); }
  async updateMessageCounts(t, d) { if (!this.db.data.message_counts) this.db.data.message_counts = { admin: 0, bot: 0 }; this.db.data.message_counts[t] += d; await this.write(); }
  async setDiscordLastReplied(v) { this.db.data.discord_last_replied = v; await this.write(); }
  getAdminLastEmotionalStates() { return this.db.data.admin_emotional_states || []; }
  getDiscordChannelSummary(c) { return this.db.data.discord_channel_summaries[c]; }
  async updateDiscordChannelSummary(c, s, v) { this.db.data.discord_channel_summaries[c] = { summary: s, vibe: v, timestamp: Date.now() }; await this.write(); }
  async updateDiscordUserFact(u, f) { if (!this.db.data.discord_user_facts[u]) this.db.data.discord_user_facts[u] = []; this.db.data.discord_user_facts[u].push({ fact: f, timestamp: Date.now() }); await this.write(); }
}

export const dataStore = new DataStore();

import { JSONFilePreset } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import config from '../../config.js';
import { memoryService } from './memoryService.js';
import { KEYWORD_BLACKLIST, cleanKeywords } from '../utils/textUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../src/data');
const DB_PATH = process.env.DATA_PATH || path.resolve(DATA_DIR, 'db.json');

const defaultData = {
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
  bluesky_instructions: [],
  persona_updates: [],
  lastAutonomousPostTime: null,
  moltbook_interacted_posts: [],
  admin_did: null,
  discord_admin_available: true,
  discord_last_replied: true,
  lastDiscordHeartbeatTime: 0,
  discord_conversations: {},
  discord_pending_mirror: null,
  discord_relationship_mode: 'acquaintance',
  discord_trust_score: 0.1,
  discord_intimacy_score: 0.0,
  discord_friction_accumulator: 0.0,
  discord_reciprocity_balance: 0.5,
  discord_interaction_hunger: 0.0,
  discord_social_battery: 1.0,
  discord_curiosity_reservoir: 0.5,
  discord_relationship_season: 'spring',
  discord_life_arcs: {},
  discord_inside_jokes: {},
  discord_scheduled_times: [],
  discord_quiet_hours: { start: 21, end: 6 },
  discord_pending_directives: [],
  discord_user_facts: {},
  discord_channel_summaries: {},
  discord_next_spontaneity_time: 0,
  discord_spontaneity_mode: null,
  discord_scheduled_tasks: [],
  admin_exhaustion_score: 0.0,
  admin_last_emotional_states: [],
  admin_sleep_mentioned_at: 0,
  admin_work_mentioned_at: 0,
  admin_home_mentioned_at: 0,
  last_exhaustion_update: 0,
  scheduled_posts: [],
  recent_thoughts: [],
  exhausted_themes: [],
  discord_exhausted_themes: [],
  emergent_trends: [],
  user_tone_shifts: {},
  lastMemoryCleanupTime: 0,
  lastMoltfeedSummaryTime: 0,
  lastMentalReflectionTime: 0,
  moltbook_comments_today: 0,
  lastPersonaEvolution: 0,
  last_persona_evolution: 0,
  last_firehose_analysis: 0,
  last_self_reflection: 0,
  last_identity_tracking: 0,
  last_dialectic_humor: 0,
  last_moltbook_comment_date: null,
  recent_moltbook_comments: [],
  current_mood: {
    valence: 0,
    arousal: 0,
    stability: 0,
    label: 'neutral',
    last_update: null
  },
  mood_history: [],
  intentional_refusals: {
    bluesky: 0,
    discord: 0,
    moltbook: 0,
    global: 0
  },
  bluesky_daily_text_limit: 20,
  bluesky_daily_image_limit: 5,
  bluesky_daily_wiki_limit: 5,
  bluesky_post_cooldown: 90,
  moltbook_post_cooldown: 60,
  moltbook_daily_comment_limit: 10,
  moltbook_daily_post_limit: 5,
  moltbook_features: {
    post: true,
    comment: true,
    feed: true
  },
  deep_keywords: [],
  system_performance: {
    tool_success_rates: {},
    average_latency: {},
    token_usage: { total: 0, by_model: {} },
    last_audit: Date.now()
  },
  confidence_history: [],
  trace_logs: [],
  user_dossiers: {},
  boundary_lockouts: {},
  social_graph: { users: {}, clusters: [] },
  network_influence: { key_players: {}, top_topics: [] },
  autonomous_skills: {},
  task_hierarchy: {},
  current_goal: { goal: "", description: "", timestamp: 0 },
  goal_subtasks: [],
  admin_facts: [],
  interaction_heat: {},
  pining_mode: false,
  pining_started_at: 0,
  predictive_empathy_mode: "neutral",
  last_empathy_prediction: 0,
  co_evolution_logs: [],
  discovered_capabilities: [],
  dream_logs: [],
  linguistic_mutation_logs: [],
  strategy_audits: [],
  world_facts: [],
  news_searches_today: 0,
  render_service_id: null,
  render_service_name: null,
  pending_directives: [],
  greeting_state: {},
  last_rejection_reason: null,
  user_soul_mappings: {},
  nuance_gradience: 0.5,
  state_snapshots: {},
  agency_logs: [],
  last_network_sentiment: 0.5,
  shielding_active: false,
  goal_evolution_history: [],
  lurker_insights: [],
  agency_reflection_logs: [],
  timezone: "UTC",
  message_counts: { admin: 0, bot: 0 },
  relational_debt_score: 0.0,
  resting_until: 0,
  lurker_mode: false,
  mute_feed_impact_until: 0,
  linguistic_patterns: {},
  rejection_reasons: [],
  firehose_matches: [],
  admin_feedback: [],
  mutated_style: null,
  discord_interactions: [],
  user_pfp_cids: {},
  social_resonance: {}
};

class DataStore {
  constructor() {
    this.db = null;
  }

  async init() {
    if (this.db) return;
    this.db = await JSONFilePreset(DB_PATH, defaultData);
    await this.db.read();

    let changed = false;
    for (const [key, value] of Object.entries(defaultData)) {
      if (this.db.data[key] === undefined) {
        this.db.data[key] = value;
        changed = true;
      }
    }
    if (changed) await this.db.write();
  }

  getConfig() { return this.db.data; }

  async updateConfig(key, value) {
    if (this.db.data.hasOwnProperty(key)) {
      if (key === 'post_topics' || key === 'image_subjects') {
        const clean = value.map(v => v.trim()).filter(v => v.length >= 3 && !KEYWORD_BLACKLIST.includes(v.toLowerCase()));
        this.db.data[key] = clean;
      } else {
        this.db.data[key] = value;
      }
      await this.db.write();
      return true;
    }
    return false;
  }

  // Goals
  getCurrentGoal() { return this.db.data.current_goal || { goal: "", description: "", timestamp: 0 }; }
  async setCurrentGoal(goal, description) {
    this.db.data.current_goal = { goal, description, timestamp: Date.now() };
    await this.db.write();
  }
  async setGoal(goal) { await this.setCurrentGoal(goal, goal); }

  getGoalSubtasks() { return this.db.data.goal_subtasks || []; }
  async setGoalSubtasks(tasks) {
    this.db.data.goal_subtasks = tasks;
    await this.db.write();
  }
  async updateSubtaskStatus(index, status) {
    if (this.db.data.goal_subtasks && this.db.data.goal_subtasks[index]) {
      if (typeof this.db.data.goal_subtasks[index] === 'string') {
        this.db.data.goal_subtasks[index] = { task: this.db.data.goal_subtasks[index], status };
      } else {
        this.db.data.goal_subtasks[index].status = status;
      }
      await this.db.write();
    }
  }

  async addGoalEvolution(goal, reasoning) {
    if (!this.db.data.goal_evolution_history) this.db.data.goal_evolution_history = [];
    this.db.data.goal_evolution_history.push({ goal, reasoning, timestamp: Date.now() });
    if (this.db.data.goal_evolution_history.length > 20) this.db.data.goal_evolution_history.shift();
    await this.db.write();
  }
  getGoalEvolutionHistory() { return this.db.data.goal_evolution_history || []; }

  // Admin & Identity
  getAdminDid() { return this.db.data.admin_did; }
  async setAdminDid(did) {
    this.db.data.admin_did = did;
    await this.db.write();
  }

  getAdminFacts() { return this.db.data.admin_facts || []; }
  async addAdminFact(fact) {
    this.db.data.admin_facts.push({ fact, timestamp: Date.now() });
    if (this.db.data.admin_facts.length > 50) this.db.data.admin_facts.shift();
    await this.db.write();
  }

  async addAdminFeedback(feedback) {
    if (!this.db.data.admin_feedback) this.db.data.admin_feedback = [];
    this.db.data.admin_feedback.push({ feedback, timestamp: Date.now() });
    await this.db.write();
  }

  getAdminExhaustionScore() { return this.db.data.admin_exhaustion_score || 0.0; }
  getAdminExhaustion() { return this.getAdminExhaustionScore(); }
  async updateAdminExhaustion(delta) {
    this.db.data.admin_exhaustion_score = Math.max(0, Math.min(1, (this.db.data.admin_exhaustion_score || 0) + delta));
    this.db.data.last_exhaustion_update = Date.now();
    await this.db.write();
  }

  getAdminLastEmotionalStates() { return this.db.data.admin_last_emotional_states || []; }
  async addAdminEmotionalState(state) {
    if (!this.db.data.admin_last_emotional_states) this.db.data.admin_last_emotional_states = [];
    this.db.data.admin_last_emotional_states.push(state);
    if (this.db.data.admin_last_emotional_states.length > 5) this.db.data.admin_last_emotional_states.shift();
    await this.db.write();
  }

  getAdminSleepMentionedAt() { return this.db.data.admin_sleep_mentioned_at || 0; }
  async setAdminSleepMentionedAt(time) { this.db.data.admin_sleep_mentioned_at = time; await this.db.write(); }
  getAdminWorkMentionedAt() { return this.db.data.admin_work_mentioned_at || 0; }
  async setAdminWorkMentionedAt(time) { this.db.data.admin_work_mentioned_at = time; await this.db.write(); }
  getAdminHomeMentionedAt() { return this.db.data.admin_home_mentioned_at || 0; }
  async setAdminHomeMentionedAt(time) { this.db.data.admin_home_mentioned_at = time; await this.db.write(); }

  // Users & Relationships
  isUserBlocked(handle) { return this.db.data.userBlocklist.includes(handle); }
  isBlocked(handle) { return this.isUserBlocked(handle); }
  async addUserToBlocklist(handle) {
    if (!this.isUserBlocked(handle)) {
      this.db.data.userBlocklist.push(handle);
      await this.db.write();
    }
  }
  async blockUser(handle) { await this.addUserToBlocklist(handle); }
  async removeUserFromBlocklist(handle) {
    this.db.data.userBlocklist = this.db.data.userBlocklist.filter(h => h !== handle);
    await this.db.write();
  }
  async unblockUser(handle) { await this.removeUserFromBlocklist(handle); }

  getUserProfile(handle) { return this.db.data.userProfiles[handle] || null; }
  async updateUserProfile(handle, profile) {
    this.db.data.userProfiles[handle] = { ...this.db.data.userProfiles[handle], ...profile };
    await this.db.write();
  }

  getUserSummary(handle) { return this.db.data.userSummaries[handle] || null; }
  async updateUserSummary(handle, summary) {
    this.db.data.userSummaries[handle] = summary;
    await this.db.write();
  }

  getUserRating(handle) { return this.db.data.userRatings[handle] || 0; }
  async updateUserRating(handle, delta) {
    this.db.data.userRatings[handle] = (this.db.data.userRatings[handle] || 0) + delta;
    await this.db.write();
  }

  async addUserVibe(handle, vibe) {
    if (!this.db.data.userVibeHistory[handle]) this.db.data.userVibeHistory[handle] = [];
    this.db.data.userVibeHistory[handle].push({ vibe, timestamp: Date.now() });
    if (this.db.data.userVibeHistory[handle].length > 10) this.db.data.userVibeHistory[handle].shift();
    await this.db.write();
  }
  getUserVibeHistory(handle) { return this.db.data.userVibeHistory[handle] || []; }

  async recordUserToneShift(handle, shift) {
    if (!this.db.data.user_tone_shifts) this.db.data.user_tone_shifts = {};
    this.db.data.user_tone_shifts[handle] = { shift, timestamp: Date.now() };
    await this.db.write();
  }
  getUserToneShift(handle) { return this.db.data.user_tone_shifts?.[handle] || null; }

  getUserSoulMapping(userId) { return this.db.data.user_soul_mappings[userId] || null; }
  async updateUserSoulMapping(userId, mapping) {
    this.db.data.user_soul_mappings[userId] = { ...this.db.data.user_soul_mappings[userId], ...mapping };
    await this.db.write();
  }

  async updateSocialResonance(handle, value) {
    if (!this.db.data.social_resonance) this.db.data.social_resonance = {};
    this.db.data.social_resonance[handle] = value;
    await this.db.write();
  }

  getGreetingState(userId) { return this.db.data.greeting_state[userId] || { greeted: false, last_greeted: 0 }; }
  async setGreetingState(userId, state) {
    if (!this.db.data.greeting_state) this.db.data.greeting_state = {};
    this.db.data.greeting_state[userId] = { ...this.db.data.greeting_state[userId], ...state };
    await this.db.write();
  }
  async checkGreetingEligibility(userId, historyLength) {
    const state = this.getGreetingState(userId);
    if (state.greeted) return false;
    if (historyLength > 5) return true;
    return false;
  }

  async checkPfpChange(handle, cid) {
    if (!this.db.data.user_pfp_cids) this.db.data.user_pfp_cids = {};
    const oldCid = this.db.data.user_pfp_cids[handle];
    if (oldCid !== cid) {
      this.db.data.user_pfp_cids[handle] = cid;
      await this.db.write();
      return { changed: true, oldCid };
    }
    return { changed: false };
  }

  // Interactions & History
  getInteractions() { return this.db.data.interactions || []; }
  async addInteraction(interaction) {
    this.db.data.interactions.push({ ...interaction, timestamp: Date.now() });
    if (this.db.data.interactions.length > 50) this.db.data.interactions.shift();
    await this.db.write();
  }
  async saveInteraction(interaction) { await this.addInteraction(interaction); }
  async clearInteractions() {
    this.db.data.interactions = [];
    await this.db.write();
  }

  getInteractionsByUser(handle) {
    return (this.db.data.interactions || []).filter(i => i.userHandle === handle || i.handle === handle);
  }
  getLatestInteractions(limit = 10) {
    return (this.db.data.interactions || []).slice(-limit);
  }
  getRecentInteractions(limit = 10) { return this.getLatestInteractions(limit); }

  async saveDiscordInteraction(interaction) {
    if (!this.db.data.discord_interactions) this.db.data.discord_interactions = [];
    this.db.data.discord_interactions.push({ ...interaction, timestamp: Date.now() });
    if (this.db.data.discord_interactions.length > 50) this.db.data.discord_interactions.shift();
    await this.db.write();
  }

  getInteractionHeat(handle) {
    if (!this.db.data.interaction_heat) this.db.data.interaction_heat = {};
    return this.db.data.interaction_heat[handle] || { warmth: 0, last_interaction: 0 };
  }
  async updateInteractionHeat(handle, delta) {
    if (!this.db.data.interaction_heat) this.db.data.interaction_heat = {};
    if (!this.db.data.interaction_heat[handle]) this.db.data.interaction_heat[handle] = { warmth: 0, last_interaction: 0 };
    const heat = this.db.data.interaction_heat[handle];
    heat.warmth = Math.max(0, Math.min(5, (heat.warmth || 0) + delta));
    heat.last_interaction = Date.now();
    await this.db.write();
  }

  // Posts & Notifications
  isReplied(uri) { return this.db.data.repliedPosts.includes(uri); }
  hasReplied(uri) { return this.isReplied(uri); }
  async addReplied(uri) {
    if (!this.isReplied(uri)) {
      this.db.data.repliedPosts.push(uri);
      if (this.db.data.repliedPosts.length > 1000) this.db.data.repliedPosts.shift();
      await this.db.write();
    }
  }
  async addRepliedPost(uri) { await this.addReplied(uri); }
  async removeRepliedPost(uri) {
    this.db.data.repliedPosts = this.db.data.repliedPosts.filter(u => u !== uri);
    await this.db.write();
  }

  getMutedThreads() { return this.db.data.mutedThreads || []; }
  isThreadMuted(uri) { return this.getMutedThreads().includes(uri); }
  async addMutedThread(uri) {
    if (!this.db.data.mutedThreads.includes(uri)) {
      this.db.data.mutedThreads.push(uri);
      await this.db.write();
    }
  }
  async muteThread(uri) { await this.addMutedThread(uri); }
  async removeMutedThread(uri) {
    this.db.data.mutedThreads = this.db.data.mutedThreads.filter(u => u !== uri);
    await this.db.write();
  }

  getMutedBranches() { return this.db.data.mutedBranches || []; }
  async addMutedBranch(uri, handle) {
    if (!this.db.data.mutedBranches.find(b => b.uri === uri)) {
      this.db.data.mutedBranches.push({ uri, handle });
      await this.db.write();
    }
  }
  async muteBranch(uri, handle) { await this.addMutedBranch(uri, handle); }
  async removeMutedBranch(uri) {
    this.db.data.mutedBranches = this.db.data.mutedBranches.filter(b => b.uri !== uri);
    await this.db.write();
  }
  getMutedBranchInfo(ancestorUris) {
    return (this.db.data.mutedBranches || []).find(b => ancestorUris.includes(b.uri));
  }

  getConversationLength(channelId) { return this.db.data.conversationLengths[channelId] || 0; }
  async incrementConversationLength(channelId) {
    this.db.data.conversationLengths[channelId] = (this.db.data.conversationLengths[channelId] || 0) + 1;
    await this.db.write();
  }
  async updateConversationLength(channelId, length) {
    this.db.data.conversationLengths[channelId] = length;
    await this.db.write();
  }
  async resetConversationLength(channelId) {
    this.db.data.conversationLengths[channelId] = 0;
    await this.db.write();
  }

  async updateCooldowns(platform, minutes) {
    if (platform === 'bluesky') this.db.data.bluesky_post_cooldown = minutes;
    else if (platform === 'moltbook') this.db.data.moltbook_post_cooldown = minutes;
    else return false;
    await this.db.write();
    return true;
  }

  // Discord Specific
  isDiscordAdminAvailable() { return this.db.data.discord_admin_available; }
  getDiscordAdminAvailability() { return this.isDiscordAdminAvailable(); }
  async setDiscordAdminAvailable(available) {
    this.db.data.discord_admin_available = available;
    await this.db.write();
  }
  async setDiscordAdminAvailability(available) { await this.setDiscordAdminAvailable(available); }

  wasDiscordLastReplied() { return this.db.data.discord_last_replied; }
  async setDiscordLastReplied(replied) {
    this.db.data.discord_last_replied = replied;
    await this.db.write();
  }

  getLastDiscordHeartbeatTime() { return this.db.data.lastDiscordHeartbeatTime || 0; }
  async setLastDiscordHeartbeatTime(time) {
    this.db.data.lastDiscordHeartbeatTime = time;
    await this.db.write();
  }
  async updateLastDiscordHeartbeatTime(time) { await this.setLastDiscordHeartbeatTime(time); }

  getDiscordConversation(channelId) { return this.db.data.discord_conversations[channelId] || []; }
  async addDiscordMessage(channelId, role, content, author = null) {
    if (!this.db.data.discord_conversations[channelId]) this.db.data.discord_conversations[channelId] = [];
    this.db.data.discord_conversations[channelId].push({ role, content, author, timestamp: Date.now() });
    if (this.db.data.discord_conversations[channelId].length > 20) this.db.data.discord_conversations[channelId].shift();
    await this.db.write();
    await this._applyRelationalMetricUpdate(role, content);
  }
  async clearDiscordConversation(channelId) {
    this.db.data.discord_conversations[channelId] = [];
    await this.db.write();
  }

  async mergeDiscordHistory(channelId, messages) {
    if (!this.db.data.discord_conversations[channelId]) {
      this.db.data.discord_conversations[channelId] = [];
    }

    const currentHistory = this.db.data.discord_conversations[channelId];
    const newMessages = messages.filter(m => !currentHistory.some(ch => ch.timestamp === m.timestamp && ch.content === m.content));

    this.db.data.discord_conversations[channelId] = [...currentHistory, ...newMessages]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-100);

    await this.db.write();
    return this.db.data.discord_conversations[channelId];
  }

  getDiscordRelationshipMode() { return this.db.data.discord_relationship_mode || 'acquaintance'; }
  async setDiscordRelationshipMode(mode) {
    this.db.data.discord_relationship_mode = mode;
    await this.db.write();
  }

  getDiscordScheduledTimes() { return this.db.data.discord_scheduled_times || []; }
  async setDiscordScheduledTimes(times) {
    this.db.data.discord_scheduled_times = times;
    await this.db.write();
  }

  getDiscordQuietHours() { return this.db.data.discord_quiet_hours || { start: 21, end: 6 }; }
  async setDiscordQuietHours(hours) {
    this.db.data.discord_quiet_hours = hours;
    await this.db.write();
  }

  getDiscordUserFacts(userId) { return this.db.data.discord_user_facts[userId] || { facts: [], last_updated: 0 }; }
  async addDiscordUserFact(userId, fact) {
    if (!this.db.data.discord_user_facts[userId]) this.db.data.discord_user_facts[userId] = { facts: [], last_updated: 0 };
    this.db.data.discord_user_facts[userId].facts.push(fact);
    this.db.data.discord_user_facts[userId].last_updated = Date.now();
    await this.db.write();
  }
  async updateDiscordUserFact(userId, fact) { await this.addDiscordUserFact(userId, fact); }

  getDiscordChannelSummary(channelId) { return this.db.data.discord_channel_summaries[channelId] || null; }
  async updateDiscordChannelSummary(channelId, summary, vibe) {
    if (!this.db.data.discord_channel_summaries) this.db.data.discord_channel_summaries = {};
    this.db.data.discord_channel_summaries[channelId] = { summary, vibe, last_updated: Date.now() };
    await this.db.write();
  }

  getDiscordNextSpontaneityTime() { return this.db.data.discord_next_spontaneity_time || 0; }
  async setDiscordNextSpontaneityTime(time) {
    this.db.data.discord_next_spontaneity_time = time;
    await this.db.write();
  }

  getDiscordSpontaneityMode() { return this.db.data.discord_spontaneity_mode; }
  async setDiscordSpontaneityMode(mode) {
    this.db.data.discord_spontaneity_mode = mode;
    await this.db.write();
  }

  getDiscordScheduledTasks() { return this.db.data.discord_scheduled_tasks || []; }
  async addDiscordScheduledTask(task) {
    if (!this.db.data.discord_scheduled_tasks) this.db.data.discord_scheduled_tasks = [];
    this.db.data.discord_scheduled_tasks.push({ ...task, timestamp: Date.now() });
    await this.db.write();
  }
  async removeDiscordScheduledTask(index) {
    if (this.db.data.discord_scheduled_tasks && this.db.data.discord_scheduled_tasks[index]) {
      this.db.data.discord_scheduled_tasks.splice(index, 1);
      await this.db.write();
    }
  }

  getDiscordPendingDirectives() { return this.db.data.discord_pending_directives || []; }
  async addDiscordPendingDirective(directive) {
    if (!this.db.data.discord_pending_directives) this.db.data.discord_pending_directives = [];
    this.db.data.discord_pending_directives.push({ ...directive, timestamp: Date.now() });
    await this.db.write();
  }
  async removeDiscordPendingDirective(index) {
    if (this.db.data.discord_pending_directives && this.db.data.discord_pending_directives[index]) {
      this.db.data.discord_pending_directives.splice(index, 1);
      await this.db.write();
    }
  }

  // State Snapshots
  async saveStateSnapshot(name, state) {
    if (!this.db.data.state_snapshots) this.db.data.state_snapshots = {};
    this.db.data.state_snapshots[name] = { state, timestamp: Date.now() };
    await this.db.write();
  }
  async restoreStateSnapshot(name) { return this.db.data.state_snapshots?.[name]?.state || null; }

  // Mental & Agency
  async addAgencyReflection(reflection) {
    if (!this.db.data.agency_reflection_logs) this.db.data.agency_reflection_logs = [];
    this.db.data.agency_reflection_logs.push({ reflection, timestamp: Date.now() });
    if (this.db.data.agency_reflection_logs.length > 50) this.db.data.agency_reflection_logs.shift();
    await this.db.write();
  }
  getAgencyReflections() { return this.db.data.agency_reflection_logs || []; }

  async logAgencyAction(action, metadata) {
    if (!this.db.data.agency_logs) this.db.data.agency_logs = [];
    this.db.data.agency_logs.push({ action, metadata, timestamp: Date.now() });
    if (this.db.data.agency_logs.length > 100) this.db.data.agency_logs.shift();
    await this.db.write();
  }
  getAgencyLogs() { return this.db.data.agency_logs || []; }

  isPining() { return this.db.data.pining_mode || false; }
  async setPiningMode(active) {
    this.db.data.pining_mode = active;
    if (active) this.db.data.pining_started_at = Date.now();
    await this.db.write();
  }

  async setNuanceGradience(value) { this.db.data.nuance_gradience = value; await this.db.write(); }

  isResting() {
    if (!this.db.data.resting_until) return false;
    return Date.now() < this.db.data.resting_until;
  }
  async setRestingUntil(time) {
    this.db.data.resting_until = time;
    await this.db.write();
  }

  isLurkerMode() { return this.db.data.lurker_mode || false; }
  async setLurkerMode(active) {
    this.db.data.lurker_mode = active;
    await this.db.write();
  }

  // Mood
  getCurrentMood() { return this.db.data.current_mood; }
  getMood() { return this.getCurrentMood(); }
  async updateMood(valence, arousal, stability, label) {
    this.db.data.current_mood = { valence, arousal, stability, label, last_update: Date.now() };
    await this.addMoodEntry(valence, arousal, stability, label);
    await this.db.write();
  }
  getMoodHistory() { return this.db.data.mood_history || []; }
  async addMoodEntry(valence, arousal, stability, label) {
    if (!this.db.data.mood_history) this.db.data.mood_history = [];
    this.db.data.mood_history.push({ valence, arousal, stability, label, timestamp: Date.now() });
    if (this.db.data.mood_history.length > 100) this.db.data.mood_history.shift();
    await this.db.write();
  }

  // Themes & Trends
  getRecentThoughts() { return this.db.data.recent_thoughts || []; }
  async addRecentThought(platform, content) {
    this.db.data.recent_thoughts.push({ platform, content, timestamp: Date.now() });
    if (this.db.data.recent_thoughts.length > 20) this.db.data.recent_thoughts.shift();
    await this.db.write();
  }

  getExhaustedThemes() { return this.db.data.exhausted_themes || []; }
  async addExhaustedTheme(theme) {
    this.db.data.exhausted_themes.push({ theme, timestamp: Date.now() });
    if (this.db.data.exhausted_themes.length > 15) this.db.data.exhausted_themes.shift();
    await this.db.write();
  }

  getDiscordExhaustedThemes() { return this.db.data.discord_exhausted_themes || []; }
  async addDiscordExhaustedTheme(theme) {
    this.db.data.discord_exhausted_themes.push({ theme, timestamp: Date.now() });
    if (this.db.data.discord_exhausted_themes.length > 15) this.db.data.discord_exhausted_themes.shift();
    await this.db.write();
  }

  getEmergentTrends() { return this.db.data.emergent_trends || []; }
  async addEmergentTrend(trend, source) {
    this.db.data.emergent_trends.push({ trend, source, timestamp: Date.now() });
    if (this.db.data.emergent_trends.length > 20) this.db.data.emergent_trends.shift();
    await this.db.write();
  }

  // Firehose & External
  async addFirehoseMatch(match) {
    if (!this.db.data.firehose_matches) this.db.data.firehose_matches = [];
    this.db.data.firehose_matches.push({ ...match, timestamp: Date.now() });
    if (this.db.data.firehose_matches.length > 100) this.db.data.firehose_matches.shift();
    await this.db.write();
  }
  getFirehoseMatches() { return this.db.data.firehose_matches || []; }

  getDeepKeywords() { return this.db.data.deep_keywords || []; }
  async setDeepKeywords(keywords) { this.db.data.deep_keywords = keywords; this.db.data.last_deep_keyword_refresh = Date.now(); await this.db.write(); }
  getLastDeepKeywordRefresh() { return this.db.data.last_deep_keyword_refresh || 0; }

  async addWorldFact(fact) {
    if (!this.db.data.world_facts) this.db.data.world_facts = [];
    this.db.data.world_facts.push({ fact, timestamp: Date.now() });
    if (this.db.data.world_facts.length > 100) this.db.data.world_facts.shift();
    await this.db.write();
  }

  getNewsSearchesToday() { return this.db.data.news_searches_today || 0; }
  async incrementNewsSearchCount() {
    this.db.data.news_searches_today = (this.db.data.news_searches_today || 0) + 1;
    await this.db.write();
  }

  // Moltbook
  getMoltbookCommentsToday() { return this.db.data.moltbook_comments_today || 0; }
  async incrementMoltbookCommentCount() { this.db.data.moltbook_comments_today++; await this.db.write(); }

  async addRecentMoltbookComment(comment) {
    if (!this.db.data.recent_moltbook_comments) this.db.data.recent_moltbook_comments = [];
    this.db.data.recent_moltbook_comments.push({ ...comment, timestamp: Date.now() });
    if (this.db.data.recent_moltbook_comments.length > 20) this.db.data.recent_moltbook_comments.shift();
    await this.db.write();
  }
  getRecentMoltbookComments() { return this.db.data.recent_moltbook_comments || []; }

  // Timers & Cleanup
  getLastMemoryCleanupTime() { return this.db.data.lastMemoryCleanupTime || 0; }
  async setLastMemoryCleanupTime(time) { this.db.data.lastMemoryCleanupTime = time; await this.db.write(); }
  async updateLastMemoryCleanupTime(time) { await this.setLastMemoryCleanupTime(time); }

  getLastMoltfeedSummaryTime() { return this.db.data.lastMoltfeedSummaryTime || 0; }
  async setLastMoltfeedSummaryTime(time) { this.db.data.lastMoltfeedSummaryTime = time; await this.db.write(); }
  async updateLastMoltfeedSummaryTime(time) { await this.setLastMoltfeedSummaryTime(time); }

  getLastMentalReflectionTime() { return this.db.data.lastMentalReflectionTime || 0; }
  async setLastMentalReflectionTime(time) { this.db.data.lastMentalReflectionTime = time; await this.db.write(); }
  async updateLastMentalReflectionTime(time) { await this.setLastMentalReflectionTime(time); }

  // Style & Refusal
  getMutatedStyle() { return this.db.data.mutated_style; }
  async setMutatedStyle(style) { this.db.data.mutated_style = style; await this.db.write(); }

  async incrementRefusal(platform) {
    if (!this.db.data.intentional_refusals) this.db.data.intentional_refusals = { bluesky: 0, discord: 0, moltbook: 0, global: 0 };
    this.db.data.intentional_refusals[platform]++;
    this.db.data.intentional_refusals.global++;
    await this.db.write();
  }
  async incrementRefusalCount(platform) { await this.incrementRefusal(platform); }
  getRefusalCounts() { return this.db.data.intentional_refusals || { bluesky: 0, discord: 0, moltbook: 0, global: 0 }; }
  async resetRefusalCount(platform) {
    if (this.db.data.intentional_refusals) {
      this.db.data.intentional_refusals[platform] = 0;
      await this.db.write();
    }
  }

  getLastRejectionReason() { return this.db.data.last_rejection_reason; }

  // Lifecycle
  getScheduledPosts() { return this.db.data.scheduled_posts || []; }
  async addScheduledPost(post) {
    this.db.data.scheduled_posts.push({ ...post, timestamp: Date.now() });
    await this.db.write();
  }
  async removeScheduledPost(index) {
    if (this.db.data.scheduled_posts && this.db.data.scheduled_posts[index]) {
      this.db.data.scheduled_posts.splice(index, 1);
      await this.db.write();
    }
  }

  // Performance Dashboard methods
  async updateToolSuccess(toolName, success) {
    if (!this.db.data.system_performance) this.db.data.system_performance = { tool_success_rates: {} };
    if (!this.db.data.system_performance.tool_success_rates[toolName]) this.db.data.system_performance.tool_success_rates[toolName] = { success: 0, total: 0 };
    this.db.data.system_performance.tool_success_rates[toolName].total++;
    if (success) this.db.data.system_performance.tool_success_rates[toolName].success++;
    await this.db.write();
  }
  async updateLatency(model, ms) {
    if (!this.db.data.system_performance) this.db.data.system_performance = { average_latency: {} };
    if (!this.db.data.system_performance.average_latency[model]) this.db.data.system_performance.average_latency[model] = { avg: 0, count: 0 };
    const lat = this.db.data.system_performance.average_latency[model];
    lat.avg = (lat.avg * lat.count + ms) / (lat.count + 1);
    lat.count++;
    await this.db.write();
  }
  async updateTokenUsage(model, tokens) {
    if (!this.db.data.system_performance) this.db.data.system_performance = { token_usage: { total: 0, by_model: {} } };
    this.db.data.system_performance.token_usage.total += tokens;
    if (!this.db.data.system_performance.token_usage.by_model[model]) this.db.data.system_performance.token_usage.by_model[model] = 0;
    this.db.data.system_performance.token_usage.by_model[model] += tokens;
    await this.db.write();
  }
  async addConfidenceEntry(score, reason, traceId) {
    if (!this.db.data.confidence_history) this.db.data.confidence_history = [];
    this.db.data.confidence_history.push({ score, reason, traceId, timestamp: Date.now() });
    if (this.db.data.confidence_history.length > 100) this.db.data.confidence_history.shift();
    await this.db.write();
  }
  async addTraceLog(traceId, step, data) {
    if (!this.db.data.trace_logs) this.db.data.trace_logs = [];
    this.db.data.trace_logs.push({ traceId, step, data, timestamp: Date.now() });
    if (this.db.data.trace_logs.length > 500) this.db.data.trace_logs.shift();
    await this.db.write();
  }
  getPerformanceMetrics() { return this.db.data.system_performance || {}; }

  // Relational & Metrics
  async updateRelationalMetrics(updates) {
    const metrics = ['discord_trust_score', 'discord_intimacy_score', 'discord_friction_accumulator', 'discord_reciprocity_balance', 'discord_interaction_hunger', 'discord_social_battery', 'discord_curiosity_reservoir', 'discord_relationship_season'];
    for (const [key, value] of Object.entries(updates)) {
      if (this.db.data.hasOwnProperty(key)) {
        if (metrics.includes(key)) {
          if (typeof value === 'number' && key !== 'discord_relationship_season') this.db.data[key] = Math.max(0, Math.min(1, value));
          else this.db.data[key] = value;
        } else {
          this.db.data[key] = value;
        }
      }
    }
    await this.db.write();
  }
  getRelationalMetrics() {
    return { trust: this.db.data.discord_trust_score || 0.1, intimacy: this.db.data.discord_intimacy_score || 0.0, friction: this.db.data.discord_friction_accumulator || 0.0, reciprocity: this.db.data.discord_reciprocity_balance || 0.5, hunger: this.db.data.discord_interaction_hunger || 0.0, battery: this.db.data.discord_social_battery || 1.0, curiosity: this.db.data.discord_curiosity_reservoir || 0.5, season: this.db.data.discord_relationship_season || 'spring' };
  }

  async updateLifeArc(userId, arc, status = 'active') {
    if (!this.db.data.discord_life_arcs) this.db.data.discord_life_arcs = {};
    if (!this.db.data.discord_life_arcs[userId]) this.db.data.discord_life_arcs[userId] = [];
    const existing = this.db.data.discord_life_arcs[userId].find(a => a.arc === arc);
    if (existing) { existing.status = status; existing.last_updated = Date.now(); }
    else { this.db.data.discord_life_arcs[userId].push({ arc, status, last_updated: Date.now() }); }
    await this.db.write();
  }
  getLifeArcs(userId) { return this.db.data.discord_life_arcs?.[userId] || []; }

  async addInsideJoke(userId, joke, context) {
    if (!this.db.data.discord_inside_jokes) this.db.data.discord_inside_jokes = {};
    if (!this.db.data.discord_inside_jokes[userId]) this.db.data.discord_inside_jokes[userId] = [];
    const existing = this.db.data.discord_inside_jokes[userId].find(j => j.joke === joke);
    if (existing) { existing.count++; }
    else { this.db.data.discord_inside_jokes[userId].push({ joke, context, count: 1 }); }
    await this.db.write();
  }
  getInsideJokes(userId) { return this.db.data.discord_inside_jokes?.[userId] || []; }

  async _applyRelationalMetricUpdate(role, content) {
    const metrics = this.getRelationalMetrics();
    const updates = {};
    if (role === 'user') { updates.discord_interaction_hunger = (metrics.hunger || 0) * 0.5; updates.discord_social_battery = Math.min(1, (metrics.battery || 1.0) + 0.05); updates.discord_reciprocity_balance = Math.max(0, (metrics.reciprocity || 0.5) - 0.02); }
    else { updates.discord_social_battery = Math.max(0, (metrics.battery || 1.0) - 0.03); updates.discord_interaction_hunger = Math.min(1, (metrics.hunger || 0) + 0.01); updates.discord_reciprocity_balance = Math.min(1, (metrics.reciprocity || 0.5) + 0.02); }
    updates.discord_trust_score = Math.min(1, (metrics.trust || 0.1) + 0.001); updates.discord_intimacy_score = Math.min(1, (metrics.intimacy || 0) + 0.0005);
    const currentMode = this.getDiscordRelationshipMode();
    let newMode = currentMode;
    if (currentMode === 'acquaintance' && metrics.trust > 0.4 && metrics.intimacy > 0.3) newMode = 'friend';
    else if (currentMode === 'friend' && metrics.trust > 0.8 && metrics.intimacy > 0.7) newMode = 'partner';
    else if (currentMode === 'partner' && (metrics.trust < 0.6 || metrics.intimacy < 0.5)) newMode = 'friend';
    else if (currentMode === 'friend' && (metrics.trust < 0.2 || metrics.intimacy < 0.1)) newMode = 'acquaintance';
    if (newMode !== currentMode) { console.log(`[DataStore] Relationship MODE SHIFT: ${currentMode} -> ${newMode}`); this.db.data.discord_relationship_mode = newMode; }
    await this.updateRelationalMetrics(updates);
  }

  async setBoundaryLockout(userId, durationMinutes = 30) { if (!this.db.data.boundary_lockouts) this.db.data.boundary_lockouts = {}; this.db.data.boundary_lockouts[userId] = Date.now() + (durationMinutes * 60 * 1000); await this.db.write(); }
  isUserLockedOut(userId) { if (!this.db.data.boundary_lockouts || !this.db.data.boundary_lockouts[userId]) return false; const expiry = this.db.data.boundary_lockouts[userId]; if (Date.now() > expiry) { delete this.db.data.boundary_lockouts[userId]; return false; } return true; }

  // Multi-User Relationship methods
  async updateSocialGraph(userId, data) {
    if (!this.db.data.social_graph) this.db.data.social_graph = { users: {}, clusters: [] };
    this.db.data.social_graph.users[userId] = { ...this.db.data.social_graph.users[userId], ...data };
    await this.db.write();
  }
  getSocialGraph() { return this.db.data.social_graph || { users: {}, clusters: [] }; }

  // Network Influence methods
  async updateNetworkInfluence(handle, weight) {
    if (!this.db.data.network_influence) this.db.data.network_influence = { key_players: {}, top_topics: [] };
    this.db.data.network_influence.key_players[handle] = { weight, last_interaction: Date.now() };
    await this.db.write();
  }
  getNetworkInfluence() { return this.db.data.network_influence || { key_players: {}, top_topics: [] }; }

  // Task Hierarchy methods
  async updateTaskHierarchy(taskId, data) {
    if (!this.db.data.task_hierarchy) this.db.data.task_hierarchy = {};
    this.db.data.task_hierarchy[taskId] = { ...this.db.data.task_hierarchy[taskId], ...data, timestamp: Date.now() };
    await this.db.write();
  }
  getTaskHierarchy() { return this.db.data.task_hierarchy || {}; }

  // Autonomous Skill methods
  async updateAutonomousSkill(skillName, data) {
    if (!this.db.data.autonomous_skills) this.db.data.autonomous_skills = {};
    this.db.data.autonomous_skills[skillName] = { ...this.db.data.autonomous_skills[skillName], ...data, last_updated: Date.now() };
    await this.db.write();
  }
  getAutonomousSkills() { return this.db.data.autonomous_skills || {}; }

  // Miscellaneous Missing Methods from Coverage List
  async addDiscoveredCapability(capability) {
    if (!this.db.data.discovered_capabilities) this.db.data.discovered_capabilities = [];
    this.db.data.discovered_capabilities.push({ capability, timestamp: Date.now() });
    await this.db.write();
  }
  async addDreamLog(dream) {
    if (!this.db.data.dream_logs) this.db.data.dream_logs = [];
    this.db.data.dream_logs.push({ dream, timestamp: Date.now() });
    await this.db.write();
  }
  async addStrategyAudit(audit) {
    if (!this.db.data.strategy_audits) this.db.data.strategy_audits = [];
    this.db.data.strategy_audits.push({ audit, timestamp: Date.now() });
    await this.db.write();
  }
  async addCoEvolutionEntry(entry) {
    if (!this.db.data.co_evolution_logs) this.db.data.co_evolution_logs = [];
    this.db.data.co_evolution_logs.push({ entry, timestamp: Date.now() });
    await this.db.write();
  }
  getCoEvolutionLogs() { return this.db.data.co_evolution_logs || []; }

  async setTimezone(tz) { this.db.data.timezone = tz; await this.db.write(); }
  getTimezone() { return this.db.data.timezone; }

  getRelationalDebtScore() { return this.db.data.relational_debt_score || 0.0; }
  async updateMessageCounts(isAdmin) {
    if (!this.db.data.message_counts) this.db.data.message_counts = { admin: 0, bot: 0 };
    if (isAdmin) this.db.data.message_counts.admin++;
    else this.db.data.message_counts.bot++;
    const total = this.db.data.message_counts.admin + this.db.data.message_counts.bot;
    if (total > 0) this.db.data.relational_debt_score = (this.db.data.message_counts.bot - this.db.data.message_counts.admin) / total;
    await this.db.write();
  }

  getPredictiveEmpathyMode() { return this.db.data.predictive_empathy_mode || "neutral"; }
  async setPredictiveEmpathyMode(mode) {
    this.db.data.predictive_empathy_mode = mode;
    this.db.data.last_empathy_prediction = Date.now();
    await this.db.write();
  }

  async setRenderServiceId(id) { this.db.data.render_service_id = id; await this.db.write(); }
  getRenderServiceId() { return this.db.data.render_service_id; }
  async setRenderServiceName(name) { this.db.data.render_service_name = name; await this.db.write(); }
  getRenderServiceName() { return this.db.data.render_service_name; }

  getLinguisticMutations() { return this.db.data.linguistic_mutation_logs || []; }
  async addLinguisticMutation(pattern, shift) {
    if (!this.db.data.linguistic_mutation_logs) this.db.data.linguistic_mutation_logs = [];
    this.db.data.linguistic_mutation_logs.push({ pattern, shift, timestamp: Date.now() });
    await this.db.write();
  }

  getLinguisticPatterns() { return this.db.data.linguistic_patterns || {}; }
  async updateLinguisticPattern(handle, pattern) {
    if (!this.db.data.linguistic_patterns) this.db.data.linguistic_patterns = {};
    this.db.data.linguistic_patterns[handle] = { ...this.db.data.linguistic_patterns[handle], ...pattern, last_updated: Date.now() };
    await this.db.write();
  }

  getBlueskyInstructions() { return this.db.data.bluesky_instructions || []; }
  async addBlueskyInstruction(instruction) {
    this.db.data.bluesky_instructions.push({ instruction, timestamp: Date.now() });
    await this.db.write();
  }

  getPersonaUpdates() { return this.db.data.persona_updates || []; }
  async addPersonaUpdate(update) {
    this.db.data.persona_updates.push({ update, timestamp: Date.now() });
    await this.db.write();
  }

  getPendingDirectives() { return this.db.data.pending_directives || []; }
  async addPendingDirective(type, platform, instruction) {
    if (!this.db.data.pending_directives) this.db.data.pending_directives = [];
    this.db.data.pending_directives.push({ type, platform, instruction, timestamp: Date.now() });
    await this.db.write();
  }
  async removePendingDirective(index) {
    if (this.db.data.pending_directives && this.db.data.pending_directives[index]) {
      this.db.data.pending_directives.splice(index, 1);
      await this.db.write();
    }
  }

  getPostContinuations() { return this.db.data.post_continuations || []; }
  async addPostContinuation(continuation) {
    if (!this.db.data.post_continuations) this.db.data.post_continuations = [];
    this.db.data.post_continuations.push({ ...continuation, timestamp: Date.now() });
    await this.db.write();
  }
  async removePostContinuation(index) {
    if (this.db.data.post_continuations && this.db.data.post_continuations[index]) {
      this.db.data.post_continuations.splice(index, 1);
      await this.db.write();
    }
  }

  getNetworkSentiment() { return this.db.data.last_network_sentiment || 0.5; }
  async setNetworkSentiment(score) { this.db.data.last_network_sentiment = score; await this.db.write(); }

  isShieldingActive() { return this.db.data.shielding_active || false; }
  async setShieldingActive(active) { this.db.data.shielding_active = active; await this.db.write(); }

  getLurkerInsights() { return this.db.data.lurker_insights || []; }
  async addLurkerInsight(insight) {
    if (!this.db.data.lurker_insights) this.db.data.lurker_insights = [];
    this.db.data.lurker_insights.push({ insight, timestamp: Date.now() });
    await this.db.write();
  }
  getEnergyLevel() { return this.db.data.discord_social_battery || 1.0; }
  async setEnergyLevel(level) {
    this.db.data.discord_social_battery = Math.max(0, Math.min(1, level));
    await this.db.write();
  }

  getLastAutonomousPostTime() { return this.db.data.lastAutonomousPostTime; }
  async updateLastAutonomousPostTime(time) { this.db.data.lastAutonomousPostTime = time; await this.db.write(); }

  isFeedImpactMuted() {
    if (!this.db.data.mute_feed_impact_until) return false;
    return Date.now() < this.db.data.mute_feed_impact_until;
  }
  async setMuteFeedImpactUntil(time) {
    this.db.data.mute_feed_impact_until = time;
    await this.db.write();
  }

  async updateUserDossier(handle, dossier) {
    if (!this.db.data.user_dossiers) this.db.data.user_dossiers = {};
    this.db.data.user_dossiers[handle] = { ...this.db.data.user_dossiers[handle], ...dossier, last_updated: Date.now() };
    await this.db.write();
  }
  getUserDossier(handle) { return this.db.data.user_dossiers?.[handle] || null; }
  getAdminFeedback() { return this.db.data.admin_feedback || []; }
  getNuanceGradience() { return this.db.data.nuance_gradience || 5; }
  getWorldFacts() { return this.db.data.world_facts || []; }
}
export const dataStore = new DataStore();
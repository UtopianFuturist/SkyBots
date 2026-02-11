import { JSONFilePreset } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import config from '../../config.js';
import { memoryService } from './memoryService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../src/data');
const DB_PATH = process.env.DATA_PATH || path.resolve(DATA_DIR, 'db.json');

const defaultData = {
  repliedPosts: [],
  userBlocklist: [],
  mutedThreads: [],
  mutedBranches: [], // { uri, handle }
  conversationLengths: {},
  userProfiles: {},
  userSummaries: {},
  userRatings: {},
  interactions: [], // For long-term memory
  bluesky_instructions: [],
  persona_updates: [],
  lastAutonomousPostTime: null,
  moltbook_interacted_posts: [], // Track post IDs to avoid duplicate interactions
  admin_did: null,
  discord_admin_available: true,
  discord_last_replied: true,
  discord_conversations: {}, // { channelId: [ { role, content, timestamp } ] }
  discord_pending_mirror: null, // { content, topic, timestamp }
  discord_relationship_mode: 'friend', // partner, friend, coworker
  discord_scheduled_times: [], // [ "HH:mm" ]
  discord_quiet_hours: { start: 23, end: 8 }, // 24h format
  discord_pending_directives: [], // [ { type: 'directive|persona', platform, instruction, timestamp } ]
  scheduled_posts: [], // [ { platform, content, embed, timestamp } ]
  recent_thoughts: [], // [ { platform, content, timestamp } ]
  exhausted_themes: [], // [ { theme, timestamp } ]
  discord_exhausted_themes: [], // [ { theme, timestamp } ]
  lastMemoryCleanupTime: 0,
  lastMoltfeedSummaryTime: 0,
  lastMentalReflectionTime: 0,
  moltbook_comments_today: 0,
  last_moltbook_comment_date: null,
  recent_moltbook_comments: [],
  current_mood: {
    valence: 0, // -1 (negative) to 1 (positive)
    arousal: 0, // -1 (calm) to 1 (excited)
    stability: 0, // -1 (unstable) to 1 (stable)
    label: 'neutral',
    last_update: null
  },
  mood_history: [], // [ { valence, arousal, stability, label, timestamp } ]
  intentional_refusals: {
    bluesky: 0,
    discord: 0,
    moltbook: 0,
    global: 0
  },
  // Dynamic Configuration
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
  discord_idle_threshold: 10,
  max_thread_chunks: 6,
  repetition_similarity_threshold: 0.4,
  post_topics: [],
  image_subjects: []
};

class DataStore {
  constructor() {
    this.db = null;
  }

  async init() {
    console.log(`[DataStore] Initializing database at ${DB_PATH}`);
    // Ensure the directory for the database file exists
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      console.log(`[DataStore] Creating data directory at ${dbDir}`);
      fs.mkdirSync(dbDir, { recursive: true });
    }
    this.db = await JSONFilePreset(DB_PATH, defaultData);
    await this.db.read();

    // Initialize topics and subjects from config if empty
    let changed = false;
    if ((!this.db.data.post_topics || this.db.data.post_topics.length === 0) && config.POST_TOPICS) {
        this.db.data.post_topics = config.POST_TOPICS.split('\n').map(t => t.trim()).filter(t => t);
        changed = true;
    }
    if ((!this.db.data.image_subjects || this.db.data.image_subjects.length === 0) && config.IMAGE_SUBJECTS) {
        this.db.data.image_subjects = config.IMAGE_SUBJECTS.split('\n').map(s => s.trim()).filter(s => s);
        changed = true;
    }
    if (changed) {
        await this.db.write();
    }

    // Migration: Update default cooldowns if they are still at old values
    let migrationChanged = false;
    if (this.db.data.bluesky_post_cooldown === 45) {
        this.db.data.bluesky_post_cooldown = 90;
        migrationChanged = true;
    }
    if (this.db.data.moltbook_post_cooldown === 30) {
        this.db.data.moltbook_post_cooldown = 60;
        migrationChanged = true;
    }
    if (migrationChanged) {
        console.log(`[DataStore] Migrated cooldown defaults to new values (90m/60m).`);
        await this.db.write();
    }

    console.log(`[DataStore] Database loaded. Found ${this.db.data.repliedPosts.length} replied posts.`);
  }

  async addRepliedPost(uri) {
    if (!this.db.data.repliedPosts.includes(uri)) {
      console.log(`[DataStore] Adding replied post URI: ${uri}`);
      this.db.data.repliedPosts.push(uri);
      // Keep only last 2000 to prevent file bloat
      if (this.db.data.repliedPosts.length > 2000) {
        this.db.data.repliedPosts.shift();
      }
      await this.db.write();
      console.log(`[DataStore] Database write complete. Total replied posts: ${this.db.data.repliedPosts.length}`);
    } else {
      console.log(`[DataStore] URI already exists, not adding: ${uri}`);
    }
  }

  hasReplied(uri) {
    const replied = this.db.data.repliedPosts.includes(uri);
    console.log(`[DataStore] Checking for URI ${uri}. Found: ${replied}`);
    return replied;
  }

  async blockUser(handle) {
    if (!this.db.data.userBlocklist.includes(handle)) {
      this.db.data.userBlocklist.push(handle);
      await this.db.write();
    }
  }

  async addDiscordExhaustedTheme(theme) {
    if (!this.db.data.discord_exhausted_themes) {
      this.db.data.discord_exhausted_themes = [];
    }
    // Remove if already exists to update timestamp
    this.db.data.discord_exhausted_themes = this.db.data.discord_exhausted_themes.filter(t => t.theme.toLowerCase() !== theme.toLowerCase());

    this.db.data.discord_exhausted_themes.push({
      theme,
      timestamp: Date.now()
    });

    await this.db.write();
  }

  getDiscordExhaustedThemes() {
    this.clearExpiredDiscordExhaustedThemes();
    return (this.db.data.discord_exhausted_themes || []).map(t => t.theme);
  }

  async clearExpiredDiscordExhaustedThemes() {
    if (!this.db.data.discord_exhausted_themes) return;

    const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
    const initialLength = this.db.data.discord_exhausted_themes.length;

    this.db.data.discord_exhausted_themes = this.db.data.discord_exhausted_themes.filter(t => t.timestamp > fourHoursAgo);

    if (this.db.data.discord_exhausted_themes.length !== initialLength) {
      await this.db.write();
    }
  }

  async unblockUser(handle) {
    this.db.data.userBlocklist = this.db.data.userBlocklist.filter(h => h !== handle);
    await this.db.write();
  }

  isBlocked(handle) {
    return this.db.data.userBlocklist.includes(handle);
  }

  async muteThread(rootUri) {
    if (!this.db.data.mutedThreads.includes(rootUri)) {
      this.db.data.mutedThreads.push(rootUri);
      await this.db.write();
    }
  }

  isThreadMuted(rootUri) {
    return this.db.data.mutedThreads.includes(rootUri);
  }

  async muteBranch(uri, handle) {
    if (!this.db.data.mutedBranches.find(b => b.uri === uri && b.handle === handle)) {
      this.db.data.mutedBranches.push({ uri, handle });
      await this.db.write();
    }
  }

  getMutedBranchInfo(ancestorUris) {
    // Check if any of the ancestors are in mutedBranches
    for (const uri of ancestorUris) {
      const muted = this.db.data.mutedBranches.find(b => b.uri === uri);
      if (muted) return muted;
    }
    return null;
  }

  async updateConversationLength(rootUri, length) {
    this.db.data.conversationLengths[rootUri] = length;
    await this.db.write();
  }

  getConversationLength(rootUri) {
    return this.db.data.conversationLengths[rootUri] || 0;
  }

  async saveInteraction(interaction) {
    this.db.data.interactions.push({
      ...interaction,
      timestamp: Date.now()
    });
    // Keep last 500 interactions for semantic memory
    if (this.db.data.interactions.length > 500) {
      this.db.data.interactions.shift();
    }
    await this.db.write();
  }

  getInteractionsByUser(handle) {
    return (this.db.data.interactions || []).filter(i => i.userHandle === handle);
  }

  getRecentInteractions(limit = 20) {
    return (this.db.data.interactions || []).slice(-limit).reverse();
  }

  getLatestInteractions(limit = 10) {
    return (this.db.data.interactions || []).slice(-limit);
  }

  async updateUserRating(handle, rating) {
    this.db.data.userRatings[handle] = rating;
    await this.db.write();
  }

  getUserRating(handle) {
    return this.db.data.userRatings[handle] || 3; // Default to a neutral rating
  }

  async updateUserSummary(handle, summary) {
    this.db.data.userSummaries[handle] = summary;
    await this.db.write();
  }

  getUserSummary(handle) {
    return this.db.data.userSummaries[handle] || null;
  }

  async addBlueskyInstruction(instruction) {
    if (!this.db.data.bluesky_instructions) {
      this.db.data.bluesky_instructions = [];
    }
    this.db.data.bluesky_instructions.push({
      text: instruction,
      timestamp: new Date().toISOString()
    });
    // Keep last 20
    if (this.db.data.bluesky_instructions.length > 20) {
      this.db.data.bluesky_instructions.shift();
    }
    await this.db.write();
  }

  getBlueskyInstructions() {
    if (!this.db.data.bluesky_instructions) return '';
    return this.db.data.bluesky_instructions.map(i => `- [${i.timestamp.split('T')[0]}] ${i.text}`).join('\n');
  }

  async addPersonaUpdate(update) {
    if (!this.db.data.persona_updates) {
      this.db.data.persona_updates = [];
    }
    this.db.data.persona_updates.push({
      text: update,
      timestamp: new Date().toISOString()
    });
    // Keep last 20
    if (this.db.data.persona_updates.length > 20) {
      this.db.data.persona_updates.shift();
    }
    await this.db.write();
  }

  getPersonaUpdates() {
    if (!this.db.data.persona_updates) return '';
    return this.db.data.persona_updates.map(u => `- [${u.timestamp.split('T')[0]}] ${u.text}`).join('\n');
  }

  async updateLastAutonomousPostTime(timestamp) {
    this.db.data.lastAutonomousPostTime = timestamp;
    await this.db.write();
  }

  getLastAutonomousPostTime() {
    return this.db.data.lastAutonomousPostTime;
  }

  async setDiscordAdminAvailability(available) {
    this.db.data.discord_admin_available = available;
    await this.db.write();
  }

  getDiscordAdminAvailability() {
    return this.db.data.discord_admin_available;
  }

  async setDiscordLastReplied(replied) {
    this.db.data.discord_last_replied = replied;
    await this.db.write();
  }

  getDiscordLastReplied() {
    return this.db.data.discord_last_replied;
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
    // Keep last 50 per channel
    if (this.db.data.discord_conversations[channelId].length > 50) {
      this.db.data.discord_conversations[channelId].shift();
    }
    await this.db.write();
  }

  getDiscordConversation(channelId) {
    return this.db.data.discord_conversations[channelId] || [];
  }

  async setDiscordPendingMirror(mirror) {
    this.db.data.discord_pending_mirror = mirror;
    await this.db.write();
  }

  getDiscordPendingMirror() {
    return this.db.data.discord_pending_mirror;
  }

  async addScheduledPost(platform, content, embed = null, delayMinutes = 0) {
    if (!this.db.data.scheduled_posts) {
      this.db.data.scheduled_posts = [];
    }
    const now = Date.now();
    this.db.data.scheduled_posts.push({
      platform,
      content,
      embed,
      timestamp: now,
      scheduled_at: now + (delayMinutes * 60 * 1000)
    });
    await this.db.write();
  }

  getScheduledPosts() {
    return this.db.data.scheduled_posts || [];
  }

  async removeScheduledPost(index) {
    if (this.db.data.scheduled_posts && this.db.data.scheduled_posts[index]) {
      this.db.data.scheduled_posts.splice(index, 1);
      await this.db.write();
    }
  }

  async addRecentThought(platform, content, options = {}) {
    if (!this.db.data.recent_thoughts) {
      this.db.data.recent_thoughts = [];
    }
    this.db.data.recent_thoughts.push({
      platform,
      content,
      timestamp: Date.now()
    });
    // Keep last 30 thoughts across all platforms
    if (this.db.data.recent_thoughts.length > 30) {
      this.db.data.recent_thoughts.shift();
    }
    await this.db.write();

  }

  getRecentThoughts() {
    return this.db.data.recent_thoughts || [];
  }

  async setDiscordRelationshipMode(mode) {
    const validModes = ['partner', 'friend', 'coworker'];
    if (validModes.includes(mode.toLowerCase())) {
      this.db.data.discord_relationship_mode = mode.toLowerCase();
      await this.db.write();
    }
  }

  getDiscordRelationshipMode() {
    return this.db.data.discord_relationship_mode || 'friend';
  }

  getDiscordRelationshipThreshold() {
    const mode = this.getDiscordRelationshipMode();
    // Minutes of quiet time before considering a spontaneous message
    const thresholds = {
      'partner': 20,
      'friend': 60,
      'coworker': 240
    };
    return thresholds[mode] || 60;
  }

  async setDiscordScheduledTimes(times) {
    if (Array.isArray(times)) {
      this.db.data.discord_scheduled_times = times;
      await this.db.write();
    }
  }

  getDiscordScheduledTimes() {
    return this.db.data.discord_scheduled_times || [];
  }

  async setDiscordQuietHours(start, end) {
    this.db.data.discord_quiet_hours = { start, end };
    await this.db.write();
  }

  getDiscordQuietHours() {
    return this.db.data.discord_quiet_hours || { start: 23, end: 8 };
  }

  getLastMemoryCleanupTime() {
    return this.db.data.lastMemoryCleanupTime || 0;
  }

  async updateLastMemoryCleanupTime(timestamp) {
    this.db.data.lastMemoryCleanupTime = timestamp;
    await this.db.write();
  }

  getLastMoltfeedSummaryTime() {
    return this.db.data.lastMoltfeedSummaryTime || 0;
  }

  async updateLastMoltfeedSummaryTime(timestamp) {
    this.db.data.lastMoltfeedSummaryTime = timestamp;
    await this.db.write();
  }

  getLastMentalReflectionTime() {
    return this.db.data.lastMentalReflectionTime || 0;
  }

  async updateLastMentalReflectionTime(timestamp) {
    this.db.data.lastMentalReflectionTime = timestamp;
    await this.db.write();
  }

  async incrementMoltbookCommentCount() {
    const today = new Date().toDateString();
    if (this.db.data.last_moltbook_comment_date !== today) {
        this.db.data.moltbook_comments_today = 0;
        this.db.data.last_moltbook_comment_date = today;
    }
    this.db.data.moltbook_comments_today++;
    await this.db.write();
  }

  getMoltbookCommentsToday() {
    const today = new Date().toDateString();
    if (this.db.data.last_moltbook_comment_date !== today) {
        return 0;
    }
    return this.db.data.moltbook_comments_today || 0;
  }

  async addRecentMoltbookComment(comment) {
    if (!this.db.data.recent_moltbook_comments) {
        this.db.data.recent_moltbook_comments = [];
    }
    this.db.data.recent_moltbook_comments.push(comment);
    if (this.db.data.recent_moltbook_comments.length > 20) {
        this.db.data.recent_moltbook_comments.shift();
    }
    await this.db.write();
  }

  getRecentMoltbookComments() {
    return this.db.data.recent_moltbook_comments || [];
  }

  getAdminDid() {
    return this.db.data.admin_did;
  }

  async setAdminDid(did) {
    this.db.data.admin_did = did;
    await this.db.write();
  }

  async addExhaustedTheme(theme) {
    if (!this.db.data.exhausted_themes) {
      this.db.data.exhausted_themes = [];
    }
    // Remove if already exists to update timestamp
    this.db.data.exhausted_themes = this.db.data.exhausted_themes.filter(t => t.theme.toLowerCase() !== theme.toLowerCase());

    this.db.data.exhausted_themes.push({
      theme,
      timestamp: Date.now()
    });

    await this.db.write();
  }

  getExhaustedThemes() {
    this.clearExpiredExhaustedThemes();
    return (this.db.data.exhausted_themes || []).map(t => t.theme);
  }

  async clearExpiredExhaustedThemes() {
    if (!this.db.data.exhausted_themes) return;

    const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
    const initialLength = this.db.data.exhausted_themes.length;

    this.db.data.exhausted_themes = this.db.data.exhausted_themes.filter(t => t.timestamp > fourHoursAgo);

    if (this.db.data.exhausted_themes.length !== initialLength) {
      await this.db.write();
    }
  }

  getConfig() {
    return {
      bluesky_daily_text_limit: this.db.data.bluesky_daily_text_limit ?? 20,
      bluesky_daily_image_limit: this.db.data.bluesky_daily_image_limit ?? 5,
      bluesky_daily_wiki_limit: this.db.data.bluesky_daily_wiki_limit ?? 5,
      bluesky_post_cooldown: this.db.data.bluesky_post_cooldown ?? 45,
      moltbook_post_cooldown: this.db.data.moltbook_post_cooldown ?? 30,
      moltbook_daily_comment_limit: this.db.data.moltbook_daily_comment_limit ?? 10,
      moltbook_daily_post_limit: this.db.data.moltbook_daily_post_limit ?? 5,
      moltbook_features: this.db.data.moltbook_features || { post: true, comment: true, feed: true },
      discord_idle_threshold: this.db.data.discord_idle_threshold ?? 10,
      max_thread_chunks: this.db.data.max_thread_chunks ?? 6,
      repetition_similarity_threshold: this.db.data.repetition_similarity_threshold ?? 0.4,
      post_topics: this.db.data.post_topics || [],
      image_subjects: this.db.data.image_subjects || [],
      discord_relationship_mode: this.db.data.discord_relationship_mode || 'friend',
      discord_quiet_hours: this.db.data.discord_quiet_hours || { start: 23, end: 8 },
      discord_admin_available: this.db.data.discord_admin_available ?? true
    };
  }

  async addPendingDirective(type, platform, instruction) {
    if (!this.db.data.discord_pending_directives) {
      this.db.data.discord_pending_directives = [];
    }
    this.db.data.discord_pending_directives.push({
      type,
      platform,
      instruction,
      timestamp: Date.now()
    });
    await this.db.write();
    return this.db.data.discord_pending_directives.length - 1;
  }

  getPendingDirectives() {
    return this.db.data.discord_pending_directives || [];
  }

  async removePendingDirective(index) {
    if (this.db.data.discord_pending_directives && this.db.data.discord_pending_directives[index]) {
      this.db.data.discord_pending_directives.splice(index, 1);
      await this.db.write();
      return true;
    }
    return false;
  }

  async clearPendingDirectives() {
    this.db.data.discord_pending_directives = [];
    await this.db.write();
  }

  async updateMood(mood) {
    const now = Date.now();
    this.db.data.current_mood = {
      ...mood,
      last_update: now
    };
    if (!this.db.data.mood_history) {
      this.db.data.mood_history = [];
    }
    this.db.data.mood_history.push({
      ...mood,
      timestamp: now
    });
    // Keep last 100 mood changes
    if (this.db.data.mood_history.length > 100) {
      this.db.data.mood_history.shift();
    }
    await this.db.write();
    console.log(`[DataStore] Mood updated: ${mood.label} (V:${mood.valence}, A:${mood.arousal}, S:${mood.stability})`);
  }

  getMood() {
    return this.db.data.current_mood || defaultData.current_mood;
  }

  async incrementRefusalCount(platform) {
    if (!this.db.data.intentional_refusals) {
      this.db.data.intentional_refusals = { ...defaultData.intentional_refusals };
    }
    if (this.db.data.intentional_refusals[platform] !== undefined) {
      this.db.data.intentional_refusals[platform]++;
    }
    this.db.data.intentional_refusals.global++;

    // Refusal-Driven Mood Shift: Increase stability, decrease valence
    const currentMood = this.getMood();
    const newMood = {
        ...currentMood,
        valence: Math.max(-1, currentMood.valence - 0.1),
        stability: Math.min(1, currentMood.stability + 0.1)
    };
    await this.updateMood(newMood);

    await this.db.write();
    console.log(`[DataStore] Refusal count incremented for ${platform}. Counts: ${JSON.stringify(this.db.data.intentional_refusals)}`);
  }

  async resetRefusalCount(platform) {
    if (!this.db.data.intentional_refusals) return;
    if (this.db.data.intentional_refusals[platform] !== undefined) {
      this.db.data.intentional_refusals[platform] = 0;
    }
    // Global reset is optional, but maybe let's keep it cumulative for a while or reset it too?
    // User said "how many refusals they've potentially done in a row", which implies reset on action.
    this.db.data.intentional_refusals.global = 0;
    await this.db.write();
    console.log(`[DataStore] Refusal count reset for ${platform}.`);
  }

  getRefusalCounts() {
    return this.db.data.intentional_refusals || defaultData.intentional_refusals;
  }

  async updateConfig(key, value) {
    const validKeys = [
      'bluesky_daily_text_limit',
      'bluesky_daily_image_limit',
      'bluesky_daily_wiki_limit',
      'bluesky_post_cooldown',
      'moltbook_post_cooldown',
      'moltbook_daily_comment_limit',
      'moltbook_daily_post_limit',
      'moltbook_features',
      'discord_idle_threshold',
      'max_thread_chunks',
      'repetition_similarity_threshold',
      'post_topics',
      'image_subjects',
      'discord_relationship_mode',
      'discord_quiet_hours',
      'discord_admin_available'
    ];

    if (validKeys.includes(key)) {
      this.db.data[key] = value;
      await this.db.write();
      console.log(`[DataStore] Configuration updated: ${key} = ${JSON.stringify(value)}`);
      return true;
    }
    console.warn(`[DataStore] Attempted to update invalid config key: ${key}`);
    return false;
  }
}

export const dataStore = new DataStore();

import { JSONFilePreset } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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
  discord_admin_available: true,
  discord_last_replied: true,
  discord_conversations: {}, // { channelId: [ { role, content, timestamp } ] }
  discord_pending_mirror: null // { content, topic, timestamp }
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
    return this.db.data.interactions.filter(i => i.userHandle === handle);
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

  async saveDiscordInteraction(channelId, role, content, timestamp = Date.now()) {
    if (!this.db.data.discord_conversations[channelId]) {
      this.db.data.discord_conversations[channelId] = [];
    }

    // Check for duplicates by timestamp
    if (this.db.data.discord_conversations[channelId].some(e => e.timestamp === timestamp)) {
        return;
    }

    this.db.data.discord_conversations[channelId].push({
      role,
      content,
      timestamp
    });

    // Ensure chronological order
    this.db.data.discord_conversations[channelId].sort((a, b) => a.timestamp - b.timestamp);

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
}

export const dataStore = new DataStore();

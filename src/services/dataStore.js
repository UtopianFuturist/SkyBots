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
  conversationLengths: {},
  userProfiles: {},
  userRatings: {},
  interactions: [] // For long-term memory
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
}

export const dataStore = new DataStore();

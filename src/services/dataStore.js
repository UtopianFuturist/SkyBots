import { JSONFilePreset } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../src/data/db.json');

const defaultData = {
  repliedPosts: [],
  userBlocklist: [],
  mutedThreads: [],
  conversationLengths: {},
  userProfiles: {},
  interactions: [] // For long-term memory
};

class DataStore {
  constructor() {
    this.db = null;
  }

  async init() {
    this.db = await JSONFilePreset(DB_PATH, defaultData);
    await this.db.read();
  }

  async addRepliedPost(uri) {
    if (!this.db.data.repliedPosts.includes(uri)) {
      this.db.data.repliedPosts.push(uri);
      // Keep only last 2000 to prevent file bloat
      if (this.db.data.repliedPosts.length > 2000) {
        this.db.data.repliedPosts.shift();
      }
      await this.db.write();
    }
  }

  hasReplied(uri) {
    return this.db.data.repliedPosts.includes(uri);
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
}

export const dataStore = new DataStore();

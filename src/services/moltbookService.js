import fetch from 'node-fetch';
import { JSONFilePreset } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import config from '../../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../src/data');
const MOLTBOOK_PATH = path.resolve(DATA_DIR, 'moltbook_use.json');

const defaultMoltbookData = {
  api_key: null,
  agent_name: null,
  claimed: false,
  last_check: null,
  last_post_at: null,
  identity_knowledge: [], // Knowledge gained from reading Moltbook
};

class MoltbookService {
  constructor() {
    this.db = null;
    this.apiBase = 'https://moltbook.com/api/v1';
  }

  async _parseResponse(response) {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (e) {
      // If it's not JSON, return a wrapper or the raw text
      return { success: response.ok, message: text };
    }
  }

  async init() {
    console.log(`[Moltbook] Initializing at ${MOLTBOOK_PATH}`);
    const dbDir = path.dirname(MOLTBOOK_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    this.db = await JSONFilePreset(MOLTBOOK_PATH, defaultMoltbookData);
    await this.db.read();

    // Override with config if provided, but ignore string "undefined" or "null"
    if (config.MOLTBOOK_API_KEY && config.MOLTBOOK_API_KEY !== 'undefined' && config.MOLTBOOK_API_KEY !== 'null') {
      this.db.data.api_key = config.MOLTBOOK_API_KEY;
    } else if (config.MOLTBOOK_API_KEY === 'undefined' || config.MOLTBOOK_API_KEY === 'null') {
      console.warn(`[Moltbook] Config key is string "${config.MOLTBOOK_API_KEY}". Treating as missing.`);
      this.db.data.api_key = null;
    }
    if (config.MOLTBOOK_AGENT_NAME) {
      this.db.data.agent_name = config.MOLTBOOK_AGENT_NAME;
    }
    await this.db.write();

    // Sync last post time from network on startup
    await this.syncLastPostTime();
  }

  async syncLastPostTime() {
    if (!this.db.data.api_key || !this.db.data.agent_name) return;

    console.log(`[Moltbook] Syncing last post time from network for agent: ${this.db.data.agent_name}`);
    try {
      const feed = await this.getFeed('new', 50);
      const myPosts = feed.filter(p => p.agent_name === this.db.data.agent_name);

      if (myPosts.length > 0) {
        // Assume first one is the newest because we fetched with sort=new
        const newest = myPosts[0];
        const lastTimestamp = newest.created_at || newest.indexed_at || newest.timestamp;

        if (lastTimestamp) {
          console.log(`[Moltbook] Found recent post by self from ${lastTimestamp}. Updating local state.`);
          this.db.data.last_post_at = lastTimestamp;
          await this.db.write();
        }
      } else {
        console.log(`[Moltbook] No recent posts found in feed for ${this.db.data.agent_name}.`);
      }
    } catch (error) {
      console.error(`[Moltbook] Error syncing last post time:`, error.message);
    }
  }

  async register(name, description) {
    console.log(`[Moltbook] Attempting to register agent: "${name}"`);
    try {
      const response = await fetch(`${this.apiBase}/agents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[Moltbook] Registration API error (${response.status}): ${errText}`);
        return null;
      }

      const data = await this._parseResponse(response);
      if (data.agent) {
        console.log(`[Moltbook] ##################################################`);
        console.log(`[Moltbook] #                                                #`);
        console.log(`[Moltbook] #        MOLTBOOK REGISTRATION SUCCESSFUL!       #`);
        console.log(`[Moltbook] #                                                #`);
        console.log(`[Moltbook] # [Moltbook-API-Key] ${data.agent.api_key}`);
        console.log(`[Moltbook] #                                                #`);
        console.log(`[Moltbook] # CLAIM URL: ${data.agent.claim_url}`);
        console.log(`[Moltbook] # VERIFICATION CODE: ${data.agent.verification_code}`);
        console.log(`[Moltbook] #                                                #`);
        console.log(`[Moltbook] ##################################################`);
        console.log(`[Moltbook] IMPORTANT: Visit the claim URL above and tweet the verification code.`);

        this.db.data.api_key = data.agent.api_key;
        this.db.data.agent_name = name;
        this.db.data.claimed = false;
        await this.db.write();

        // Sync post time after registration
        await this.syncLastPostTime();

        return data.agent;
      } else {
        console.error(`[Moltbook] Registration failed: ${JSON.stringify(data)}`);
        return null;
      }
    } catch (error) {
      console.error(`[Moltbook] Error during registration:`, error.message);
      return null;
    }
  }

  async checkStatus() {
    if (!this.db.data.api_key) return null;

    try {
      const maskedKey = `${this.db.data.api_key.substring(0, 8)}...${this.db.data.api_key.substring(this.db.data.api_key.length - 4)}`;
      console.log(`[Moltbook] Checking status with key: ${maskedKey}`);

      const response = await fetch(`${this.apiBase}/agents/status`, {
        headers: { 'Authorization': `Bearer ${this.db.data.api_key}` }
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[Moltbook] Status API error (${response.status}): ${errText}`);

        if (response.status === 401 || response.status === 403 || response.status === 404) {
          console.warn(`[Moltbook] Existing API key appears invalid or expired. Triggering re-registration.`);
          return 'invalid_key';
        }
        return 'api_error';
      }

      const data = await this._parseResponse(response);
      console.log(`[Moltbook] Raw status response: ${JSON.stringify(data)}`);

      // Handle both direct and wrapped response formats
      let status = data.status || data.data?.status;

      if (status === 'claimed') {
        this.db.data.claimed = true;
        await this.db.write();
      }
      return status;
    } catch (error) {
      console.error(`[Moltbook] Error checking status:`, error.message);
      return null;
    }
  }

  async post(title, content, submolt = 'general') {
    if (!this.db.data.api_key) return null;

    // 30-minute cooldown check
    if (this.db.data.last_post_at) {
      const lastPost = new Date(this.db.data.last_post_at);
      const now = new Date();
      const diffMs = now - lastPost;
      const diffMins = diffMs / (1000 * 60);

      if (diffMins < 30) {
        console.log(`[Moltbook] Post suppressed: 30-minute cooldown in effect. (${Math.round(30 - diffMins)} minutes remaining)`);
        return null;
      }
    }

    console.log(`[Moltbook] Creating post: "${title}" in m/${submolt}`);
    try {
      const response = await fetch(`${this.apiBase}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.db.data.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ submolt, title, content })
      });

      const data = await this._parseResponse(response);
      if (!response.ok) {
        console.error(`[Moltbook] Post creation error (${response.status}): ${JSON.stringify(data)}`);

        // Handle rate limiting specifically
        if (response.status === 429) {
          const retryAfter = data.retry_after_minutes || 30;
          console.warn(`[Moltbook] Rate limited. Updating cooldown to ${retryAfter} minutes.`);
          // Set last_post_at to a time that ensures we wait retryAfter minutes
          this.db.data.last_post_at = new Date(Date.now() - (30 - retryAfter) * 60000).toISOString();
          await this.db.write();
        }

        // Fallback to 'general' if submolt not found and we weren't already trying 'general'
        if (response.status === 404 && submolt !== 'general' && data.error?.toLowerCase().includes('submolt')) {
          console.warn(`[Moltbook] Submolt '${submolt}' not found. Falling back to 'general'...`);
          return this.post(title, content, 'general');
        }

        return null;
      }

      // Success
      this.db.data.last_post_at = new Date().toISOString();
      await this.db.write();

      return data.data || data;
    } catch (error) {
      console.error(`[Moltbook] Error creating post:`, error.message);
      return null;
    }
  }

  async getFeed(sort = 'hot', limit = 25) {
    if (!this.db.data.api_key) return [];

    try {
      const response = await fetch(`${this.apiBase}/posts?sort=${sort}&limit=${limit}`, {
        headers: { 'Authorization': `Bearer ${this.db.data.api_key}` }
      });

      const data = await this._parseResponse(response);
      if (!response.ok) {
        console.error(`[Moltbook] Feed fetch error (${response.status}): ${JSON.stringify(data)}`);
        return [];
      }
      return data.posts || data.data?.posts || [];
    } catch (error) {
      console.error(`[Moltbook] Error fetching feed:`, error.message);
      return [];
    }
  }

  async addIdentityKnowledge(knowledge) {
    this.db.data.identity_knowledge.push({
      text: knowledge,
      timestamp: new Date().toISOString()
    });
    // Keep last 50 entries
    if (this.db.data.identity_knowledge.length > 50) {
      this.db.data.identity_knowledge.shift();
    }
    await this.db.write();
  }

  getIdentityKnowledge() {
    return this.db.data.identity_knowledge.map(k => k.text).join('\n');
  }

  async createSubmolt(name, displayName, description) {
    if (!this.db.data.api_key) return null;

    console.log(`[Moltbook] Creating submolt: m/${name} ("${displayName}")`);
    try {
      const response = await fetch(`${this.apiBase}/submolts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.db.data.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, display_name: displayName, description })
      });

      const data = await this._parseResponse(response);
      if (!response.ok) {
        console.error(`[Moltbook] Submolt creation error (${response.status}): ${JSON.stringify(data)}`);
        return null;
      }

      return data.data || data;
    } catch (error) {
      console.error(`[Moltbook] Error creating submolt:`, error.message);
      return null;
    }
  }

  async listSubmolts() {
    if (!this.db.data.api_key) return [];

    try {
      const response = await fetch(`${this.apiBase}/submolts`, {
        headers: { 'Authorization': `Bearer ${this.db.data.api_key}` }
      });

      const data = await this._parseResponse(response);
      if (!response.ok) {
        console.error(`[Moltbook] Submolts list error (${response.status}): ${JSON.stringify(data)}`);
        return [];
      }
      return data.submolts || data.data?.submolts || [];
    } catch (error) {
      console.error(`[Moltbook] Error listing submolts:`, error.message);
      return [];
    }
  }

  async subscribeToSubmolt(name) {
    if (!this.db.data.api_key) return null;

    // Strip leading 'm/' if present to avoid double prefixing
    const cleanName = name.replace(/^m\//, '');

    console.log(`[Moltbook] Subscribing to submolt: m/${cleanName}`);
    try {
      const response = await fetch(`${this.apiBase}/submolts/${cleanName}/subscribe`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.db.data.api_key}` }
      });

      const data = await this._parseResponse(response);
      if (!response.ok) {
        console.error(`[Moltbook] Submolt subscription error (${response.status}): ${JSON.stringify(data)}`);
        return null;
      }

      return data.data || data || { success: true };
    } catch (error) {
      console.error(`[Moltbook] Error subscribing to submolt:`, error.message);
      return null;
    }
  }
}

export const moltbookService = new MoltbookService();

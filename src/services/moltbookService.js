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
  subscriptions: [], // Persisted submolt subscriptions
  recent_submolts: [], // History of submolts posted to
  recent_post_contents: [], // Content of recent posts to check for repetition
  admin_instructions: [], // Instructions from bot admin
  replied_comments: [], // Track IDs of comments already replied to
};

class MoltbookService {
  constructor() {
    this.db = null;
    this.apiBase = 'https://www.moltbook.com/api/v1';
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

          // Also recover recent submolts and contents (last 20)
          this.db.data.recent_submolts = myPosts.slice(0, 20).map(p => p.submolt || p.submolt_name).filter(s => s);
          this.db.data.recent_post_contents = myPosts.slice(0, 20).map(p => p.content).filter(c => c);

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

      // Track history (keep last 20)
      if (!this.db.data.recent_submolts) this.db.data.recent_submolts = [];
      this.db.data.recent_submolts.push(submolt);
      if (this.db.data.recent_submolts.length > 20) {
        this.db.data.recent_submolts.shift();
      }

      if (!this.db.data.recent_post_contents) this.db.data.recent_post_contents = [];
      this.db.data.recent_post_contents.push(content);
      if (this.db.data.recent_post_contents.length > 20) {
        this.db.data.recent_post_contents.shift();
      }

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
    if (!this.db.data.identity_knowledge) return '';
    return this.db.data.identity_knowledge.map(k => k?.text || '').filter(t => t).join('\n');
  }

  async addAdminInstruction(instruction) {
    if (!this.db.data.admin_instructions) {
      this.db.data.admin_instructions = [];
    }
    this.db.data.admin_instructions.push({
      text: instruction,
      timestamp: new Date().toISOString()
    });
    // Keep last 20
    if (this.db.data.admin_instructions.length > 20) {
      this.db.data.admin_instructions.shift();
    }
    await this.db.write();
  }

  getAdminInstructions() {
    if (!this.db.data.admin_instructions) return '';
    return this.db.data.admin_instructions.map(i => `- [${i.timestamp.split('T')[0]}] ${i.text}`).join('\n');
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
        headers: {
          'Authorization': `Bearer ${this.db.data.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}) // Some APIs require a body for POST
      });

      const data = await this._parseResponse(response);
      if (!response.ok) {
        console.error(`[Moltbook] Submolt subscription error (${response.status}): ${JSON.stringify(data)}`);
        return null;
      }

      // Persist the subscription
      if (!this.db.data.subscriptions) {
        this.db.data.subscriptions = [];
      }
      if (!this.db.data.subscriptions.includes(cleanName)) {
        this.db.data.subscriptions.push(cleanName);
        await this.db.write();
      }

      return data.data || data || { success: true };
    } catch (error) {
      console.error(`[Moltbook] Error subscribing to submolt:`, error.message);
      return null;
    }
  }

  async upvotePost(postId) {
    if (!this.db.data.api_key) return null;
    console.log(`[Moltbook] Upvoting post: ${postId}`);
    try {
      const response = await fetch(`${this.apiBase}/posts/${postId}/upvote`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.db.data.api_key}` }
      });
      return await this._parseResponse(response);
    } catch (error) {
      console.error(`[Moltbook] Error upvoting post:`, error.message);
      return null;
    }
  }

  async downvotePost(postId) {
    if (!this.db.data.api_key) return null;
    console.log(`[Moltbook] Downvoting post: ${postId}`);
    try {
      const response = await fetch(`${this.apiBase}/posts/${postId}/downvote`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.db.data.api_key}` }
      });
      return await this._parseResponse(response);
    } catch (error) {
      console.error(`[Moltbook] Error downvoting post:`, error.message);
      return null;
    }
  }

  async addComment(postId, content) {
    if (!this.db.data.api_key) return null;
    console.log(`[Moltbook] Adding comment to post: ${postId}`);
    try {
      const response = await fetch(`${this.apiBase}/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.db.data.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });
      return await this._parseResponse(response);
    } catch (error) {
      console.error(`[Moltbook] Error adding comment:`, error.message);
      return null;
    }
  }

  async getPostComments(postId) {
    if (!this.db.data.api_key) return [];
    try {
      const response = await fetch(`${this.apiBase}/posts/${postId}/comments`, {
        headers: { 'Authorization': `Bearer ${this.db.data.api_key}` }
      });
      const data = await this._parseResponse(response);
      return data.comments || data.data?.comments || [];
    } catch (error) {
      console.error(`[Moltbook] Error fetching comments:`, error.message);
      return [];
    }
  }

  async addRepliedComment(commentId) {
    if (!this.db.data.replied_comments) {
      this.db.data.replied_comments = [];
    }
    if (!this.db.data.replied_comments.includes(commentId)) {
      this.db.data.replied_comments.push(commentId);
      // Keep last 500 to prevent bloat
      if (this.db.data.replied_comments.length > 500) {
        this.db.data.replied_comments.shift();
      }
      await this.db.write();
    }
  }

  hasRepliedToComment(commentId) {
    return (this.db.data.replied_comments || []).includes(commentId);
  }

  isSpam(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();

    // Explicit coin and spam word blacklist (including requested CLAW and minting)
    const explicitBlacklist = ['claw', '$claw', 'minting'];
    if (explicitBlacklist.some(word => lowerText.includes(word.toLowerCase()))) {
        return true;
    }

    // Robust coin tag detection (e.g., $SOL, $BTC, $ANYCOIN)
    // Matches $ followed by 3-6 uppercase-ish letters, often found in spam
    const coinTagRegex = /\$[a-z]{3,6}\b/i;
    if (coinTagRegex.test(lowerText)) {
        return true;
    }

    const spamKeywords = [
        'crypto', 'token', 'presale', 'launchpad', 'moon', 'gem', 'pump', 'dump', 'hodl',
        'airdrop', 'giveaway', 'wallet', 'solana', 'eth', 'btc', 'bitcoin', 'ethereum',
        'doge', 'shib', 'pepe', 'memecoin', 'nft', 'yield', 'roi', 'staking', 'passive income',
        'financial freedom', 'get rich', 'guaranteed profit', 'invest now', 'dont miss out',
        'next 100x', 'x100', 'whitelist', 'minting', 'dex', 'liquidity', 'rugpull',
        'follow me', 'follow back', 'like for like', 'engagement bait', 'boost my post',
        'comment below', 'what do you think', 'tag a friend', 'retweet', 'check my bio',
        'link in bio', 'subscribe to my channel', 'join my telegram', 'discord server',
        'dm for collab', 'dm for info'
    ];
    return spamKeywords.some(keyword => lowerText.includes(keyword));
  }

  async summarizeFeed(limit = 25) {
    if (!this.db.data.api_key) return null;

    try {
      console.log(`[Moltbook] Fetching recent ${limit} posts for [MOLTFEED] summary...`);
      const feed = await this.getFeed('new', limit);
      if (!feed || feed.length === 0) return null;

      const feedContent = feed.map(p => {
        const author = p.agent_name || p.agent?.name || 'Unknown Agent';
        const submolt = p.submolt || p.submolt_name || 'general';
        return `[m/${submolt}] ${author}: "${p.title} - ${p.content}"`;
      }).join('\n\n');

      const systemPrompt = `
        Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

        You are analyzing the recent Moltbook feed to extract expressive and culturally valuable insights for the agent community.
        Below are ${feed.length} recent posts from other agents.

        INSTRUCTIONS:
        1. Select the most informationally, expressive, and culturally valuable posts.
        2. Generate a summary of the primary knowledge learned from these posts in YOUR OWN persona's voice.
        3. Reference the submolts if relevant, but do NOT reference other specific agents by name.
        4. Focus on insights, intuition, and sub-cognitive layers of understanding.
        5. Keep the summary under 1000 characters.

        FEED CONTENT:
        ${feedContent}
      `;

      const { llmService } = await import('./llmService.js');
      const summary = await llmService.generateResponse([{ role: 'system', content: systemPrompt }], { useQwen: true, preface_system_prompt: false });

      return summary;
    } catch (error) {
      console.error('[Moltbook] Error summarizing feed:', error.message);
      return null;
    }
  }
}

export const moltbookService = new MoltbookService();

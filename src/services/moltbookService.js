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
  identity_knowledge: [], // Knowledge gained from reading Moltbook
};

class MoltbookService {
  constructor() {
    this.db = null;
    this.apiBase = 'https://moltbook.com/api/v1';
  }

  async init() {
    console.log(`[Moltbook] Initializing at ${MOLTBOOK_PATH}`);
    const dbDir = path.dirname(MOLTBOOK_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    this.db = await JSONFilePreset(MOLTBOOK_PATH, defaultMoltbookData);
    await this.db.read();

    // Override with config if provided
    if (config.MOLTBOOK_API_KEY) {
      this.db.data.api_key = config.MOLTBOOK_API_KEY;
    }
    if (config.MOLTBOOK_AGENT_NAME) {
      this.db.data.agent_name = config.MOLTBOOK_AGENT_NAME;
    }
    await this.db.write();
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

      const data = await response.json();
      if (data.agent) {
        console.log(`[Moltbook] ==========================================`);
        console.log(`[Moltbook] REGISTRATION SUCCESSFUL!`);
        console.log(`[Moltbook] API KEY: ${data.agent.api_key}`);
        console.log(`[Moltbook] CLAIM URL: ${data.agent.claim_url}`);
        console.log(`[Moltbook] VERIFICATION CODE: ${data.agent.verification_code}`);
        console.log(`[Moltbook] ==========================================`);
        console.log(`[Moltbook] IMPORTANT: Visit the claim URL above and tweet the verification code.`);

        this.db.data.api_key = data.agent.api_key;
        this.db.data.agent_name = name;
        this.db.data.claimed = false;
        await this.db.write();
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
      const response = await fetch(`${this.apiBase}/agents/status`, {
        headers: { 'Authorization': `Bearer ${this.db.data.api_key}` }
      });
      const data = await response.json();
      if (data.status === 'claimed') {
        this.db.data.claimed = true;
        await this.db.write();
      }
      return data.status;
    } catch (error) {
      console.error(`[Moltbook] Error checking status:`, error.message);
      return null;
    }
  }

  async post(title, content, submolt = 'general') {
    if (!this.db.data.api_key) return null;

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
      const data = await response.json();
      return data;
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
      const data = await response.json();
      return data.posts || [];
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
}

export const moltbookService = new MoltbookService();

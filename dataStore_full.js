import { JSONFilePreset } from 'lowdb/node';
import path from 'path';
import config from '../../config.js';

class DataStore {
  constructor() {
    this.db = null;
    this.dbPath = path.resolve(process.cwd(), 'src/data/db.json');
  }

  async init() {
    const defaultData = {
      internal_logs: [],
      current_mood: { label: 'balanced', score: 0.5 },
      post_topics: (config.POST_TOPICS || '').split(',').filter(Boolean),
      image_subjects: (config.IMAGE_SUBJECTS || '').split(',').filter(Boolean),
      current_goal: { goal: "Existence", description: "Default goal", timestamp: Date.now() },
      interactions: [],
      relationship_warmth: 0.5,
      admin_energy: 0.8,
      last_autonomous_post_time: 0,
      discord_last_interaction: 0,
      last_notification_processed_at: 0,
      refusal_logs: [],
      user_portraits: {},
      world_facts: [],
      parked_thoughts: [],
      growth_log: [],
      self_model: [],
      positions: {},
      persona_blurbs: [],
      session_lessons: [],
      exhausted_themes: [],
      boundary_lockouts: {},
      network_sentiment: 0.5,
      agency_logs: [],
      firehose_matches: [],
      recent_thoughts: []
    };
    this.db = await JSONFilePreset(this.dbPath, defaultData);
  }

  async write() { await this.db.write(); }

  getConfig() { return this.db.data; }
  async updateConfig(c) { Object.assign(this.db.data, c); await this.write(); }

  async addInternalLog(type, content) {
    this.db.data.internal_logs.push({ type, content, timestamp: Date.now() });
    if (this.db.data.internal_logs.length > 500) this.db.data.internal_logs.shift();
    await this.write();
  }

  getMood() { return this.db.data.current_mood; }
  async setMood(m) { this.db.data.current_mood = m; await this.write(); }

  getAdminEnergy() { return this.db.data.admin_energy; }
  async setAdminEnergy(v) { this.db.data.admin_energy = v; await this.write(); }

  getLastAutonomousPostTime() { return this.db.data.last_autonomous_post_time; }
  async updateLastAutonomousPostTime(t) { this.db.data.last_autonomous_post_time = t; await this.write(); }

  getPersonaBlurbs() { return this.db.data.persona_blurbs || []; }
  async setPersonaBlurbs(b) { this.db.data.persona_blurbs = b; await this.write(); }
  async addPersonaBlurb(text) { this.db.data.persona_blurbs.push({ text, uri: 'local-' + Date.now() }); await this.write(); }

  getSessionLessons() { return this.db.data.session_lessons || []; }

  async addWorldFact(fact) {
    this.db.data.world_facts.push({ ...fact, timestamp: Date.now() });
    if (this.db.data.world_facts.length > 50) this.db.data.world_facts.shift();
    await this.write();
  }

  async addParkedThought(text) {
    this.db.data.parked_thoughts.push({ text, timestamp: Date.now() });
    if (this.db.data.parked_thoughts.length > 20) this.db.data.parked_thoughts.shift();
    await this.write();
  }

  async updateUserPortrait(handle, portrait) {
    this.db.data.user_portraits[handle] = { ...portrait, updatedAt: Date.now() };
    await this.write();
  }

  async applyRelationalDecay() {
    this.db.data.relationship_warmth *= 0.95;
    await this.write();
  }

  async updateSelfModel(insight) {
    this.db.data.self_model.push({ insight, timestamp: Date.now() });
    if (this.db.data.self_model.length > 20) this.db.data.self_model.shift();
    await this.write();
  }

  async updatePosition(topic, stance) {
    this.db.data.positions[topic] = { stance, updatedAt: Date.now() };
    await this.write();
  }

  getPositions() { return this.db.data.positions || {}; }
  getRecentInteractions() { return this.db.data.interactions || []; }
  isResting() { return false; }
  getExhaustedThemes() { return this.db.data.exhausted_themes || []; }
  async addExhaustedTheme(t) { this.db.data.exhausted_themes.push(t); await this.write(); }

  isUserLockedOut(did) {
    const lockout = this.db.data.boundary_lockouts[did];
    return lockout && lockout.expires_at > Date.now();
  }
  async setBoundaryLockout(did, mins) {
    this.db.data.boundary_lockouts[did] = { expires_at: Date.now() + mins * 60000 };
    await this.write();
  }
  getNetworkSentiment() { return this.db.data.network_sentiment || 0.5; }
  getFirehoseMatches() { return this.db.data.firehose_matches || []; }
}

export const dataStore = new DataStore();

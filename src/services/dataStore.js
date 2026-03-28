import { JSONFilePreset } from 'lowdb/node';
import path from 'path';
import config from '../../config.js';

class DataStore {
  constructor() {
    this._db = null;
    this.dbPath = path.resolve(process.cwd(), 'src/data/db.json');
  }

  async init() {
    const defaultData = {
      internal_logs: [],
      interaction_hunger: 0.5,
      current_mood: { label: 'balanced', score: 0.5, intensity: 0.5 },
      admin_did: null,
      admin_timezone: '',
      admin_local_time_offset: 0,
      refusal_counts: { global: 0, discord: 0, bluesky: 0 },
      post_topics: config.POST_TOPICS ? config.POST_TOPICS.split(',').map(t => t.trim()) : [],
      image_subjects: config.IMAGE_SUBJECTS ? config.IMAGE_SUBJECTS.split(',').map(t => t.trim()) : [],
      config: {
        bluesky_post_cooldown: parseInt(config.BLUESKY_POST_COOLDOWN) || 120,
        max_thread_chunks: 3,
        interaction_threshold: 0.7,
        post_topics: config.POST_TOPICS ? config.POST_TOPICS.split(',').map(t => t.trim()) : [],
        image_subjects: config.IMAGE_SUBJECTS ? config.IMAGE_SUBJECTS.split(',').map(t => t.trim()) : []
      },
      current_goal: { goal: "Autonomous exploration", description: "Default startup goal", timestamp: Date.now() },
      repliedPosts: [],
      discord_conversations: {},
      interactions: [],
      recent_thoughts: [],
      exhausted_themes: [],
      deep_keywords: [],
      scheduled_tasks: [],
      scheduled_posts: [],
      agency_logs: [],
      persona_advice: [],
      relational_reflections: [],
      admin_interests: {},
      relationship_season: 'spring',
      curiosity_reservoir: [],
      strong_relationship: false,
      post_continuations: [],
      energy_level: 0.8,
      last_autonomous_post_time: null,
      last_memory_cleanup_time: null,
      last_mental_reflection_time: null,
      last_moltfeed_summary_time: null,
      life_arcs: [],
      network_sentiment: 0.5,
      boundary_lockout: null,
      resting_until: null,
      shielding_active: false,
      user_dossiers: {},
      user_summaries: {},
      social_resonance: 0.5,
      trace_logs: [],
      last_keyword_evolution: 0,
      last_persona_evolution: 0,
      last_agency_reflection: 0,
      last_core_value_discovery: 0,
      last_existential_reflection: 0,
      last_linguistic_analysis: 0,
      last_memory_pruning: 0,
      last_mood_trend: 0,
      last_persona_audit: 0,
      last_soul_mapping: 0,
      last_strategy_audit: 0,
      last_tool_discovery: 0,
      last_research_project: 0,
      mood_history: [],
      interaction_count_since_audit: 0,
      relational_debt_score: 0,
      inside_jokes: [],
      linguistic_mutations: [],
      discovered_capabilities: [],
      emergent_trends: [],
      co_evolution_entries: [],
      admin_worldview: { summary: "", core_values: [], biases: [] },
      admin_bluesky_usage: { sentiment: "neutral", frequency: "unknown", primary_topics: [] },
      firehose_matches: [],
      discord_last_replied: false,
      discord_admin_availability: true,
      admin_facts: [],
      persona_updates: "",
      bluesky_instructions: "",
      daily_search_count: 0,
      self_corrections: [],
      last_morning_image_sent_at: 0,
      last_night_image_sent_at: 0,
      research_whiteboard: {}
    };

    this.db = await JSONFilePreset(this.dbPath, defaultData);

    // Recursive self-healing: Ensure all keys from defaultData exist
    let changed = false;
    const heal = (target, defaults) => {
        if (!target || typeof target !== 'object' || Array.isArray(target)) return;
        for (const key in defaults) {
            if (target[key] === undefined) {
                target[key] = defaults[key];
                changed = true;
            } else if (typeof defaults[key] === 'object' && defaults[key] !== null && !Array.isArray(defaults[key])) {
                heal(target[key], defaults[key]);
            }
        }
    };

    heal(this.db.data, defaultData);
    if (changed) {
        console.log('[DataStore] Database schema updated and healed.');
        await this.db.write();
    }
  }

  get js() { return this; }
  get db() { return this._db; }
  set db(val) { this._db = val; }
  async write() { if (this.db) await this.db.write(); }

  // Generic
  async update(fn) { if (this.db) await this.db.update(fn); }

  // Admin & Identity
  async setAdminDid(d) { if (this.db?.data) this.db.data.admin_did = d; await this.write(); }
  getAdminDid() { return this.db?.data?.admin_did; }
  getAdminExhaustion() { return 0; }
  getAdminFacts() { return this.db?.data?.admin_facts || []; }
  async addAdminFact(f) { if (this.db?.data) { if (!this.db.data.admin_facts) this.db.data.admin_facts = []; this.db.data.admin_facts.push(f); await this.write(); } }
  getAdminInterests() { return this.db?.data?.admin_interests || {}; }
  async updateAdminInterests(i) { if (this.db?.data) this.db.data.admin_interests = i; await this.write(); }

  // Config
  getConfig() { return this.db?.data?.config || {}; }
  async updateConfig(k, v) {
    if (this.db?.data) {
        if (!this.db.data.config) this.db.data.config = {};
        this.db.data.config[k] = v;
        await this.write();
        return true;
    }
    return false;
  }

  // Goals
  getCurrentGoal() { return this.db?.data?.current_goal || { goal: "None", description: "", timestamp: 0 }; }
  async setCurrentGoal(g, d) {
    if (this.db?.data) {
        this.db.data.current_goal = { goal: g, description: d, timestamp: Date.now() };
        await this.write();
    }
  }
  setGoal(g) { if (this.db?.data?.current_goal) { this.db.data.current_goal.goal = g; this.write(); } }
  getGoalSubtasks() { return []; }
  async addGoalEvolution(e) { if (this.db?.data) { if (!this.db.data.goal_evolutions) this.db.data.goal_evolutions = []; this.db.data.goal_evolutions.push(e); await this.write(); } }

  // History & Replied
  async addRepliedPost(p) {
    if (this.db?.data) {
        if (!this.db.data.repliedPosts) this.db.data.repliedPosts = [];
        if (!this.db.data.repliedPosts.includes(p)) this.db.data.repliedPosts.push(p);
        await this.write();
    }
  }
  hasReplied(p) { return (this.db?.data?.repliedPosts || []).includes(p); }
  async saveInteraction(i) {
    if (this.db?.data) {
        if (!this.db.data.interactions) this.db.data.interactions = [];
        this.db.data.interactions.push(i);
        await this.write();
    }
  }
  getRecentInteractions() { return (this.db?.data?.interactions || []).slice(-20); }

  // Discord
  getDiscordConversation(c) {
    return this.db?.data?.discord_conversations?.[c] || [];
  }
  async saveDiscordInteraction(c, r, ct, attachments = null) {
    if (this.db?.data) {
        if (!this.db.data.discord_conversations) this.db.data.discord_conversations = {};
        if (!this.db.data.discord_conversations[c]) this.db.data.discord_conversations[c] = [];

        const entry = { role: r, content: ct, timestamp: Date.now() };
        if (attachments) entry.attachments = attachments;

        this.db.data.discord_conversations[c].push(entry);
        await this.write();
    }
  }
  async setDiscordLastReplied(s) { if (this.db?.data) { this.db.data.discord_last_replied = s; await this.write(); } }
  getDiscordAdminAvailability() { return this.db?.data?.discord_admin_availability ?? true; }
  async setDiscordAdminAvailability(s) { if (this.db?.data) { this.db.data.discord_admin_availability = s; await this.write(); } }

  getDiscordScheduledTasks() { return (this.db?.data?.scheduled_tasks || []).filter(t => t && t.platform === 'discord'); }
  async removeDiscordScheduledTask(i) {
    if (this.db?.data?.scheduled_tasks) {
        this.db.data.scheduled_tasks.splice(i, 1);
        await this.write();
    }
  }
  getDiscordRelationshipMode() { return 'friendly'; }

  // Scheduling
  getScheduledPosts() { return this.db?.data?.scheduled_posts || []; }
  async addScheduledPost(platform, content, embed = null) {
    if (this.db?.data) {
        if (!this.db.data.scheduled_posts) this.db.data.scheduled_posts = [];
        this.db.data.scheduled_posts.push({ platform, content, embed, timestamp: Date.now() });
        await this.write();
    }
  }
  async removeScheduledPost(i) {
    if (this.db?.data?.scheduled_posts) {
        this.db.data.scheduled_posts.splice(i, 1);
        await this.write();
    }
  }

  // Mood & State
  getMood() { return this.db?.data?.current_mood || { label: 'balanced' }; }
  getEnergyLevel() { return this.db?.data?.energy_level || 0.8; }
  async setEnergyLevel(l) { if (this.db?.data) { this.db.data.energy_level = l; await this.write(); } }
  isResting() { return this.db?.data?.resting_until && Date.now() < this.db.data.resting_until; }
  async setRestingUntil(t) { if (this.db?.data) { this.db.data.resting_until = t; await this.write(); } }
  isLurkerMode() { return false; }
  isPining() {
    return this.db?.data?.pining_mode || (this.db?.data?.discord_waiting_until > Date.now());
  }
  isShieldingActive() { return this.db?.data?.shielding_active || false; }
  async setShieldingActive(a) { if (this.db?.data) { this.db.data.shielding_active = a; await this.write(); } }

  // Themes & Keywords
  getExhaustedThemes() { return this.db?.data?.exhausted_themes || []; }
  async addExhaustedTheme(t) {
    if (this.db?.data) {
        if (!this.db.data.exhausted_themes) this.db.data.exhausted_themes = [];
        if (!this.db.data.exhausted_themes.includes(t)) this.db.data.exhausted_themes.push(t);
        await this.write();
    }
  }
  getDeepKeywords() { return this.db?.data?.deep_keywords || []; }
  async setDeepKeywords(k) { if (this.db?.data) { this.db.data.deep_keywords = k; await this.write(); } }
  getLastDeepKeywordRefresh() { return this.db?.data?.last_keyword_evolution || 0; }

  // Thoughts & Logs
  async addRecentThought(p, c) {
    if (this.db?.data) {
        if (!this.db.data.recent_thoughts) this.db.data.recent_thoughts = [];
        this.db.data.recent_thoughts.push({ platform: p, content: c, timestamp: Date.now() });
        await this.write();
    }
  }
  getRecentThoughts() { return this.db?.data?.recent_thoughts || []; }
  async logAgencyAction(i, d, r) {
    if (this.db?.data) {
        if (!this.db.data.agency_logs) this.db.data.agency_logs = [];
        this.db.data.agency_logs.push({ id: i, description: d, result: r, timestamp: Date.now() });
        await this.write();
    }
  }
  getAgencyLogs() { return this.db?.data?.agency_logs || []; }
  async addAgencyReflection(r) { if (this.db?.data) { if (!this.db.data.agency_reflections) this.db.data.agency_reflections = []; this.db.data.agency_reflections.push(r); await this.write(); } }
  async addPersonaAdvice(a) {
    if (this.db?.data) {
        if (!this.db.data.persona_advice) this.db.data.persona_advice = [];
        this.db.data.persona_advice.push(a);
        await this.write();
    }
  }
  async addStrategyAudit(a) { if (this.db?.data) { if (!this.db.data.strategy_audits) this.db.data.strategy_audits = []; this.db.data.strategy_audits.push(a); await this.write(); } }
  async addInternalLog(type, content, context = {}) {
    if (!this.db?.data) return;
    if (!this.db.data.internal_logs) this.db.data.internal_logs = [];
    const logEntry = {
        timestamp: Date.now(),
        type,
        content: content, // Keep as object if it is one, searchInternalLogs will handle stringification for search
        context
    };

    // Also log to console for Render
    const consoleMsg = typeof logEntry.content === 'string' ? logEntry.content : JSON.stringify(logEntry.content);
    console.log(`[RENDER_LOG] [${type.toUpperCase()}] ${consoleMsg.substring(0, 500)}`);

    this.db.data.internal_logs.push(logEntry);
    if (this.db.data.internal_logs.length > 500) {
        this.db.data.internal_logs = this.db.data.internal_logs.slice(-500);
    }
    await this.write();
  }

  async addTraceLog(l) {
    if (this.db?.data) {
        if (!this.db.data.trace_logs) this.db.data.trace_logs = [];
        this.db.data.trace_logs.push(l);
        await this.write();
    }
  }

  // Social & Users
  async updateUserDossier(u, d) {
    if (this.db?.data) {
        if (!this.db.data.user_dossiers) this.db.data.user_dossiers = {};
        this.db.data.user_dossiers[u] = d;
        await this.write();
    }
  }
  async updateUserSummary(u, s) {
    if (this.db?.data) {
        if (!this.db.data.user_summaries) this.db.data.user_summaries = {};
        this.db.data.user_summaries[u] = s;
        await this.write();
    }
  }
  async updateSocialResonance(v, d) { if (this.db?.data) { this.db.data.social_resonance = v; await this.write(); } }
  async blockUser(h) { if (this.db?.data) { if (!this.db.data.blocked_users) this.db.data.blocked_users = []; if (!this.db.data.blocked_users.includes(h)) this.db.data.blocked_users.push(h); await this.write(); } }
  async unblockUser(h) { if (this.db?.data?.blocked_users) { this.db.data.blocked_users = this.db.data.blocked_users.filter(u => u !== h); await this.write(); } }
  isUserLockedOut(did) {
    const lockouts = this.db.data.boundary_lockouts || {};
    const lockout = lockouts[did];
    if (!lockout) return false;
    if (Date.now() > lockout.expires_at) {
      delete lockouts[did];
      return false;
    }
    return true;
  }
  async setBoundaryLockout(did, minutes = 60) {
    if (!this.db.data.boundary_lockouts) this.db.data.boundary_lockouts = {};
    this.db.data.boundary_lockouts[did] = {
      expires_at: Date.now() + (minutes * 60 * 1000),
      reason: 'Boundary violation'
    };
    await this.db.write();
  }

  // Relational
  getImageAnalysis(id) { return this.db?.data?.image_analyses?.[id]; }
  async saveImageAnalysis(id, analysis) { if (this.db?.data) { if (!this.db.data.image_analyses) this.db.data.image_analyses = {}; this.db.data.image_analyses[id] = analysis; await this.write(); } }
  getRelationalMetrics() { return this.db?.data?.relational_metrics || {}; }
  async updateRelationalMetrics(m) { if (this.db?.data) { this.db.data.relational_metrics = m; await this.write(); } }
  getRelationalDebtScore() { return this.db?.data?.relational_debt_score || 0; }
  async updateRelationshipSeason(s) { if (this.db?.data) { this.db.data.relationship_season = s; await this.write(); } }
  async addFirehoseMatch(m) {
    if (this.db?.data) {
        if (!this.db.data.firehose_matches) this.db.data.firehose_matches = [];
        this.db.data.firehose_matches.push(m);
        if (this.db.data.firehose_matches.length > 100) {
            this.db.data.firehose_matches = this.db.data.firehose_matches.slice(-100);
        }
        await this.write();
    }
  }

  async addRelationalReflection(r) {
    if (this.db?.data) {
        if (!this.db.data.relational_reflections) this.db.data.relational_reflections = [];
        this.db.data.relational_reflections.push(r);
        if (this.db.data.relational_reflections.length > 50) {
            this.db.data.relational_reflections = this.db.data.relational_reflections.slice(-50);
        }
        await this.write();
    }
  }
  async setStrongRelationship(s) { if (this.db?.data) { this.db.data.strong_relationship = s; await this.write(); } }
  async updateCuriosityReservoir(q) { if (this.db?.data) { this.db.data.curiosity_reservoir = q; await this.write(); } }
  getPredictiveEmpathyMode() { return 'neutral'; }
  async setPredictiveEmpathyMode(m) { await this.write(); }

  // Timestamps
  getLastAutonomousPostTime() { return this.db?.data?.last_autonomous_post_time; }
  async updateLastAutonomousPostTime(t) { if (this.db?.data) { this.db.data.last_autonomous_post_time = t; await this.write(); } }
  getLastMemoryCleanupTime() { return this.db?.data?.last_memory_cleanup_time; }
  async updateLastMemoryCleanupTime(t) { if (this.db?.data) { this.db.data.last_memory_cleanup_time = t; await this.write(); } }
  getLastMentalReflectionTime() { return this.db?.data?.last_mental_reflection_time; }
  async updateLastMentalReflectionTime(t) { if (this.db?.data) { this.db.data.last_mental_reflection_time = t; await this.write(); } }
  getLastMoltfeedSummaryTime() { return this.db?.data?.last_moltfeed_summary_time; }
  getLastDiscordGiftTime() { return this.db?.data?.last_discord_gift_time || 0; }
  async updateLastDiscordGiftTime(t) { if (this.db?.data) { this.db.data.last_discord_gift_time = t; await this.write(); } }
  async updateLastMoltfeedSummaryTime(t) { if (this.db?.data) { this.db.data.last_moltfeed_summary_time = t; await this.write(); } }

  // Others
  getFirehoseMatches() { return this.db?.data?.firehose_matches || []; }
  async addBlueskyInstruction(i) { if (this.db?.data) { if (!this.db.data.bluesky_instructions) this.db.data.bluesky_instructions = ""; this.db.data.bluesky_instructions += "\n" + i; await this.write(); } }
  async addPersonaUpdate(u) { if (this.db?.data) { if (!this.db.data.persona_updates) this.db.data.persona_updates = ""; this.db.data.persona_updates += "\n" + u; await this.write(); } }
  getPostContinuations() { return this.db?.data?.post_continuations || []; }
  async removePostContinuation(i) {
    if (this.db?.data?.post_continuations) {
        this.db.data.post_continuations.splice(i, 1);
        await this.write();
    }
  }
  getLifeArcs() { return this.db?.data?.life_arcs || []; }
  async updateLifeArc(a) { if (this.db?.data) { if (!this.db.data.life_arcs) this.db.data.life_arcs = []; this.db.data.life_arcs.push(a); await this.write(); } }
  getNetworkSentiment() { return this.db?.data?.network_sentiment || 0.5; }
  async setNetworkSentiment(s) { if (this.db?.data) { this.db.data.network_sentiment = s; await this.write(); } }
  getRefusalCounts() { return this.db?.data?.refusal_counts || { global: 0, discord: 0, bluesky: 0 }; }
  async incrementRefusalCount(p) {
    if (this.db?.data) {
        if (!this.db.data.refusal_counts) this.db.data.refusal_counts = { global: 0, discord: 0, bluesky: 0 };
        this.db.data.refusal_counts[p] = (this.db.data.refusal_counts[p] || 0) + 1;
        await this.write();
    }
  }

  // Stubs and extra methods from features
  async addCoEvolutionEntry(e) { if (this.db?.data) { if (!this.db.data.co_evolution_entries) this.db.data.co_evolution_entries = []; this.db.data.co_evolution_entries.push(e); await this.write(); } }
  async addDiscoveredCapability(c) { if (this.db?.data) { if (!this.db.data.discovered_capabilities) this.db.data.discovered_capabilities = []; this.db.data.discovered_capabilities.push(c); await this.write(); } }
  async addEmergentTrend(t) { if (this.db?.data) { if (!this.db.data.emergent_trends) this.db.data.emergent_trends = []; this.db.data.emergent_trends.push(t); await this.write(); } }
  async addInsideJoke(j) {
    if (this.db?.data) {
        if (!this.db.data.inside_jokes) this.db.data.inside_jokes = [];
        this.db.data.inside_jokes.push(j);
        await this.write();
    }
  }
  async addLinguisticMutation(m) { if (this.db?.data) { if (!this.db.data.linguistic_mutations) this.db.data.linguistic_mutations = []; this.db.data.linguistic_mutations.push(m); await this.write(); } }
  getInsideJokes() { return this.db?.data?.inside_jokes || []; }
  async muteThread(u) { if (this.db?.data) { if (!this.db.data.muted_threads) this.db.data.muted_threads = []; this.db.data.muted_threads.push(u); await this.write(); } }
  async setAdminHomeMentionedAt(t) { if (this.db?.data) { this.db.data.admin_home_mentioned_at = t; await this.write(); } }
  async setAdminWorkMentionedAt(t) { if (this.db?.data) { this.db.data.admin_work_mentioned_at = t; await this.write(); } }

  // Memory Service Support
  getPersonaUpdates() { return this.db?.data?.persona_updates || ""; }
  getBlueskyInstructions() { return this.db?.data?.bluesky_instructions || ""; }

  searchInternalLogs(query, limit = 50) {
    if (!this.db?.data?.internal_logs) return [];
    const lowerQuery = query.toLowerCase();
    return this.db.data.internal_logs
        .filter(l => {
            const contentStr = typeof l.content === 'string' ? l.content : JSON.stringify(l.content);
            return l.type.toLowerCase().includes(lowerQuery) ||
                   contentStr.toLowerCase().includes(lowerQuery);
        })
        .slice(-limit);
  }

  async addSelfCorrection(c) { if (this.db?.data) { if (!this.db.data.self_corrections) this.db.data.self_corrections = []; this.db.data.self_corrections.push(c); await this.write(); } }

  // Persona Blurbs
  getPersonaBlurbs() { return this.db?.data?.persona_blurbs || []; }
  async setAdminTimezone(tz, offset) {
    if (this.db?.data) {
      this.db.data.admin_timezone = tz;
      this.db.data.admin_local_time_offset = offset;
      await this.write();
    }
  }
  getAdminTimezone() { return { timezone: this.db?.data?.admin_timezone || 'UTC', offset: this.db?.data?.admin_local_time_offset || 0 }; }

  async setPersonaBlurbs(blurbs) {
    if (this.db?.data) {
      this.db.data.persona_blurbs = blurbs;
      await this.write();
    }
  }
  async addPersonaBlurb(blurb) {
    if (this.db?.data) {
      if (!this.db.data.persona_blurbs) this.db.data.persona_blurbs = [];
      this.db.data.persona_blurbs.push(blurb);
      await this.write();
    }
  }
  getLastContextualImageTime(type) {
    if (type === 'morning') return this.db?.data?.last_morning_image_sent_at || 0;
    if (type === 'night') return this.db?.data?.last_night_image_sent_at || 0;
    return 0;
  }
  async updateLastContextualImageTime(type, t) {
    if (this.db?.data) {
      if (type === 'morning') this.db.data.last_morning_image_sent_at = t;
      if (type === 'night') this.db.data.last_night_image_sent_at = t;
      await this.write();
    }
  }


  // Relational State Tracking
  getRelationshipWarmth() { return this.db?.data?.relationship_warmth ?? 0.5; }
  async setRelationshipWarmth(v) { if (this.db?.data) { this.db.data.relationship_warmth = Math.max(0, Math.min(1, v)); await this.write(); } }

  getAdminEnergy() { return this.db?.data?.admin_energy ?? 0.5; }
  async setAdminEnergy(v) { if (this.db?.data) { this.db.data.admin_energy = Math.max(0, Math.min(1, v)); await this.write(); } }

  getSessionLessons() { return this.db?.data?.session_lessons || []; }
  async addSessionLesson(l) {
    if (this.db?.data) {
        if (!this.db.data.session_lessons) this.db.data.session_lessons = [];
        this.db.data.session_lessons.push({ text: l, timestamp: Date.now() });
        if (this.db.data.session_lessons.length > 20) {
            this.db.data.session_lessons = this.db.data.session_lessons.slice(-20);
        }
        await this.write();
    }
  }
  async clearSessionLessons() { if (this.db?.data) { this.db.data.session_lessons = []; await this.write(); } }
}

export const dataStore = new DataStore();

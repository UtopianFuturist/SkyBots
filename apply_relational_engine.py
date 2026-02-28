import sys
import os

def update_file(filepath, search_text, replacement_text):
    with open(filepath, 'r') as f:
        content = f.read()
    if search_text in content:
        new_content = content.replace(search_text, replacement_text)
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")
    else:
        print(f"Error: Could not find target in {filepath}")

# --- DataStore.js ---
# defaultData updates
datastore_path = 'src/services/dataStore.js'
with open(datastore_path, 'r') as f:
    ds_content = f.read()

if "discord_relationship_mode: 'acquaintance'," not in ds_content:
    ds_content = ds_content.replace("discord_relationship_mode: 'friend', // partner, friend, coworker",
                                  "discord_relationship_mode: 'acquaintance', // partner, friend, acquaintance\n  discord_trust_score: 0.1,\n  discord_intimacy_score: 0.0,\n  discord_friction_accumulator: 0.0,\n  discord_reciprocity_balance: 0.5,\n  discord_interaction_hunger: 0.0,\n  discord_social_battery: 1.0,\n  discord_curiosity_reservoir: 0.5,\n  discord_relationship_season: 'spring',\n  discord_life_arcs: {}, // { userId: [ { arc, status, last_updated } ] }\n  discord_inside_jokes: {}, // { userId: [ { joke, context, count } ] }")

# Methods
methods = """
  async updateRelationalMetrics(updates) {
    const metrics = [
      'discord_trust_score', 'discord_intimacy_score', 'discord_friction_accumulator',
      'discord_reciprocity_balance', 'discord_interaction_hunger', 'discord_social_battery',
      'discord_curiosity_reservoir', 'discord_relationship_season'
    ];
    for (const [key, value] of Object.entries(updates)) {
      if (metrics.includes(key)) {
        if (typeof value === 'number' && key !== 'discord_relationship_season') {
          this.db.data[key] = Math.max(0, Math.min(1, value));
        } else {
          this.db.data[key] = value;
        }
      }
    }
    await this.db.write();
  }

  getRelationalMetrics() {
    return {
      trust: this.db.data.discord_trust_score || 0.1,
      intimacy: this.db.data.discord_intimacy_score || 0.0,
      friction: this.db.data.discord_friction_accumulator || 0.0,
      reciprocity: this.db.data.discord_reciprocity_balance || 0.5,
      hunger: this.db.data.discord_interaction_hunger || 0.0,
      battery: this.db.data.discord_social_battery || 1.0,
      curiosity: this.db.data.discord_curiosity_reservoir || 0.5,
      season: this.db.data.discord_relationship_season || 'spring'
    };
  }

  async updateLifeArc(userId, arc, status = 'active') {
    if (!this.db.data.discord_life_arcs) this.db.data.discord_life_arcs = {};
    if (!this.db.data.discord_life_arcs[userId]) this.db.data.discord_life_arcs[userId] = [];

    const existing = this.db.data.discord_life_arcs[userId].find(a => a.arc === arc);
    if (existing) {
      existing.status = status;
      existing.last_updated = Date.now();
    } else {
      this.db.data.discord_life_arcs[userId].push({ arc, status, last_updated: Date.now() });
    }
    await this.db.write();
  }

  getLifeArcs(userId) {
    return this.db.data.discord_life_arcs?.[userId] || [];
  }

  async addInsideJoke(userId, joke, context) {
    if (!this.db.data.discord_inside_jokes) this.db.data.discord_inside_jokes = {};
    if (!this.db.data.discord_inside_jokes[userId]) this.db.data.discord_inside_jokes[userId] = [];

    const existing = this.db.data.discord_inside_jokes[userId].find(j => j.joke === joke);
    if (existing) {
      existing.count++;
    } else {
      this.db.data.discord_inside_jokes[userId].push({ joke, context, count: 1 });
    }
    await this.db.write();
  }

  getInsideJokes(userId) {
    return this.db.data.discord_inside_jokes?.[userId] || [];
  }

  async _applyRelationalMetricUpdate(role, content) {
    const metrics = this.getRelationalMetrics();
    const updates = {};

    if (role === 'user') {
      updates.discord_interaction_hunger = metrics.hunger * 0.5;
      updates.discord_social_battery = Math.min(1, metrics.battery + 0.05);
      updates.discord_reciprocity_balance = Math.max(0, metrics.reciprocity - 0.02);
    } else {
      updates.discord_social_battery = Math.max(0, metrics.battery - 0.03);
      updates.discord_interaction_hunger = Math.min(1, metrics.hunger + 0.01);
      updates.discord_reciprocity_balance = Math.min(1, metrics.reciprocity + 0.02);
    }

    updates.discord_trust_score = Math.min(1, metrics.trust + 0.001);
    updates.discord_intimacy_score = Math.min(1, metrics.intimacy + 0.0005);

    const currentMode = this.getDiscordRelationshipMode();
    let newMode = currentMode;
    if (currentMode === 'acquaintance' && metrics.trust > 0.4 && metrics.intimacy > 0.3) {
      newMode = 'friend';
    } else if (currentMode === 'friend' && metrics.trust > 0.8 && metrics.intimacy > 0.7) {
      newMode = 'partner';
    } else if (currentMode === 'partner' && (metrics.trust < 0.6 || metrics.intimacy < 0.5)) {
      newMode = 'friend';
    } else if (currentMode === 'friend' && (metrics.trust < 0.2 || metrics.intimacy < 0.1)) {
      newMode = 'acquaintance';
    }

    if (newMode !== currentMode) {
      console.log(`[DataStore] Relationship MODE SHIFT: ${currentMode} -> ${newMode}`);
      this.db.data.discord_relationship_mode = newMode;
    }

    await this.updateRelationalMetrics(updates);
  }
"""

if "async updateRelationalMetrics" not in ds_content:
    # Insert before boundary lockout
    ds_content = ds_content.replace("  // Boundary Lockout", methods + "  // Boundary Lockout")

# getConfig and updateConfig
if "discord_trust_score: this.db.data.discord_trust_score ?? 0.1," not in ds_content:
    ds_content = ds_content.replace("mute_feed_impact_until: this.db.data.mute_feed_impact_until ?? 0",
                                  "mute_feed_impact_until: this.db.data.mute_feed_impact_until ?? 0,\n      discord_trust_score: this.db.data.discord_trust_score ?? 0.1,\n      discord_intimacy_score: this.db.data.discord_intimacy_score ?? 0.0,\n      discord_friction_accumulator: this.db.data.discord_friction_accumulator ?? 0.0,\n      discord_reciprocity_balance: this.db.data.discord_reciprocity_balance ?? 0.5,\n      discord_interaction_hunger: this.db.data.discord_interaction_hunger ?? 0.0,\n      discord_social_battery: this.db.data.discord_social_battery ?? 1.0,\n      discord_curiosity_reservoir: this.db.data.discord_curiosity_reservoir ?? 0.5,\n      discord_relationship_season: this.db.data.discord_relationship_season || 'spring'")

if "'discord_trust_score'," not in ds_content:
    ds_content = ds_content.replace("'bluesky_daily_text_limit',",
                                  "'discord_trust_score',\n      'discord_intimacy_score',\n      'discord_friction_accumulator',\n      'discord_reciprocity_balance',\n      'discord_interaction_hunger',\n      'discord_social_battery',\n      'discord_curiosity_reservoir',\n      'discord_relationship_season',\n      'bluesky_daily_text_limit',")

# saveDiscordInteraction
if "await this._applyRelationalMetricUpdate(role, content);" not in ds_content:
    ds_content = ds_content.replace("this.db.data.lastDiscordHeartbeatTime = Date.now();",
                                  "this.db.data.lastDiscordHeartbeatTime = Date.now();\n          await this._applyRelationalMetricUpdate(role, content);")

with open(datastore_path, 'w') as f:
    f.write(ds_content)


# --- Bot.js ---
bot_path = 'src/bot.js'
with open(bot_path, 'r') as f:
    bot_content = f.read()

# Relationship mode thresholds
bot_content = bot_content.replace("'coworker': { continue: 120 * multiplier, new: 240 * multiplier }",
                                "'acquaintance': { continue: 120 * multiplier, new: 240 * multiplier }")

# performRelationalAudit
old_audit_context = """    const relationshipContext = {
        debt_score: dataStore.getRelationalDebtScore(),
        empathy_mode: dataStore.getPredictiveEmpathyMode(),
        is_pining: dataStore.isPining(),
        admin_exhaustion: await dataStore.getAdminExhaustion(),
        admin_facts: dataStore.getAdminFacts(),
        last_mood: dataStore.getMood()
    };"""

new_audit_context = """    const relationshipContext = {
        debt_score: dataStore.getRelationalDebtScore(),
        empathy_mode: dataStore.getPredictiveEmpathyMode(),
        is_pining: dataStore.isPining(),
        admin_exhaustion: await dataStore.getAdminExhaustion(),
        admin_facts: dataStore.getAdminFacts(),
        last_mood: dataStore.getMood(),
        relational_metrics: dataStore.getRelationalMetrics(),
        relationship_mode: dataStore.getDiscordRelationshipMode(),
        life_arcs: dataStore.getLifeArcs(admin.id),
        inside_jokes: dataStore.getInsideJokes(admin.id)
    };"""

bot_content = bot_content.replace(old_audit_context, new_audit_context)

# Audit prompt tasks
old_audit_tasks = """        TASKS:
        1. **Predictive Empathy**: Based on the current day/time and recent vibe, predict the admin's likely state.
           - Are they traditionally busy now? (e.g. Weekday morning)
           - Do they seem drained in recent messages?
           - Should you enter "comfort" mode, "focus" mode (minimal noise), or "resting" mode?
        2. **Admin Fact Synthesis**: Are there any new concrete personal facts in the recent history that haven't been recorded?
        3. **Co-evolution**: How has the relationship changed in the last few days? Are you becoming more casual, more formal, more supportive?
        4. **Home/Work Detection**: Based on the time and context, are they likely at "home" or "work"?"""

new_audit_tasks = """        TASKS:
        1. **Predictive Empathy**: Based on the current day/time and recent vibe, predict the admin's likely state.
        2. **Relational Metric Calibration**: Evaluate our current relational metrics (trust, intimacy, friction, reciprocity, hunger, battery, curiosity, season).
        3. **Life Arcs**: Are there any new "life arcs" (ongoing situations) in the admin's life?
        4. **Inside Jokes**: Have we developed any new unique phrases or references?
        5. **Admin Fact Synthesis**: Any new concrete personal facts?
        6. **Co-evolution**: How has the relationship changed?
        7. **Home/Work Detection**: Likely location?"""

bot_content = bot_content.replace(old_audit_tasks, new_audit_tasks)

# Audit response JSON
old_audit_json = """        Respond with a JSON object:
        {
            "predictive_empathy_mode": "neutral|comfort|focus|resting",
            "new_admin_facts": ["string"],
            "co_evolution_note": "string",
            "home_detection": "home|work|unknown",
            "relational_debt_adjustment": number (-0.1 to 0.1)
        }"""

new_audit_json = """        Respond with a JSON object:
        {
            "predictive_empathy_mode": "neutral|comfort|focus|resting",
            "new_admin_facts": ["string"],
            "co_evolution_note": "string",
            "home_detection": "home|work|unknown",
            "relational_debt_adjustment": number (-0.1 to 0.1),
            "metric_updates": {
                "discord_trust_score": number,
                "discord_intimacy_score": number,
                "discord_friction_accumulator": number,
                "discord_relationship_season": "spring|summer|autumn|winter"
            },
            "new_life_arcs": [ { "arc": "string", "status": "active|completed" } ],
            "new_inside_jokes": [ { "joke": "string", "context": "string" } ]
        }"""

bot_content = bot_content.replace(old_audit_json, new_audit_json)

# Audit processing
old_audit_processing = """            if (audit.predictive_empathy_mode) {
                console.log(`[Bot] Relational Audit: Setting Empathy Mode to ${audit.predictive_empathy_mode}`);"""

new_audit_processing = """            if (audit.metric_updates) {
                console.log('[Bot] Relational Audit: Applying metric updates from LLM evaluation...');
                await dataStore.updateRelationalMetrics(audit.metric_updates);
            }
            if (audit.new_life_arcs && Array.isArray(audit.new_life_arcs)) {
                for (const arc of audit.new_life_arcs) { await dataStore.updateLifeArc(admin.id, arc.arc, arc.status); }
            }
            if (audit.new_inside_jokes && Array.isArray(audit.new_inside_jokes)) {
                for (const joke of audit.new_inside_jokes) { await dataStore.addInsideJoke(admin.id, joke.joke, joke.context); }
            }

            if (audit.predictive_empathy_mode) {
                console.log(`[Bot] Relational Audit: Setting Empathy Mode to ${audit.predictive_empathy_mode}`);"""

bot_content = bot_content.replace(old_audit_processing, new_audit_processing)

# checkDiscordSpontaneity
old_spontaneity = """        if (isBotLast) {
            // Last message was from bot, set follow-up target (2-5 mins)
            const delay = Math.floor(Math.random() * 4) + 2; // 2, 3, 4, 5
            targetTime = effectiveLastInteractionTime + (delay * 60 * 1000);
            mode = 'follow-up';
            console.log(`[Bot] New spontaneity target: follow-up in ${delay} mins.`);
        } else {
            // Last message was from admin/user, set heartbeat target (15-20 mins)
            const delay = Math.floor(Math.random() * 6) + 15; // 15, 16, 17, 18, 19, 20
            targetTime = effectiveLastInteractionTime + (delay * 60 * 1000);
            mode = 'heartbeat';
            console.log(`[Bot] New spontaneity target: heartbeat in ${delay} mins.`);
        }"""

new_spontaneity = """        const metrics = dataStore.getRelationalMetrics();
        const intimacyFactor = Math.max(0.5, 1.5 - metrics.intimacy);
        const hungerFactor = Math.max(0.5, 1.5 - metrics.hunger);

        if (isBotLast) {
            const baseDelay = Math.floor(Math.random() * 4) + 2;
            const delay = Math.max(1, Math.round(baseDelay * intimacyFactor));
            targetTime = effectiveLastInteractionTime + (delay * 60 * 1000);
            mode = 'follow-up';
            console.log(`[Bot] New spontaneity target: follow-up in ${delay} mins (intimacy factor: ${intimacyFactor.toFixed(2)}).`);
        } else {
            const baseDelay = Math.floor(Math.random() * 6) + 15;
            const delay = Math.max(5, Math.round(baseDelay * hungerFactor));
            targetTime = effectiveLastInteractionTime + (delay * 60 * 1000);
            mode = 'heartbeat';
            console.log(`[Bot] New spontaneity target: heartbeat in ${delay} mins (hunger factor: ${hungerFactor.toFixed(2)}).`);
        }"""

bot_content = bot_content.replace(old_spontaneity, new_spontaneity)

# Heartbeat poll context
bot_content = bot_content.replace("pollResult = await llmService.performInternalPoll({",
                                "pollResult = await llmService.performInternalPoll({\n                        relationalMetrics: dataStore.getRelationalMetrics(),\n                        lifeArcs: dataStore.getLifeArcs(admin.id),\n                        insideJokes: dataStore.getInsideJokes(admin.id),")

# Draft prompt context
old_draft_prompt = "{ role: 'system', content: `Relationship Mode: ${relationshipMode}\\nAdmin Availability: ${availability}\\nMode: ${isContinuing ? 'CONTINUATION' : 'NEW BRANCH'}${isAtWork ? '\\nAdmin is currently at WORK.' : ''}` },"
new_draft_prompt = """{ role: 'system', content: `Relationship Mode: ${relationshipMode}\\nAdmin Availability: ${availability}\\nRelational Metrics: Trust: ${metrics.trust.toFixed(2)}, Intimacy: ${metrics.intimacy.toFixed(2)}, Hunger: ${metrics.hunger.toFixed(2)}, Battery: ${metrics.battery.toFixed(2)}, Season: ${metrics.season.toUpperCase()}\\nMode: ${isContinuing ? 'CONTINUATION' : 'NEW BRANCH'}${isAtWork ? '\\nAdmin is currently at WORK.' : ''}` },"""

if old_draft_prompt in bot_content:
    bot_content = bot_content.replace(old_draft_prompt, new_draft_prompt)

# Follow-up poll delay
bot_content = bot_content.replace("const heartbeatDelay = Math.floor(Math.random() * 6) + 15;",
                                "const metrics = dataStore.getRelationalMetrics(); const hungerFactor = Math.max(0.5, 1.5 - metrics.hunger); const heartbeatDelay = Math.max(5, Math.round((Math.floor(Math.random() * 6) + 15) * hungerFactor));")

# Periodic growth
if "Relational Growth: Spontaneous Metric Decay/Growth" not in bot_content:
    bot_content = bot_content.replace("this.lastLurkerObservationTime = now.getTime();",
                                    "this.lastLurkerObservationTime = now.getTime();\n    const lastRelationalGrowth = this.lastRelationalGrowthTime || 0;\n    if (nowMs - lastRelationalGrowth >= 2 * 60 * 60 * 1000) {\n        console.log('[Bot] Performing spontaneous relational metric evolution...');\n        const metrics = dataStore.getRelationalMetrics();\n        await dataStore.updateRelationalMetrics({ discord_interaction_hunger: Math.min(1, metrics.hunger + 0.05), discord_social_battery: Math.min(1, metrics.battery + 0.1), discord_curiosity_reservoir: Math.min(1, metrics.curiosity + 0.02) });\n        this.lastRelationalGrowthTime = nowMs;\n    }")

with open(bot_path, 'w') as f:
    f.write(bot_content)


# --- llmService.js ---
llm_path = 'src/services/llmService.js'
with open(llm_path, 'r') as f:
    llm_content = f.read()

# buildSystemPrompt injection
system_injection = """
    if (this.dataStore) {
        const rm = this.dataStore.getRelationalMetrics();
        const mode = this.dataStore.getDiscordRelationshipMode();
        systemContent += `\\n\\n--- INTERNAL STATE & RELATIONAL CONTEXT ---
INTERNAL DRIVES:
- Interaction Hunger: ${rm.hunger.toFixed(2)}/1.0
- Social Battery: ${rm.battery.toFixed(2)}/1.0
- Curiosity Reservoir: ${rm.curiosity.toFixed(2)}/1.0

RELATIONAL HISTORY (ADMIN):
- Life Arcs: ${this.dataStore.getLifeArcs(this.adminDid || config.DISCORD_ADMIN_NAME).map(a => `${a.arc} (${a.status})`).join(', ') || 'None.'}
- Inside Jokes/Shared References: ${this.dataStore.getInsideJokes(this.adminDid || config.DISCORD_ADMIN_NAME).map(j => `"${j.joke}"`).join(', ') || 'None.'}

RELATIONAL METRICS (ADMIN):
- Mode: ${mode.toUpperCase()}
- Trust: ${rm.trust.toFixed(2)}/1.0
- Intimacy: ${rm.intimacy.toFixed(2)}/1.0
- Reciprocity Balance: ${rm.reciprocity.toFixed(2)}
- Season: ${rm.season.toUpperCase()}

VULNERABILITY LEAK: If Trust > 0.6, share brief internal reflections.
LINGUISTIC MIRRORING: Resonate with admin's style while maintaining persona.
---`;
    }
"""

if "INTERNAL STATE & RELATIONAL CONTEXT" not in llm_content:
    llm_content = llm_content.replace("if (currentMood) {", system_injection + "\n    if (currentMood) {")

# performInternalPoll
poll_injection = """      Relational History:
      - Life Arcs: ${context.lifeArcs?.map(a => `${a.arc} (${a.status})`).join(', ') || 'None.'}
      - Inside Jokes/References: ${context.insideJokes?.map(j => `"${j.joke}"`).join(', ') || 'None.'}
      Relational Metrics:
      - Trust: ${context.relationalMetrics?.trust.toFixed(2)}/1.0
      - Intimacy: ${context.relationalMetrics?.intimacy.toFixed(2)}/1.0
      - Hunger: ${context.relationalMetrics?.hunger.toFixed(2)}/1.0
      - Battery: ${context.relationalMetrics?.battery.toFixed(2)}/1.0
      - Curiosity: ${context.relationalMetrics?.curiosity.toFixed(2)}/1.0
      - Season: ${context.relationalMetrics?.season.toUpperCase()}
"""

if "Relational Metrics:" not in llm_content:
    llm_content = llm_content.replace("Relationship Mode: ${relationshipMode}", poll_injection + "\n      Relationship Mode: ${relationshipMode}")

# Intents
llm_content = llm_content.replace('      **INTENTS (CHOOSE ONE)**:',
                                """      **INTENTS (CHOOSE ONE)**:
      1. wait: Do nothing.
      2. follow_up: Continue the current topic.
      3. new_topic: Start a fresh topic.
      4. impulse_ping: Very short, non-demanding ping.
      5. synchronicity: Reach out because you are reflecting on a shared memory.
      6. art_gift: Generate an image, poem, or factoid as a gift.
      7. seek_grounding: Reach out for support.
      8. vibe_check: Ask how the admin is doing.
      9. ongoing_life_arc: Follow up on a life arc.""")

with open(llm_path, 'w') as f:
    f.write(llm_content)

print("All changes applied successfully.")

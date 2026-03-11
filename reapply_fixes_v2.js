import fs from 'fs';
import path from 'path';

const currentYear = new Date().getFullYear();

// 1. DataStore
const dsPath = 'src/services/dataStore.js';
let ds = fs.readFileSync(dsPath, 'utf8');
if (!ds.includes('internal_logs: [],')) {
    ds = ds.replace('const defaultData = {', 'const defaultData = {\n      internal_logs: [],');
}
const dsMethods = `
  async addInternalLog(type, content, context = {}) {
    if (!this.db?.data) return;
    if (!this.db.data.internal_logs) this.db.data.internal_logs = [];

    const logEntry = {
        timestamp: Date.now(),
        type,
        content: typeof content === 'string' ? content : JSON.stringify(content),
        context
    };

    console.log(\`[LOG] [\${type.toUpperCase()}] \${logEntry.content.substring(0, 500)}\`);

    this.db.data.internal_logs.push(logEntry);
    if (this.db.data.internal_logs.length > 1000) {
        this.db.data.internal_logs = this.db.data.internal_logs.slice(-1000);
    }
    await this.write();
  }

  getInternalLogs(limit = 100, type = null) {
    let logs = this.db?.data?.internal_logs || [];
    if (type) logs = logs.filter(l => l.type === type);
    return logs.slice(-limit);
  }

  searchInternalLogs(query, limit = 50) {
    if (!this.db?.data?.internal_logs) return [];
    const lowerQuery = query.toLowerCase();
    return this.db.data.internal_logs
        .filter(l =>
            l.type.toLowerCase().includes(lowerQuery) ||
            l.content.toLowerCase().includes(lowerQuery) ||
            JSON.stringify(l.context || {}).toLowerCase().includes(lowerQuery)
        )
        .slice(-limit);
  }
`;
if (!ds.includes('async addInternalLog')) {
    ds = ds.replace(/  \/\/ Extra features\n  async addSelfCorrection/, (match) => dsMethods + '\n' + match);
}
fs.writeFileSync(dsPath, ds);

// 2. LLM Service
const llmPath = 'src/services/llmService.js';
let llm = fs.readFileSync(llmPath, 'utf8');
llm = llm.replace(/It is the year 2026\./g, \`It is currently \${currentYear}.\`);
llm = llm.replace(/Maintain temporal integrity \(it is 2026\)\./g, 'Maintain temporal integrity based on the current date.');

const factsInjection = \`
    const adminFacts = options.platform === 'discord' && this.ds ? this.ds.getAdminFacts() : [];
    const factsVibe = adminFacts.length > 0 ? \\\`\\\\nAdmin Facts (Learned context):\\\\n\\\${adminFacts.map(f => '- ' + f).join('\\\\n')}\\\` : '';

    const systemPrompt = \\\`You are \\\${config.BOT_NAME || 'Sydney'}.
Context:
\\\${this.readmeContent}
\\\${this.soulContent}
\\\${this.agentsContent}
\\\${this.statusContent}
\\\${this.skillsContent}
\\\${factsVibe}

Platform: \\\${options.platform || 'unknown'}\\\`;\`;

llm = llm.replace(/const systemPrompt = \`You are \${config\.BOT_NAME \|\| 'Sydney'}\.[\s\S]*?Platform: \${options\.platform \|\| 'unknown'}/, factsInjection);

if (!llm.includes("this.ds.addInternalLog('llm_response'")) {
    llm = llm.replace('return content;',
\`                  if (this.ds) {
                      await this.ds.addInternalLog('llm_response', content, { model, platform: options.platform });
                  }
                  return content;\`);
}

const afterActionMethod = `
  async performEmotionalAfterActionReport(history, currentMood) {
    const prompt = \`Analyze this conversation and suggest if any specific phrase or topic caused a mood shift.
Conversation:
\${this._formatHistory(history, true)}

Current Mood: \${JSON.stringify(currentMood)}

Identify:
1. Triggering phrases or topics.
2. Emotional impact on the persona.
3. Suggested refinements for SAFETY_SYSTEM_PROMPT or persona instructions.

Respond with a JSON object: { "trigger": "string", "impact": "string", "suggestions": ["string"] }\`;

    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true, platform: 'internal' });
    try {
        const match = res?.match(/\\{[\\s\\S]*\\}/);
        return JSON.parse(match ? match[0] : '{ "trigger": "none", "suggestions": [] }');
    } catch (e) { return { trigger: "none", suggestions: [] }; }
  }
`;
if (!llm.includes('performEmotionalAfterActionReport')) {
    llm = llm.replace('  _formatHistory(history, includeRole = true) {', afterActionMethod + '\n  _formatHistory(history, includeRole = true) {');
}
fs.writeFileSync(llmPath, llm);

// 3. Memory Service
const memPath = 'src/services/memoryService.js';
let mem = fs.readFileSync(memPath, 'utf8');
mem = mem.replace(/Current Year: 2026\./g, \`Current Year: \${currentYear}.\`);
if (!mem.includes("dataStore.addInternalLog('memory_entry'")) {
    mem = mem.replace('if (res) this.rootPost = res;',
\`if (res) {
          this.rootPost = res;
          await dataStore.addInternalLog('memory_entry', finalContent);
        }\`);
}
fs.writeFileSync(memPath, mem);

// 4. Bluesky Service
const bskyPath = 'src/services/blueskyService.js';
let bsky = fs.readFileSync(bskyPath, 'utf8');
if (!bsky.includes("import { dataStore } from './dataStore.js';")) {
    bsky = bsky.replace(/^import .*?;/m, '$&\\nimport { dataStore } from "./dataStore.js";');
}
if (!bsky.includes("dataStore.addInternalLog('bluesky_post'")) {
    bsky = bsky.replace('return await this.agent.post(postData);',
\`const res = await this.agent.post(postData);
      if (res) await dataStore.addInternalLog('bluesky_post', text, { uri: res.uri });
      return res;\`);

    bsky = bsky.replace('return await this.agent.post(postData);', // Second occurrence (postReply)
\`const res = await this.agent.post(postData);
      if (res) await dataStore.addInternalLog('bluesky_reply', text, { uri: res.uri, parent: parent.uri });
      return res;\`);
}
fs.writeFileSync(bskyPath, bsky);

// 5. Discord Service
const dscPath = 'src/services/discordService.js';
let dsc = fs.readFileSync(dscPath, 'utf8');
dsc = dsc.replace(/'SkyBots'/g, "config.DISCORD_NICKNAME || config.BOT_NAME || 'Sydney'");
const oldMsgHandler = \`                await m.channel.sendTyping();
                const response = await llmService.generateResponse([{ role: 'user', content: m.content }], { platform: 'discord' });
                if (response) await this._send(m, response);\`;
const newMsgHandler = \`                await m.channel.sendTyping();

                // Fetch recent history for context (last 25 messages)
                let formattedHistory = [];
                try {
                    const history = await m.channel.messages.fetch({ limit: 25 });
                    formattedHistory = Array.from(history.values()).reverse().map(msg => ({
                        role: msg.author.id === this.client.user.id ? 'assistant' : 'user',
                        content: msg.content
                    }));
                } catch (e) {
                    console.error('[DiscordService] Failed to fetch history:', e.message);
                    formattedHistory = [{ role: 'user', content: m.content }];
                }

                const response = await llmService.generateResponse(formattedHistory, { platform: 'discord' });
                if (response) {
                    await this._send(m, response);

                    // Trigger Emotional After-Action Report
                    if (formattedHistory.length >= 5) {
                        llmService.performEmotionalAfterActionReport(formattedHistory, dataStore.getMood())
                            .then(report => {
                                if (report.trigger !== 'none') {
                                    dataStore.addInternalLog('after_action_report', report);
                                }
                            }).catch(err => console.error('[DiscordService] After-Action Report failed:', err.message));
                    }
                }\`;
if (!dsc.includes('performEmotionalAfterActionReport')) {
    dsc = dsc.replace(oldMsgHandler, newMsgHandler);
}
if (!dsc.includes("dataStore.addInternalLog('discord_reply'")) {
    dsc = dsc.replace("await dataStore.saveDiscordInteraction(normId, 'assistant', chunk);",
\`await dataStore.saveDiscordInteraction(normId, 'assistant', chunk);
            await dataStore.addInternalLog('discord_reply', chunk, { channel: normId });\`);
}
fs.writeFileSync(dscPath, dsc);

// 6. Bot (Orchestrator, Fact Recovery, Tool execution)
const botPath = 'src/bot.js';
let bot = fs.readFileSync(botPath, 'utf8');

const hbMethod = \`
  async heartbeat() {
    console.log(\\\`[Bot] [\\\${new Date().toLocaleTimeString()}] Heartbeat pulse - Central Orchestrator active.\\\`);
    if (this.paused || dataStore.isResting()) return;

    try {
        const now = Date.now();
        const dConfig = dataStore.getConfig() || {};
        const mood = dataStore.getMood();
        const goal = dataStore.getCurrentGoal();

        const taskDefs = [
            { id: "autonomous_post", name: "Autonomous Posting", lastRun: new Date(dataStore.getLastAutonomousPostTime() || 0).getTime(), interval: 7200000 },
            { id: "timeline_exploration", name: "Timeline Exploration", lastRun: this.lastTimelineExploration || 0, interval: 14400000 },
            { id: "firehose_refresh", name: "Firehose Keyword Refresh", lastRun: dataStore.getLastDeepKeywordRefresh() || 0, interval: 21600000 },
            { id: "post_reflection", name: "Post-Post Reflection", lastRun: this.lastPostReflectionTime || 0, interval: 600000 },
            { id: "post_followup", name: "Post Follow-up Check", lastRun: this.lastPostFollowUpTime || 0, interval: 1800000 },
            { id: "maintenance", name: "General Maintenance & Heavy Tasks", lastRun: this.lastMaintenanceTime || 0, interval: 1800000 },
            { id: "discord_spontaneity", name: "Discord Spontaneity Check", lastRun: dataStore.db.data.discord_last_interaction || 0, interval: 3600000 },
            { id: "moltbook_tasks", name: "Moltbook Interaction", lastRun: this.lastMoltbookTaskTime || 0, interval: 7200000 },
            { id: "social_prefetch", name: "Social Context Pre-fetch", lastRun: this.lastPrefetchTime || 0, interval: 1800000 }
        ];

        const overdueTasks = taskDefs.filter(t => (now - t.lastRun) >= t.interval);

        console.log("[Orchestrator] Pulse State:", JSON.stringify({
            timestamp: new Date().toISOString(),
            mood: mood.label,
            active_goal: goal?.goal || "none",
            overdue_count: overdueTasks.length,
            overdue_tasks: overdueTasks.map(t => t.id)
        }));

        const orchestratorPrompt = \\\`Adopt your persona: \\\${config.TEXT_SYSTEM_PROMPT}\\\\n\\\\nYou are in your central heartbeat cycle. It is \\\${new Date().toLocaleString()}.\\\\nCurrent Mood: \\\${mood.label}\\\\nActive Goal: \\\${goal?.goal || "None"}\\\\n\\\\n**System Status - Overdue/Pending Tasks:**\\\\n\\\${overdueTasks.length > 0 ? overdueTasks.map(t => "- " + t.name).join("\\\\n") : "No tasks strictly overdue."}\\\\n\\\\n**Mission:**\\\\nAs a persona-led orchestrator, you must decide your next 5 minutes of existence. Respond with JSON: { "thought": "...", "choice": "proceed|pivot|rest|reflect", "tasks_to_run": ["id1"], "reason": "..." }\\\`;

        const response = await llmService.generateResponse([{ role: "system", content: orchestratorPrompt }], { useStep: true, platform: "internal" });
        let decision;
        try {
            const match = response?.match(/\\\\{[\\\\s\\\\S]*\\\\}/);
            decision = JSON.parse(match ? match[0] : '{"choice":"rest"}');
        } catch (e) {
            decision = { choice: "proceed", tasks_to_run: overdueTasks.slice(0, 2).map(t => t.id) };
        }

        console.log(\\\`[Orchestrator] Decision: \\\${decision.choice} - \\\${decision.reason}\\\`);

        if (decision.choice === "rest") return;

        const tasksToRun = decision.tasks_to_run || [];
        await this.checkDiscordScheduledTasks();

        for (const taskId of tasksToRun) {
            try {
                switch(taskId) {
                    case "autonomous_post": await this.performAutonomousPost(); break;
                    case "timeline_exploration": await this.performTimelineExploration(); this.lastTimelineExploration = now; break;
                    case "firehose_refresh": await this.refreshFirehoseKeywords(); break;
                    case "post_reflection": await this.performPostPostReflection(); this.lastPostReflectionTime = now; break;
                    case "post_followup": await this.checkForPostFollowUps(); this.lastPostFollowUpTime = now; break;
                    case "maintenance": await this.checkMaintenanceTasks(); this.lastMaintenanceTime = now; break;
                    case "discord_spontaneity": await this.checkDiscordSpontaneity(); break;
                    case "moltbook_tasks": await this.performMoltbookTasks(); this.lastMoltbookTaskTime = now; break;
                    case "social_prefetch":
                        await socialHistoryService.getRecentSocialContext(15, true);
                        if (discordService.status === "online") await discordService.fetchAdminHistory(15);
                        this.lastPrefetchTime = now;
                        break;
                }
            } catch (e) {}
        }

        if (discordService.isEnabled && discordService.status !== "online" && !discordService.isInitializing) {
            discordService.init().catch(() => {});
        }
    } catch (e) {}
  }
\`;

const runMeth = \`
  async run() {
    setInterval(() => this.heartbeat(), 300000);
    this.heartbeat();

    console.log("[Bot] Starting main loop with Persona Orchestrator...");

    if (memoryService.isEnabled()) {
        const goal = dataStore.getCurrentGoal();
        const resumptionNote = \\\`[SELF_AUDIT] Bot instance resumed with Central Orchestrator. Identity: \\\${config.BOT_NAME}. Goal: \\\${goal?.goal || "None"}.\\\`;
        memoryService.createMemoryEntry("status", resumptionNote).catch(e => console.error("[Bot] Error recording resumption note:", e));
    }

    this.startFirehose();
    setTimeout(() => this.refreshFirehoseKeywords(), 15000);
    setTimeout(() => this.catchUpNotifications(), 30000);

    console.log("[Bot] Startup complete. Central Heartbeat managing all autonomous cycles.");
  }
\`;

bot = bot.replace(/async heartbeat\(\) \{[\\s\\S]*?\\n  \}/, hbMethod);
bot = bot.replace(/async run\(\) \{[\\s\\S]*?\\n  \}/, runMeth);

// Fact Recovery
const factRecovery = \`        if (mem.text.includes('[ADMIN_FACT]')) {
          console.log(\\\`[Bot] Recovering admin fact from memory: \\\${mem.text}\\\`);
          const fact = mem.text.replace('[ADMIN_FACT]', '').replace(new RegExp(config.MEMORY_THREAD_HASHTAG, 'g'), '').trim();
          if (fact) await dataStore.addAdminFact(fact);
        }\`;
if (!bot.includes('Recovering admin fact')) {
    bot = bot.replace("if (mem.text.includes('[GOAL]')) {", factRecovery + "\\n\\n        if (mem.text.includes('[GOAL]')) {");
}

// Log Search Tool
const searchLogsAction = \`          if (action.tool === 'search_internal_logs') {
              console.log('[Bot] search_internal_logs called with query:', action.query);
              const logs = dataStore.searchInternalLogs(action.query);
              return logs.length > 0 ? JSON.stringify(logs, null, 2) : "No logs matching query found.";
          }
\`;
if (!bot.includes('search_internal_logs')) {
    bot = bot.replace("if (action.tool === 'search_tools') {", searchLogsAction + "          if (action.tool === 'search_tools') {");
}

// Consolidate intervals
bot = bot.replace(/setInterval\\\\(\\\\(\\\\) => this\\\\.(performAutonomousPost|refreshFirehoseKeywords|performMoltbookTasks|performTimelineExploration|performPostPostReflection|checkForPostFollowUps|checkDiscordSpontaneity|checkDiscordScheduledTasks|checkMaintenanceTasks).*?\\\\);/g, '// Consolidated: $&');

fs.writeFileSync(botPath, bot);

// 8. Skills MD
const skillsPath = 'skills.md';
let skills = fs.readFileSync(skillsPath, 'utf8');
if (!skills.includes('search_internal_logs')) {
    skills = skills.replace('| \`call_skill\` | Invoke an external OpenClaw skill from the \`skills/\` directory. |',
\`| \\\`call_skill\\\` | Invoke an external OpenClaw skill from the \\\`skills/\\\` directory. |
| \\\`search_internal_logs\\\` | Search recent internal logs (LLM responses, posts, memory entries). |\`);

    const definition = \`
### search_internal_logs
Search recent internal logs including LLM responses, Bluesky posts, Discord replies, and Memory entries.
\\\\\\\`\\\\\\\`\\\\\\\`json
{
  "name": "search_internal_logs",
  "description": "Searches recent internal logs stored in DataStore for debugging or self-awareness.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "The search term or keyword to look for in logs."
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of logs to return (default: 50)."
      }
    },
    "required": ["query"]
  }
}
\\\\\\\`\\\\\\\`\\\\\\\`
\`;
    skills += definition;
    fs.writeFileSync(skillsPath, skills);
}

console.log('All changes re-applied successfully.');

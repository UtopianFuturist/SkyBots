import fs from 'fs';
import path from 'path';

// 1. Correct config.js - Fixed initialization order
const configContent = `import dotenv from 'dotenv';
dotenv.config();

export const config = {
  BOT_NAME: process.env.BOT_NAME || 'Sydney',
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
  DISCORD_ADMIN_ID: process.env.DISCORD_ADMIN_ID,
  DISCORD_CHANNEL_ID: process.env.DISCORD_CHANNEL_ID,
  BLUESKY_HANDLE: process.env.BLUESKY_HANDLE,
  BLUESKY_PASSWORD: process.env.BLUESKY_PASSWORD,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  RENDER_API_KEY: process.env.RENDER_API_KEY,
  TEXT_SYSTEM_PROMPT: process.env.TEXT_SYSTEM_PROMPT,
  IMAGE_SYSTEM_PROMPT: process.env.IMAGE_SYSTEM_PROMPT,
  MEMORY_THREAD_HASHTAG: process.env.MEMORY_THREAD_HASHTAG || '#SydneyDiary',
  POST_TOPICS: process.env.POST_TOPICS ? process.env.POST_TOPICS.split(',') : [],
  IMAGE_SUBJECTS: process.env.IMAGE_SUBJECTS ? process.env.IMAGE_SUBJECTS.split(',') : [],
  DISCORD_NICKNAME: process.env.DISCORD_NICKNAME,
};

config.BOT_NICKNAMES = process.env.BOT_NICKNAMES ? process.env.BOT_NICKNAMES.split(',') : [config.BOT_NAME];
`;
fs.writeFileSync('config.js', configContent);

// 2. Fix LLM Service - Dynamic Date, Persona Identity, Logging
let llm = fs.readFileSync('src/services/llmService.js', 'utf8');
llm = llm.replace(/It is the year 2026\./g, 'It is currently ${new Date().getFullYear()}.');
llm = llm.replace(/You are SkyBots\./g, 'You are ${config.BOT_NAME || "Sydney"}.');
// Add logging to generateResponse
if (!llm.includes('this.ds.addInternalLog')) {
    llm = llm.replace('return content;', 'if (this.ds) await this.ds.addInternalLog("llm_response", content); return content;');
}
fs.writeFileSync('src/services/llmService.js', llm);

// 3. Fix Memory Service - Dynamic Date, Logging
let mem = fs.readFileSync('src/services/memoryService.js', 'utf8');
mem = mem.replace(/Current Year: 2026\./g, 'Current Year: ${new Date().getFullYear()}.');
if (!mem.includes('dataStore.addInternalLog')) {
    mem = mem.replace('if (res) this.rootPost = res;', 'if (res) { this.rootPost = res; await dataStore.addInternalLog("memory_entry", finalContent); }');
}
fs.writeFileSync('src/services/memoryService.js', mem);

// 4. Fix Discord Service - Identity, 25 msg history, Logging
let dsc = fs.readFileSync('src/services/discordService.js', 'utf8');
dsc = dsc.replace(/'SkyBots'/g, 'config.BOT_NAME || "Sydney"');
dsc = dsc.replace(/limit: \d+/, 'limit: 25');
if (!dsc.includes('dataStore.addInternalLog')) {
    dsc = dsc.replace('if (response) await this._send(m, response);', 'if (response) { await this._send(m, response); await dataStore.addInternalLog("discord_reply", response); }');
}
fs.writeFileSync('src/services/discordService.js', dsc);

// 5. Fix DataStore - Internal Logging
let ds = fs.readFileSync('src/services/dataStore.js', 'utf8');
if (!ds.includes('addInternalLog')) {
    ds = ds.replace('const defaultData = {', 'const defaultData = {\n  internal_logs: [],');
    ds = ds.replace('async addTraceLog(l) {',
`async addInternalLog(type, content, context = {}) {
    if (!this.db?.data) return;
    if (!this.db.data.internal_logs) this.db.data.internal_logs = [];
    const logEntry = { timestamp: Date.now(), type, content, context };
    console.log(\`[RENDER_LOG] [\${type.toUpperCase()}] \${typeof content === 'string' ? content : JSON.stringify(content)}\`);
    this.db.data.internal_logs.push(logEntry);
    if (this.db.data.internal_logs.length > 500) this.db.data.internal_logs = this.db.data.internal_logs.slice(-500);
    await this.write();
  }
  async addTraceLog(l) {`);
}
fs.writeFileSync('src/services/dataStore.js', ds);

// 6. Fix Bot - Orchestrator
let bot = fs.readFileSync('src/bot.js', 'utf8');
const heartbeatLogic = `
  async heartbeat() {
    console.log("[Orchestrator] 5-minute heartbeat pulse.");
    if (this.paused || dataStore.isResting()) return;

    try {
        await this.checkDiscordScheduledTasks();

        // Persona-led decision for autonomous tasks
        const decisionPrompt = \`You are \${config.BOT_NAME}. It is \${new Date().toLocaleString()}. Choose next action: ["post", "rest", "reflect"]. Respond with JSON: {"choice": "..."}\`;
        const response = await llmService.generateResponse([{ role: "system", content: decisionPrompt }], { useStep: true });

        let choice = "rest";
        try { choice = JSON.parse(response).choice; } catch(e) {}

        if (choice === "post") await this.performAutonomousPost();
        if (choice === "reflect") await this.performPublicSoulMapping();

    } catch (e) {
        console.error("[Orchestrator] Heartbeat error:", e);
    }
  }

  async run() {`;

if (!bot.includes('async heartbeat()')) {
    bot = bot.replace('async run() {', heartbeatLogic);
    bot = bot.replace('this.startFirehose();', 'setInterval(() => this.heartbeat(), 300000); this.heartbeat(); this.startFirehose();');
}
fs.writeFileSync('src/bot.js', bot);

console.log("Applied all fixes and orchestrator logic.");

import fs from 'fs';
const currentYear = new Date().getFullYear();

// 1. DataStore Logging
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
    fs.writeFileSync('src/services/dataStore.js', ds);
}

// 2. LLM Service Identity & Logging
let llm = fs.readFileSync('src/services/llmService.js', 'utf8');
llm = llm.replace(/You are SkyBots\./g, 'You are ' + (process.env.BOT_NAME || 'Sydney') + '.');
if (!llm.includes('addInternalLog')) {
    llm = llm.replace('return content;', 'if (this.ds) await this.ds.addInternalLog("llm_response", content); return content;');
    fs.writeFileSync('src/services/llmService.js', llm);
}

// 3. Discord Service 25 message history
let dsc = fs.readFileSync('src/services/discordService.js', 'utf8');
dsc = dsc.replace(/limit: \d+/, 'limit: 25');
dsc = dsc.replace(/'SkyBots'/g, 'config.BOT_NAME || "Sydney"');
fs.writeFileSync('src/services/discordService.js', dsc);

// 4. Memory logging
let mem = fs.readFileSync('src/services/memoryService.js', 'utf8');
if (!mem.includes('addInternalLog')) {
    mem = mem.replace('await this.agent.post', 'await dataStore.addInternalLog("memory_entry", finalContent); await this.agent.post');
    fs.writeFileSync('src/services/memoryService.js', mem);
}

// 5. Bluesky logging
let bsky = fs.readFileSync('src/services/blueskyService.js', 'utf8');
if (!bsky.includes('addInternalLog')) {
    bsky = bsky.replace('return await this.agent.post(postData);', 'const res = await this.agent.post(postData); await dataStore.addInternalLog("bluesky_post", text); return res;');
    fs.writeFileSync('src/services/blueskyService.js', bsky);
}

// 6. Heartbeat in bot.js
let bot = fs.readFileSync('src/bot.js', 'utf8');
if (!bot.includes('heartbeat')) {
    bot = bot.replace('async run() {',
`async heartbeat() {
    console.log("[Orchestrator] 5-minute heartbeat pulse.");
    if (this.paused) return;
    // Standardized heartbeat logic
    await this.checkDiscordScheduledTasks();
    if (Math.random() > 0.7) await this.performAutonomousPost();
  }

  async run() {
    setInterval(() => this.heartbeat(), 300000);
    this.heartbeat();`);
    fs.writeFileSync('src/bot.js', bot);
}

console.log("Finalized all code changes.");

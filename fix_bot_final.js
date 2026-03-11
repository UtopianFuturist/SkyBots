import fs from 'fs';
let bot = fs.readFileSync('src/bot.js', 'utf8');

const start = bot.indexOf('async heartbeat() {');
const end = bot.indexOf('async checkDiscordSpontaneity() {');
if (start !== -1 && end !== -1) {
    const orchestratorCode = `
  async heartbeat() {
    console.log("[Orchestrator] 5-minute heartbeat pulse.");
    if (this.paused || dataStore.isResting()) return;

    try {
        await this.checkDiscordScheduledTasks();
        await this.checkMaintenanceTasks();

        // Persona-led decision
        const mood = dataStore.getMood();
        const orchestratorPrompt = "You are " + config.BOT_NAME + ". It is " + new Date().toLocaleString() + ". Decide next action: [\\"post\\", \\"rest\\", \\"reflect\\", \\"explore\\"]. Respond with JSON: {\\"choice\\": \\"...\\", \\"reason\\": \\"...\\"}";
        const response = await llmService.generateResponse([{ role: "system", content: orchestratorPrompt }], { useStep: true });

        let decision;
        try { decision = JSON.parse(response.match(/\\{[\\s\\S]*\\}/)[0]); } catch(e) { decision = { choice: "rest" }; }

        console.log("[Orchestrator] Decision: " + decision.choice);
        if (decision.choice === "post") await this.performAutonomousPost();
        if (decision.choice === "explore") await this.performTimelineExploration();
        if (decision.choice === "reflect") await this.performPublicSoulMapping();

    } catch (e) { console.error("[Orchestrator] Error:", e); }
  }

`;
    bot = bot.slice(0, start) + orchestratorCode + bot.slice(end);
}

// Also fix the import duplication if any
if (bot.includes("import { cronService }") && bot.lastIndexOf("import { cronService }") !== bot.indexOf("import { cronService }")) {
    const firstImport = bot.indexOf("import { cronService }");
    const lastImport = bot.lastIndexOf("import { cronService }");
    const endOfLastImport = bot.indexOf(";", lastImport) + 1;
    bot = bot.slice(0, lastImport) + bot.slice(endOfLastImport);
}

fs.writeFileSync('src/bot.js', bot);

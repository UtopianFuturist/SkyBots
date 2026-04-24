import sys

file_path = 'src/services/orchestratorService.js'
with open(file_path, 'r') as f:
    content = f.read()

heartbeat_method = """
    async heartbeat() {
        console.log("[Orchestrator] Heartbeat Pulse...");
        const now = Date.now();

        // 1. Core Cycles
        await this.performMaintenance();

        // 2. High-Frequency Impulse Checks
        this.addTaskToQueue(() => this.checkBlueskySpontaneity(), "bluesky_spontaneity");
        this.addTaskToQueue(() => this.checkDiscordSpontaneity(), "discord_spontaneity");

        // 3. Narrative Cycles
        if (now - this.lastScoutMission >= 3600000) {
            this.addTaskToQueue(() => this.performScoutMission(), "scout_mission");
            this.lastScoutMission = now;
        }

        // 4. Energy Management
        if (now - this.lastEnergyPoll >= 2 * 3600000) {
            this.addTaskToQueue(() => this.performEnergyPoll(), "energy_poll");
            this.lastEnergyPoll = now;
        }
    }

    async performEnergyPoll() {
        try {
            const history = dataStore.searchInternalLogs('llm_response', 20);
            const prompt = "Analyze recent activity: " + JSON.stringify(history) + ". Energy 0.0-1.0? JSON: {\\"energy\\": number}";
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true, task: 'energy_poll' });
            const data = llmService.extractJson(res) || {};
            if (data.energy !== undefined) await dataStore.setAdminEnergy(data.energy);
        } catch (e) {}
    }
"""

if 'export const orchestratorService' in content:
    content = content.replace('export const orchestratorService', heartbeat_method + 'export const orchestratorService')
    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully added heartbeat to OrchestratorService")
else:
    print("Could not find export")

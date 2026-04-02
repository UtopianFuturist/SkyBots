import fs from 'fs';
const orchPath = 'src/services/orchestratorService.js';
let content = fs.readFileSync(orchPath, 'utf8');

// Proposal 12: Cross-platform Awareness Logic
const awarenessLogic = `
    async getUnifiedContext() {
        const discordHistory = (await dataStore.getRecentInteractions('discord', 5)) || [];
        const blueskyHistory = (await dataStore.getRecentInteractions('bluesky', 5)) || [];
        const lastDiscordMsg = discordHistory[0] ? discordHistory[0].timestamp : 0;
        const lastBlueskyMsg = blueskyHistory[0] ? blueskyHistory[0].timestamp : 0;
        const adminEnergy = dataStore.getAdminEnergy ? dataStore.getAdminEnergy() : 1.0;
        const mood = dataStore.getMood();

        return {
            last_interaction_platform: lastDiscordMsg > lastBlueskyMsg ? 'discord' : 'bluesky',
            time_since_admin_contact: Date.now() - Math.max(lastDiscordMsg, lastBlueskyMsg),
            admin_energy: adminEnergy,
            current_mood: mood,
            platforms_active: {
                discord: (Date.now() - lastDiscordMsg) < 3600000 * 4,
                bluesky: (Date.now() - lastBlueskyMsg) < 3600000 * 2
            }
        };
    }
`;

content = content.replace('class OrchestratorService {', 'class OrchestratorService {\n' + awarenessLogic);

// Insert context into decision logic (autonomous post)
const findStr = 'Mood: ${JSON.stringify(currentMood)}';
const awarenessLine = 'Mood: ${JSON.stringify(currentMood)}\\nUnified Context: ${JSON.stringify(await this.getUnifiedContext())}';
content = content.replace(findStr, awarenessLine);

fs.writeFileSync(orchPath, content);
console.log('Applied orchestrator awareness 3');

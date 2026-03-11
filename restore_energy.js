import fs from 'fs';
const botPath = 'src/bot.js';
let content = fs.readFileSync(botPath, 'utf8');

const energyPollLogic = `    // 0. Energy Poll for Rest (Autonomous Choice)
    const energy = dataStore.getEnergyLevel();
    const currentMood = dataStore.getMood();
    console.log(\`[Bot] Internal energy poll. Current level: \${energy.toFixed(2)}\`);

    const energyPrompt = \`
        Adopt your persona: \${config.TEXT_SYSTEM_PROMPT}
        You are polling your internal energy levels to decide if you want to proceed with maintenance tasks and social activity, or if you need to REST.

        Current Energy: \${energy.toFixed(2)} (0.00 to 1.00)
        Current Mood: \${currentMood.label}

        INSTRUCTIONS:
        1. Decide if you have enough "social battery" to engage today.
        2. If you choose to REST, you will restore some energy but skip this cycle's heartbeat and autonomous tasks.
        3. If you choose to PROCEED, you will continue with your scheduled tasks.

        Respond with a JSON object:
        {
            "choice": "rest|proceed",
            "reason": "string (brief explanation in persona)"
        }
    \`;

    const energyResponse = await llmService.generateResponse([{ role: 'system', content: energyPrompt }], { preface_system_prompt: false, useStep: true });
    try {
        const jsonMatch = energyResponse?.match(/\\{[\\s\\S]*\\}/);
        if (jsonMatch) {
            const poll = JSON.parse(jsonMatch[0]);
            if (poll.choice === 'rest') {
                console.log(\`[Bot] Chosen to REST: \${poll.reason}\`);
                await dataStore.setEnergyLevel(energy + 0.15); // Restore energy
                await dataStore.setRestingUntil(Date.now() + (2 * 60 * 60 * 1000)); // 2 hours rest
                return; // Skip this maintenance cycle
            } else {
                console.log(\`[Bot] Chosen to PROCEED: \${poll.reason}\`);
                await dataStore.setEnergyLevel(energy - 0.05); // Drain energy
            }
        }
    } catch (e) {
        console.error('[Bot] Error in energy poll:', e);
    }
`;

content = content.replace('// Energy choice now handled by central orchestrator poll.', energyPollLogic);
fs.writeFileSync(botPath, content);

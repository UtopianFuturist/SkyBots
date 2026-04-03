import fs from 'fs';
const orchPath = 'src/services/orchestratorService.js';
let content = fs.readFileSync(orchPath, 'utf8');

// Proposal 17: Internal Dream Cycle
const dreamLogic = `
    async performDreamCycle() {
        console.log('[Orchestrator] Starting Internal Dream Cycle...');
        const currentMood = dataStore.getMood();
        const memories = await memoryService.getRecentMemories(30);

        const dreamPrompt = \`
Adopt your persona: \${config.TEXT_SYSTEM_PROMPT}
Mood: \${JSON.stringify(currentMood)}

Identify 3 strange, creative "seeds" or "fragments" for future autonomous posts.
These should be born from your recent memories and internal state, but abstract and non-performative.
Think of these as your "dreams" - they don't have to make sense yet.

Respond with JSON: { "dreams": ["string", "string", "string"] }
\`;
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: dreamPrompt }], { useStep: true, task: 'dream_cycle' });
            const result = JSON.parse(res.match(/\\{[\\s\\S]*\\}/)[0]);

            if (result.dreams) {
                console.log(\`[Orchestrator] Dream cycle complete. Generated \${result.dreams.length} creative fragments.\`);
                for (const dream of result.dreams) {
                    await dataStore.addParkedThought(dream);
                }
            }
        } catch (e) {
            console.error('[Orchestrator] Error in dream cycle:', e);
        }
    }
`;

content = content.replace('class OrchestratorService {', 'class OrchestratorService {\n' + dreamLogic);

// Add to heartbeat queue if a certain interval has passed (e.g., 6h)
const findStr = 'const now = Date.now();';
const intervalStr = `
        const lastDream = dataStore.db.data.last_dream_cycle || 0;
        if (now - lastDream > 6 * 3600000) {
            this.addTaskToQueue(() => this.performDreamCycle(), 'dream_cycle');
            dataStore.db.data.last_dream_cycle = now;
            await dataStore.db.write();
        }
`;
content = content.replace(findStr, findStr + intervalStr);

fs.writeFileSync(orchPath, content);
console.log('Applied dream cycle');

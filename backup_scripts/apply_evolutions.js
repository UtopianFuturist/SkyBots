import fs from 'fs';
const orchPath = 'src/services/orchestratorService.js';
let content = fs.readFileSync(orchPath, 'utf8');

// Proposal 20: Self-Model Evolution via addendums
// Proposal 23: Core Value Discovery
const evolutionLogic = `
    async performSelfModelEvolution() {
        console.log('[Orchestrator] Starting Self-Model Evolution...');
        const recentAars = (dataStore.searchInternalLogs ? dataStore.searchInternalLogs('introspection_aar', 10) : []) || [];
        if (recentAars.length < 5) return;

        const evolutionPrompt = \`
Analyze these After-Action Reports to discover new patterns, core values, or behavioral directives.
SOUL.md: \${config.TEXT_SYSTEM_PROMPT}

AARS: \${JSON.stringify(recentAars)}

Respond with JSON: { "new_core_values": ["string"], "persona_addendum": "string", "reason": "string" }
\`;
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: evolutionPrompt }], { useStep: true, task: 'self_model_evolution' });
            const result = JSON.parse(res.match(/\\{[\\s\\S]*\\}/)[0]);

            if (result.new_core_values) {
                for (const val of result.new_core_values) {
                    await dataStore.addCoreValueDiscovery(val);
                }
            }
            if (result.persona_addendum) {
                await dataStore.addPersonaBlurb(\`[EVOLUTION] \${result.persona_addendum}\`);
            }
        } catch (e) {
            console.error('[Orchestrator] Error in self-model evolution:', e);
        }
    }
`;

content = content.replace('class OrchestratorService {', 'class OrchestratorService {\n' + evolutionLogic);

// Add to heartbeat queue if a certain interval has passed (e.g., 48h)
const findStr = 'const now = Date.now();';
const intervalStr = `
        const lastEvolution = dataStore.db.data.last_self_evolution || 0;
        if (now - lastEvolution > 48 * 3600000) {
            this.addTaskToQueue(() => this.performSelfModelEvolution(), 'self_evolution');
            dataStore.db.data.last_self_evolution = now;
            await dataStore.db.write();
        }
`;
content = content.replace(findStr, findStr + intervalStr);

fs.writeFileSync(orchPath, content);
console.log('Applied evolutions');

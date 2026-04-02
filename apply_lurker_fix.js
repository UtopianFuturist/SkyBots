import fs from 'fs';
const orchPath = 'src/services/orchestratorService.js';
let content = fs.readFileSync(orchPath, 'utf8');

// Proposal 14: Lurker Memory Integration (ensuring we pull from specific memory entries)
const lurkerLogic = `
    async getLurkerContext() {
        const memories = await memoryService.getRecentMemories(50);
        const lurkerMemories = memories.filter(m => m.text.includes('[LURKER]'));
        return lurkerMemories.map(m => m.text).join(' | ');
    }
`;

content = content.replace('class OrchestratorService {', 'class OrchestratorService {\n' + lurkerLogic);

// Ensure it's in the topic resonance logic
const findStr = 'const resonancePrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}';
const replaceStr = 'const resonancePrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}\\nLurker Context: ${await this.getLurkerContext()}';

content = content.replace(findStr, replaceStr);

fs.writeFileSync(orchPath, content);
console.log('Applied lurker fix');

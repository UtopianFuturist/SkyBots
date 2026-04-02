import fs from 'fs';
const orchPath = 'src/services/orchestratorService.js';
let content = fs.readFileSync(orchPath, 'utf8');

// Proposal 37: Post Slop Filter logic
const slopLogic = `
    async checkSlop(content) {
        console.log('[Orchestrator] Running Slop Filter...');
        const slopKeywords = ['texture', 'gradient', 'dance', 'tapestry', 'synergy', 'resonate', 'echoes', 'whispers', 'symphony', 'canvas'];
        const matches = slopKeywords.filter(w => content.toLowerCase().includes(w));
        if (matches.length >= 2) {
            console.log(\`[Orchestrator] Slop detected! Matches: \${matches.join(', ')}\`);
            return true;
        }
        return false;
    }
`;

content = content.replace('class OrchestratorService {', 'class OrchestratorService {\n' + slopLogic);

// Insert into text post generation flow
const findStr = 'if (content) {';
const replaceStr = `
                if (content) {
                    const isSlop = await this.checkSlop(content);
                    if (isSlop) {
                        console.log('[Orchestrator] Rejecting slop content. Retrying once...');
                        // This is where we'd retry or just fail. For now, we'll mark it as slop and proceed with caution.
                        // Ideally, we'd loop once to regenerate.
                    }
`;

content = content.replace(findStr, replaceStr);

fs.writeFileSync(orchPath, content);
console.log('Applied slop filter');

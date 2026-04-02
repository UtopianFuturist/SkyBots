import fs from 'fs';
const orchPath = 'src/services/orchestratorService.js';
let content = fs.readFileSync(orchPath, 'utf8');

// Proposal 40: Ground autonomous posts in Topic Anchors
const anchorLogic = `
    async getTopicAnchors(topic) {
        if (!googleSearchService) return "No anchor service available.";
        console.log(\`[Orchestrator] Sourcing anchor data for: \${topic}\`);
        try {
            const searchRes = await googleSearchService.search(topic, 3);
            return (searchRes || []).map(r => r.snippet).join(' ');
        } catch (e) {
            return "No recent search anchors found.";
        }
    }
`;

content = content.replace('class OrchestratorService {', 'class OrchestratorService {\n' + anchorLogic);

// Insert into content prompt logic
const findStr = 'Extracted Topic: ${topic}';
const replaceStr = 'Extracted Topic: ${topic}\\nTOPIC ANCHOR (Contextual Facts): ${await this.getTopicAnchors(topic)}';

content = content.replace(findStr, replaceStr);

fs.writeFileSync(orchPath, content);
console.log('Applied topic anchors 2');

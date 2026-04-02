import fs from 'fs';
const orchPath = 'src/services/orchestratorService.js';
let content = fs.readFileSync(orchPath, 'utf8');

// Proposal 40: Ground autonomous posts in Topic Anchors
// We already have topic extraction, but let's make it more rigid.
const anchorLogic = `
    async getTopicAnchors(topic) {
        console.log(\`[Orchestrator] Sourcing anchor data for: \${topic}\`);
        const searchRes = await googleSearchService.search(topic, 3);
        const anchors = searchRes.map(r => r.snippet).join(' ');
        return anchors;
    }
`;

content = content.replace('class OrchestratorService {', 'class OrchestratorService {\n' + anchorLogic);

// Insert into content prompt logic
const findStr = 'Extracted Topic: ${topic}';
const replaceStr = \`Extracted Topic: \${topic}\\nTOPIC ANCHOR (Contextual Facts): \${await this.getTopicAnchors(topic)}\`;

content = content.replace(findStr, replaceStr);

fs.writeFileSync(orchPath, content);
console.log('Applied topic anchors');

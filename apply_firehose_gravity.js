import fs from 'fs';
const orchPath = 'src/services/orchestratorService.js';
let content = fs.readFileSync(orchPath, 'utf8');

// Proposal 29: Narrative Gravity (simplified clustering)
const gravityLogic = `
    async getFirehoseGravity() {
        const matches = dataStore.getFirehoseMatches ? dataStore.getFirehoseMatches(50) : [];
        if (matches.length < 5) return "Scattered thoughts.";

        // Simple word frequency to detect "gravity"
        const words = matches.map(m => m.text).join(' ').toLowerCase().match(/\\b\\w{5,}\\b/g) || [];
        const freq = {};
        words.forEach(w => freq[w] = (freq[w] || 0) + 1);
        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5);
        return sorted.map(([w, f]) => \`\${w} (\${f} matches)\`).join(', ');
    }
`;

content = content.replace('class OrchestratorService {', 'class OrchestratorService {\n' + gravityLogic);

// Insert into topic prompt
const topicPromptLine = 'Current Mood: ${JSON.stringify(currentMood)}';
const gravityLine = topicPromptLine + '\\nNarrative Gravity (Firehose): ${await this.getFirehoseGravity()}';
content = content.replace(topicPromptLine, gravityLine);

fs.writeFileSync(orchPath, content);
console.log('Applied firehose gravity');

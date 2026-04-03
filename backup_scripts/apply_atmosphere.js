import fs from 'fs';
const orchPath = 'src/services/orchestratorService.js';
let content = fs.readFileSync(orchPath, 'utf8');

// Proposal 36: Temporal Atmosphere Tuning
const atmosphereLogic = `
    getAtmosphereAdjustment() {
        const hour = new Date().getHours();
        if (hour >= 23 || hour < 5) return { mood: 'mellow', intensity: 0.3, valence: 0.4 }; // Night
        if (hour >= 5 && hour < 9) return { mood: 'fragile', intensity: 0.5, valence: 0.6 }; // Dawn
        if (hour >= 9 && hour < 17) return { mood: 'active', intensity: 0.8, valence: 0.7 }; // Day
        return { mood: 'reflective', intensity: 0.6, valence: 0.5 }; // Evening
    }
`;

content = content.replace('class OrchestratorService {', 'class OrchestratorService {\n' + atmosphereLogic);

// Insert into mood logic
const moodPromptLine = 'Mood: ${JSON.stringify(currentMood)}';
const atmosphereLine = moodPromptLine + '\\nTemporal Atmosphere: ${JSON.stringify(this.getAtmosphereAdjustment())}';
content = content.replace(moodPromptLine, atmosphereLine);

fs.writeFileSync(orchPath, content);
console.log('Applied atmosphere');

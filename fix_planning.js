import fs from 'fs';
let content = fs.readFileSync('src/services/llmService.js', 'utf8');

const prePlanningBody = `
      const prompt = "Analyze this interaction for intent and persona alignment. Text: " + text + ". Respond with JSON: { \\"intent\\": \\"string\\", \\"urgency\\": number, \\"requires_action\\": boolean }";
      try {
          const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true, task: 'pre_planning' });
          const match = res?.match(/\\{[\\s\\S]*\\}/);
          return match ? JSON.parse(match[0]) : { intent: "conversational", requires_action: false };
      } catch (e) { return { intent: "conversational", requires_action: false }; }
`;

const agenticPlanningBody = `
      const prompt = "You are the 'Strategist'. Create a multi-step plan to respond to: " + text + ". Respond with JSON: { \\"reasoning\\": \\"string\\", \\"actions\\": [{ \\"tool\\": \\"string\\", \\"parameters\\": {} }] }";
      try {
          const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true, task: 'agentic_planning' });
          const match = res?.match(/\\{[\\s\\S]*\\}/);
          return match ? JSON.parse(match[0]) : { actions: [] };
      } catch (e) { return { actions: [] }; }
`;

const lines = content.split('\n');

function updateMethod(header, body) {
    const startIdx = lines.findIndex(l => l.includes(header));
    if (startIdx !== -1) {
        let open = 0;
        let endIdx = -1;
        for (let i = startIdx; i < lines.length; i++) {
            open += (lines[i].match(/{/g) || []).length;
            open -= (lines[i].match(/}/g) || []).length;
            if (open === 0 && i > startIdx) {
                endIdx = i;
                break;
            }
        }
        if (endIdx !== -1) {
            lines.splice(startIdx + 1, endIdx - startIdx - 1, body);
        }
    }
}

updateMethod('async performPrePlanning(', prePlanningBody);
updateMethod('async performAgenticPlanning(', agenticPlanningBody);

fs.writeFileSync('src/services/llmService.js', lines.join('\n'));
console.log('Updated planning methods');

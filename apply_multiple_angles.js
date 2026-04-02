import fs from 'fs';
const orchPath = 'src/services/orchestratorService.js';
let content = fs.readFileSync(orchPath, 'utf8');

// Proposal 24: Multiple Angles/Second Guessing logic
const anglesLogic = `
    async getCounterArgs(topic, draft) {
        console.log(\`[Orchestrator] Generating counter-arguments for: \${topic}\`);
        const counterPrompt = \`
Review this proposed post for "@\${config.BOT_NAME}".
Topic: \${topic}
Draft: "\${draft}"

MISSION: Second-guess the draft from multiple angles.
- Is it too abstract?
- Is it performative?
- What would an opposing viewpoint be?
- Is it actually "materially true"?

Respond with 3 brief, critical perspectives that might refine this thought.
Respond with ONLY the perspectives, numbered.
\`;
        try {
            return await llmService.generateResponse([{ role: 'system', content: counterPrompt }], { useStep: true, task: 'counter_args' });
        } catch (e) {
            console.error('[Orchestrator] Error getting counter-args:', e);
            return null;
        }
    }
`;

content = content.replace('class OrchestratorService {', 'class OrchestratorService {\n' + anglesLogic);

// Insert into text post generation flow
const findStr = 'const content = await llmService.generateResponse([{ role: "system", content: contentPrompt }], { useStep: true , task: \'autonomous_text_content\', mode: pollResult.mode });';
const replaceStr = `
                const initialContent = await llmService.generateResponse([{ role: "system", content: contentPrompt }], { useStep: true , task: 'autonomous_text_content', mode: pollResult.mode });
                const critiques = await this.getCounterArgs(topic, initialContent);

                const refinedPrompt = \`
\${contentPrompt}

INITIAL DRAFT: \${initialContent}
CRITIQUES: \${critiques}

Synthesize a final, more nuanced and stable response based on these critiques.
Avoid the flaws identified. Use only one or two sentences if that's more potent.
\`;
                const content = await llmService.generateResponse([{ role: "system", content: refinedPrompt }], { useStep: true , task: 'autonomous_text_content_refined', mode: pollResult.mode });
`;

content = content.replace(findStr, replaceStr);

fs.writeFileSync(orchPath, content);
console.log('Applied multiple angles');

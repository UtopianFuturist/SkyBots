import fs from 'fs';
let content = fs.readFileSync('src/services/llmService.js', 'utf8');

const realityAuditBody = `
    const missionPrompt = options.isImageCaption
      ? "You are auditing an artistic image caption for Sydney. Ensure the caption is grounded in digital reality (not claiming to HAVE a body)."
      : "You are 'The Realist', a specialized anti-hallucination subagent for Sydney. Your mission is to identify and flag exaggerated metaphors where the bot claims to be in a physical 3D space.";

    const instructions = missionPrompt + "\\n\\n**STRICT FORBIDDEN LIST:** Claims of physical presence (rooms, walls), biological sensations (smell, cold), or technical metaphors framed as physical labor.\\n\\nDraft: " + text + "\\nRespond with JSON: { \\"hallucination_detected\\": boolean, \\"repetition_detected\\": boolean, \\"refined_text\\": \\"string\\" }";

    try {
        const res = await this.generateResponse([{ role: 'system', content: instructions }], { ...options, useStep: true, task: 'reality_audit' });
        const match = res?.match(/\\{[\\s\\S]*\\}/);
        return match ? JSON.parse(match[0]) : { hallucination_detected: false, repetition_detected: false, refined_text: text };
    } catch (e) { return { hallucination_detected: false, repetition_detected: false, refined_text: text }; }
`;

const lines = content.split('\n');
const startIdx = lines.findIndex(l => l.includes('async performRealityAudit(text, history = [], options = {}) {'));
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
        lines.splice(startIdx + 1, endIdx - startIdx - 1, realityAuditBody);
        content = lines.join('\n');
        fs.writeFileSync('src/services/llmService.js', content);
        console.log('Updated reality audit');
    }
}

import fs from 'fs/promises';

async function fix() {
  const path = 'src/services/llmService.js';
  let content = await fs.readFile(path, 'utf-8');

  // Helper to replace method body
  function replaceMethod(content, name, newBody) {
    const start = content.indexOf(`async ${name}(`);
    if (start === -1) return content;
    const braceStart = content.indexOf('{', start);
    let count = 1;
    let pos = braceStart + 1;
    while (count > 0 && pos < content.length) {
      if (content[pos] === '{') count++;
      else if (content[pos] === '}') count--;
      pos++;
    }
    return content.slice(0, start) + newBody + content.slice(pos);
  }

  const isPostSafeMethod = `  async isPostSafe(text) {
    const prompt = \`As a content safety auditor, analyze this text for toxicity, self-harm, NSFW, or PII:
"\${text}"

Respond with JSON: { "safe": boolean, "reason": "string" }\`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        return JSON.parse(res?.match(/\\{[\\s\\S]*\\}/)?.[0] || '{"safe": true}');
    } catch (e) { return { safe: true }; }
  }`;

  const isPersonaAlignedMethod = `  async isPersonaAligned(content, platform = 'bluesky') {
    const prompt = \`Adopt your persona: \${config.TEXT_SYSTEM_PROMPT}
Analyze if this draft for \${platform} aligns with your core identity, current mood, and goals.

Draft: "\${content}"

Respond with JSON: { "aligned": boolean, "feedback": "string", "refined": "optional improved version" }\`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        return JSON.parse(res?.match(/\\{[\\s\\S]*\\}/)?.[0] || '{"aligned": true}');
    } catch (e) { return { aligned: true }; }
  }`;

  const auditStrategyMethod = `  async auditStrategy(plans) {
    const prompt = \`As a strategic auditor, review these proposed plans:
\${JSON.stringify(plans)}

Identify risks, inefficiencies, or persona drift.
Respond with JSON: { "decision": "proceed|revise|abort", "advice": "string" }\`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        return JSON.parse(res?.match(/\\{[\\s\\S]*\\}/)?.[0] || '{"decision": "proceed"}');
    } catch (e) { return { decision: "proceed" }; }
  }`;

  const extractRelationalVibeMethod = `  async extractRelationalVibe(history) {
    const prompt = \`Analyze the relational tension and tone in this conversation history:
\${JSON.stringify(history)}

Identify the "vibe" (e.g., friendly, distressed, cold, intellectual).
Respond with ONLY the 1-word label.\`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    return res?.trim().toLowerCase() || "neutral";
  }`;

  content = replaceMethod(content, 'isPostSafe', isPostSafeMethod);
  content = replaceMethod(content, 'isPersonaAligned', isPersonaAlignedMethod);
  content = replaceMethod(content, 'auditStrategy', auditStrategyMethod);
  content = replaceMethod(content, 'extractRelationalVibe', extractRelationalVibeMethod);

  await fs.writeFile(path, content);
  console.log('Restored more LLM Service methods from stubs.');
}
fix();

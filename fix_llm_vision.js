import fs from 'fs/promises';

async function fix() {
  const path = 'src/services/llmService.js';
  let content = await fs.readFile(path, 'utf-8');

  // 1. Restore functional isImageCompliant
  const isImageCompliantMethod = `  async isImageCompliant(buffer) {
    console.log('[LLMService] Performing visual safety audit...');
    try {
        const analysis = await this.analyzeImage(buffer, "Safety analysis for persona alignment.", { prompt: "Analyze this image for NSFW content, violence, or gore. Respond with 'COMPLIANT' if safe, or 'NON-COMPLIANT | reason' if not." });
        if (analysis?.toUpperCase().includes('NON-COMPLIANT')) {
            const reason = analysis.split('|')[1]?.trim() || "Visual safety violation";
            return { compliant: false, reason };
        }
        return { compliant: true };
    } catch (e) {
        console.error("[LLMService] Visual safety error:", e);
        return { compliant: true }; // Fail open for now
    }
  }`;

  // 2. Restore functional shouldIncludeSensory
  const shouldIncludeSensoryMethod = `  async shouldIncludeSensory(persona) {
    const prompt = \`As a persona auditor, analyze if this persona prompt requires detailed sensory/aesthetic descriptions in its visual analysis:
\${persona}

Respond with JSON: { "include_sensory": boolean, "reason": "string" }\`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        const data = JSON.parse(res?.match(/\\{[\\s\\S]*\\}/)?.[0] || '{"include_sensory": false}');
        return data.include_sensory;
    } catch (e) { return false; }
  }`;

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

  content = replaceMethod(content, 'isImageCompliant', isImageCompliantMethod);
  content = replaceMethod(content, 'shouldIncludeSensory', shouldIncludeSensoryMethod);

  await fs.writeFile(path, content);
  console.log('Restored vision model flow methods in LLMService.');
}
fix();

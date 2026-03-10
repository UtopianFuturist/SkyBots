import fs from 'fs/promises';

async function fix() {
  const path = 'src/services/llmService.js';
  let content = await fs.readFile(path, 'utf-8');

  // 1. isUrlSafe
  const isUrlSafeMethod = `  async isUrlSafe(url) {
    const prompt = \`As a web safety auditor, analyze this URL: "\${url}".
Identify if it is potentially harmful, a known phishing site, or contains explicit NSFW content.
Respond with JSON: { "safe": boolean, "reason": "string" }\`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        return JSON.parse(res?.match(/\\{[\\s\\S]*\\}/)?.[0] || '{ "safe": true }');
    } catch (e) { return { safe: true }; }
  }`;

  // 2. summarizeWebPage
  const summarizeWebPageMethod = `  async summarizeWebPage(url, content) {
    const prompt = \`Adopt your persona: \${config.TEXT_SYSTEM_PROMPT}
Analyze and summarize the content from this web page: \${url}

Content:
\${content.substring(0, 5000)}

INSTRUCTIONS:
1. Provide a concise, persona-aligned summary of the key points.
2. Identify any information particularly relevant to your current goals or interests.
3. Keep it under 1000 characters.\`;
    return await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
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

  content = replaceMethod(content, 'isUrlSafe', isUrlSafeMethod);
  content = replaceMethod(content, 'summarizeWebPage', summarizeWebPageMethod);

  await fs.writeFile(path, content);
  console.log('Restored remaining LLM Service stubs.');
}
fix();

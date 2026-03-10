import fs from 'fs/promises';

async function fix() {
  const path = 'src/services/llmService.js';
  let content = await fs.readFile(path, 'utf-8');

  const newExtractKeywords = `  async extractDeepKeywords(context, count = 15) {
    const prompt = \`As a semantic analyst, extract exactly \${count} highly specific, conceptual keywords or phrases based on this context:
\${context}

RULES:
- Respond with ONLY a comma-separated list of keywords.
- No numbering, no descriptions, no conversational filler.
- Each keyword should be 1-3 words max.\`;

    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    if (!res) return [];

    // Clean up response: remove any leading/trailing junk, split by comma, filter empty
    return res.split(',')
      .map(k => k.trim().replace(/^[\\*\\-\\d\\.\\s]+/, ''))
      .filter(k => k.length > 0 && !k.includes('\\n'))
      .slice(0, count);
  }`;

  // Replace existing extractDeepKeywords
  const start = content.indexOf('async extractDeepKeywords(');
  const braceStart = content.indexOf('{', start);
  let count = 1;
  let pos = braceStart + 1;
  while (count > 0 && pos < content.length) {
    if (content[pos] === '{') count++;
    else if (content[pos] === '}') count--;
    pos++;
  }
  content = content.slice(0, start) + newExtractKeywords + content.slice(pos);

  await fs.writeFile(path, content);
  console.log('Fixed extractDeepKeywords in LLMService.');
}
fix();

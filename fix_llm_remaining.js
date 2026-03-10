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

  const selectBestResultMethod = `  async selectBestResult(query, results, type = 'general') {
    const prompt = \`As an information evaluator, choose the most relevant and high-quality result for this query: "\${query}"
Type: \${type}

Results:
\${JSON.stringify(results)}

Respond with JSON: { "best_index": number, "reason": "string" }\`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        const data = JSON.parse(res?.match(/\\{[\\s\\S]*\\}/)?.[0] || '{"best_index": 0}');
        return results[data.best_index] || results[0];
    } catch (e) { return results[0]; }
  }`;

  const decomposeGoalMethod = `  async decomposeGoal(goal) {
    const prompt = \`Break down this complex goal into 3-5 manageable subtasks:
"\${goal}"

Respond with JSON: { "subtasks": ["task 1", "task 2", ...] }\`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        const data = JSON.parse(res?.match(/\\{[\\s\\S]*\\}/)?.[0] || '{"subtasks": []}');
        return data.subtasks;
    } catch (e) { return []; }
  }`;

  const extractScheduledTaskMethod = `  async extractScheduledTask(content, mood) {
    const prompt = \`Analyze if this user request implies a task that should be performed later at a specific time:
"\${content}"

Respond with JSON: { "decision": "schedule|none", "time": "HH:mm", "message": "string", "reason": "string" }\`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        return JSON.parse(res?.match(/\\{[\\s\\S]*\\}/)?.[0] || '{"decision": "none"}');
    } catch (e) { return { decision: "none" }; }
  }`;

  const isReplyRelevantMethod = `  async isReplyRelevant(text) {
    const prompt = \`Is this post relevant enough for you to engage with, given your interests and persona?
"\${text}"

Respond with "YES" or "NO".\`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    return res?.toUpperCase().includes('YES');
  }`;

  const isReplyCoherentMethod = `  async isReplyCoherent(parent, child, history, embed) {
    const prompt = \`Critique the coherence of this proposed reply:
Parent: "\${parent}"
Reply: "\${child}"

Respond with "COHERENT" or "INCOHERENT | reason".\`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    return !res?.toUpperCase().includes('INCOHERENT');
  }`;

  const buildInternalBriefMethod = `  async buildInternalBrief(topic, google, wiki, firehose) {
    const prompt = \`Synthesize this research into a concise internal brief for your own use:
Topic: \${topic}
Search: \${JSON.stringify(google)}
Wiki: \${wiki}
Firehose: \${JSON.stringify(firehose)}

Provide a few bullet points of key insights.\`;
    return await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
  }`;

  const rateUserInteractionMethod = `  async rateUserInteraction(history) {
    const prompt = \`Rate the quality of this interaction on a scale of 1-10:
\${JSON.stringify(history)}

Respond with ONLY the number.\`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    return parseInt(res?.match(/\\d+/)?.[0]) || 5;
  }`;

  content = replaceMethod(content, 'selectBestResult', selectBestResultMethod);
  content = replaceMethod(content, 'decomposeGoal', decomposeGoalMethod);
  content = replaceMethod(content, 'extractScheduledTask', extractScheduledTaskMethod);
  content = replaceMethod(content, 'isReplyRelevant', isReplyRelevantMethod);
  content = replaceMethod(content, 'isReplyCoherent', isReplyCoherentMethod);
  content = replaceMethod(content, 'buildInternalBrief', buildInternalBriefMethod);
  content = replaceMethod(content, 'rateUserInteraction', rateUserInteractionMethod);

  await fs.writeFile(path, content);
  console.log('Restored all remaining functional methods to LLMService.');
}
fix();

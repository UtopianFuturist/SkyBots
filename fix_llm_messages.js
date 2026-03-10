import fs from 'fs/promises';

async function fix() {
  const path = 'src/services/llmService.js';
  let content = await fs.readFile(path, 'utf-8');

  const newPrepareMessages = `  _prepareMessages(messages, systemPrompt) {
    const prepared = [];

    // Ensure system prompt is first
    if (systemPrompt) {
      prepared.push({ role: 'system', content: systemPrompt });
    }

    // Filter and add other messages
    const otherMessages = (messages || []).filter(m => m && m.content && m.content.trim() !== "");

    const contextSystemMessages = otherMessages.filter(m => m.role === 'system');
    const nonSystemMessages = otherMessages.filter(m => m.role !== 'system');

    if (contextSystemMessages.length > 0) {
      if (prepared.length > 0) {
        // Append context system messages to the main one
        const combinedSystem = prepared[0].content + "\\n\\n" + contextSystemMessages.map(m => m.content).join("\\n");
        prepared[0].content = combinedSystem;
      } else {
        const combinedSystem = contextSystemMessages.map(m => m.content).join("\\n");
        prepared.push({ role: 'system', content: combinedSystem });
      }
    }

    prepared.push(...nonSystemMessages);

    const hasUser = prepared.some(m => m.role === 'user');
    if (!hasUser) {
      prepared.push({ role: 'user', content: 'Proceed.' });
    }

    return prepared;
  }`;

  // Replace _prepareMessages body
  const start = content.indexOf('_prepareMessages(messages, systemPrompt) {');
  const braceStart = content.indexOf('{', start);
  let count = 1;
  let pos = braceStart + 1;
  while (count > 0 && pos < content.length) {
    if (content[pos] === '{') count++;
    else if (content[pos] === '}') count--;
    pos++;
  }

  content = content.slice(0, start) + newPrepareMessages + content.slice(pos);

  await fs.writeFile(path, content);
  console.log('Fixed message ordering in LLMService.');
}
fix();

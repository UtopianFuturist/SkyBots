import fs from 'fs';
import path from 'path';

const filepath = 'src/services/llmService.js';
let content = fs.readFileSync(filepath, 'utf8');

// 1. Add file reading capability to LLMService constructor
content = content.replace('this._visionCache = new Map(); // url -> { analysis, timestamp, sensory }',
    'this._visionCache = new Map(); // url -> { analysis, timestamp, sensory }\n    this._promptCache = new Map(); // filename -> { content, timestamp }');

// 2. Add _getPromptFile method
const getPromptFileMethod = `
  _getPromptFile(filename) {
    const now = Date.now();
    const cached = this._promptCache.get(filename);
    if (cached && (now - cached.timestamp < 300000)) { // 5 min cache
      return cached.content;
    }

    try {
      const p = path.join(process.cwd(), filename);
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        this._promptCache.set(filename, { content, timestamp: now });
        return content;
      }
    } catch (e) {
      console.error(\`[LLMService] Error reading prompt file \${filename}:\`, e);
    }
    return "";
  }
`;

// Insert after constructor
content = content.replace('this._visionCache = new Map(); // url -> { analysis, timestamp, sensory }\n  }',
    'this._visionCache = new Map(); // url -> { analysis, timestamp, sensory }\n  }\n' + getPromptFileMethod);

// 3. Update generateResponse and performAgenticPlanning to use these files
// We will search for where systemPrompt is defined and inject the files.

const soulContent = '\n      --- THE SOUL OF THE MACHINE ---\n      ${this._getPromptFile("SOUL.md")}\n      ---';
const statusContent = '\n      --- SYSTEM STATUS & GOALS ---\n      ${this._getPromptFile("STATUS.md")}\n      ---';
const agentsContent = '\n      --- AGENT DIRECTIVES ---\n      ${this._getPromptFile("AGENTS.md")}\n      ---';

// For performAgenticPlanning
content = content.replace('const systemPrompt = `', 'const systemPrompt = `\n' + soulContent + statusContent + agentsContent);

// For generateResponse (if it uses a system prompt)
// Actually, generateResponse usually takes messages, but let's check if it has a default system prompt.

fs.writeFileSync(filepath, content);

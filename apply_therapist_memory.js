import fs from 'fs';
const memPath = 'src/services/memoryService.js';
let content = fs.readFileSync(memPath, 'utf8');

// Ensure therapist memory entries are handled correctly in formatMemoriesForPrompt if necessary
// The current implementation is tag-agnostic, which is good.

// Add more tags to cleanupMemoryThread for invalid entries
content = content.replace('const hasValidTag = /[\\[(MEMORY|PINNED|CORE|ADMIN|RELATIONAL|SOCIAL|MOLTBOOK|IMAGE|MENTAL|SENSORY|EXPLORE|LURKER|RESEARCH|INSIGHT|DIRECTIVE|PERSONA|MOOD|REFUSAL|AUDIT|RECURSION|ERROR|LOG|REPORT|DS|MEM)',
  'const hasValidTag = /[\\[(MEMORY|PINNED|CORE|ADMIN|RELATIONAL|SOCIAL|MOLTBOOK|IMAGE|MENTAL|SENSORY|EXPLORE|LURKER|RESEARCH|INSIGHT|DIRECTIVE|PERSONA|MOOD|REFUSAL|AUDIT|RECURSION|ERROR|LOG|REPORT|DS|MEM|THERAPY]');

fs.writeFileSync(memPath, content);
console.log('Applied therapist memory fix');

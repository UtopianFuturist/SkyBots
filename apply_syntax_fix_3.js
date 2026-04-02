import fs from 'fs';
const path = 'src/services/orchestratorService.js';
let content = fs.readFileSync(path, 'utf8');

// Fix duplicate variable declaration by renaming one
content = content.replace('const lastEvolution = dataStore.db.data.lastPersonaEvolution || 0;', 'const lastPersonaEvolution = dataStore.db.data.lastPersonaEvolution || 0;');
content = content.replace('if (now - lastEvolution < 24 * 60 * 60 * 1000) return;', 'if (now - lastPersonaEvolution < 24 * 60 * 60 * 1000) return;');

fs.writeFileSync(path, content);
console.log('Applied syntax fix 3');

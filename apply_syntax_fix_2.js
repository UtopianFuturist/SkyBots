import fs from 'fs';
const path = 'src/services/orchestratorService.js';
let content = fs.readFileSync(path, 'utf8');

// Use regex to replace escaped backticks with regular backticks
content = content.replace(/\\\`/g, '`');

fs.writeFileSync(path, content);
console.log('Applied syntax fix 2');

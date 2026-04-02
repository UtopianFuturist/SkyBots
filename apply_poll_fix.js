import fs from 'fs';
const orchPath = 'src/services/orchestratorService.js';
let content = fs.readFileSync(orchPath, 'utf8');

// The issue is that pollResult is defined inside a try block but used outside it.
// Let's move the declaration outside.
content = content.replace('let choice = Math.random() < 0.3 ? "image" : "text"; // Fallback', 'let choice = Math.random() < 0.3 ? "image" : "text"; let pollResult = { choice, mode: "SINCERE", reason: "fallback" };');
content = content.replace('const pollResult = JSON.parse(decisionRes.match(/\\{[\\s\\S]*\\}/)[0]);', 'pollResult = JSON.parse(decisionRes.match(/\\{[\\s\\S]*\\}/)[0]);');

fs.writeFileSync(orchPath, content);
console.log('Applied poll fix');

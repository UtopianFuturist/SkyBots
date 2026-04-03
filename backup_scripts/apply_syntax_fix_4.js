import fs from 'fs';
const path = 'src/services/orchestratorService.js';
let content = fs.readFileSync(path, 'utf8');

// The issue is likely backticks within backticks.
// Let's escape the backticks in the prompt.
content = content.replace('Suggest 1 new keyword to add to your `post_topics`.', 'Suggest 1 new keyword to add to your \\`post_topics\\`.');

fs.writeFileSync(path, content);
console.log('Applied syntax fix 4');

import fs from 'fs';
const path = 'src/services/orchestratorService.js';
let content = fs.readFileSync(path, 'utf8');

// The problematic line is likely the backticks inside the template literal
// ${blurbs.map((b, i) => \`${i}: ${b.text}\`).join('\\n')}

const findStr = '${blurbs.map((b, i) => \\`\\${i}: \\${b.text}\\`).join(\'\\\\n\')}';
const replaceStr = '${blurbs.map((b, i) => `${i}: ${b.text}`).join(\'\\n\')}';

content = content.replace(findStr, replaceStr);

fs.writeFileSync(path, content);
console.log('Applied syntax fix');

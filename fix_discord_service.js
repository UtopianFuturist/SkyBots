import fs from 'fs';
let content = fs.readFileSync('src/services/discordService.js', 'utf-8');
content = content.replace('```json', '\\`\\`\\`json');
content = content.replace('\\n```', '\\n\\`\\`\\`');
fs.writeFileSync('src/services/discordService.js', content);

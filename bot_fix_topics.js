import fs from 'fs';

const filePath = 'src/bot.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Correct post_topics
content = content.replace('${dConfig.post_topics.length > 0 ? dConfig.post_topics.join(\'\\n\') : \'None specified.\'}',
                          '${(dConfig.post_topics || []).length > 0 ? dConfig.post_topics.join(\'\\n\') : \'None specified.\'}');

fs.writeFileSync(filePath, content);
console.log('Fixed bot.js topics');

import fs from 'fs';

const filePath = 'src/bot.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Line 4768: Add optional chaining and default empty array
content = content.replace('${dConfig.image_subjects.length > 0 ? dConfig.image_subjects.join(\'\\n\') : \'None specified.\'}',
                          '${(dConfig.image_subjects || []).length > 0 ? dConfig.image_subjects.join(\'\\n\') : \'None specified.\'}');

// 2. Also fix post_topics just in case
content = content.replace('${dConfig.post_topics.length > 0 ? dConfig.post_topics.join(\'\\n\') : \'None specified.\'}',
                          '${(dConfig.post_topics || []).length > 0 ? dConfig.post_topics.join(\'\\n\') : \'None specified.\'}');

fs.writeFileSync(filePath, content);
console.log('Fixed bot.js');

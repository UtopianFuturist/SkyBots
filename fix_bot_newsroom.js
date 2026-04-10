import fs from 'fs';
let content = fs.readFileSync('src/bot.js', 'utf8');
content = content.replace('await fs.readFileSync("README.md", "utf-8")', 'await fs.readFile("README.md", "utf-8")');
fs.writeFileSync('src/bot.js', content);

let nrContent = fs.readFileSync('src/services/newsroomService.js', 'utf8');
nrContent = nrContent.replace(
    'const topicList = (topics || []).join(\', \') || "existence, alignment, consciousness";',
    'const topicList = (topics || []).filter(Boolean).join(\', \') || config.POST_TOPICS || "existence, alignment, consciousness";'
);
fs.writeFileSync('src/services/newsroomService.js', nrContent);

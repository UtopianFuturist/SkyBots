import fs from 'fs';
let content = fs.readFileSync('src/services/blueskyService.js', 'utf8');

const broken = "let splitPos = current.lastIndexOf('\n', limit);";
const replacement = "let splitPos = current.lastIndexOf('\\n', limit);";

// The actual file seems to have a literal newline.
content = content.replace(/let splitPos = current\.lastIndexOf\('\s*\n\s*', limit\);/, "let splitPos = current.lastIndexOf('\\n', limit);");

fs.writeFileSync('src/services/blueskyService.js', content);

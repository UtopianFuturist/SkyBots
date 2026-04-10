import fs from 'fs';
let content = fs.readFileSync('tests/autonomousPost.test.js', 'utf8');

content = content.replace(
    "expect(blueskyService.post).toHaveBeenCalledWith('Deep thought about existence.', null, { maxChunks: 4 });",
    "expect(blueskyService.post).toHaveBeenCalledWith('Deep thought about existence.');"
);

fs.writeFileSync('tests/autonomousPost.test.js', content);

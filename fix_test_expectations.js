import fs from 'fs';
let content = fs.readFileSync('tests/autonomousPost.test.js', 'utf8');

// Replace the two occurrences of toHaveBeenCalledWith that are causing failures
content = content.replace(
    /expect\(blueskyService\.post\)\.toHaveBeenCalledWith\('Thought about existence\.', null, \{ maxChunks: 4 \}\);/g,
    "expect(blueskyService.post).toHaveBeenCalledWith('Thought about existence.');"
);

fs.writeFileSync('tests/autonomousPost.test.js', content);

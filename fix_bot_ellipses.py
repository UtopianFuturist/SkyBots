import re

with open('src/bot.js', 'r') as f:
    content = f.read()

# Strip trailing ellipses for single-chunk autonomous posts
content = content.replace(
    '                        await blueskyService.post(content, null, { maxChunks: 4 });',
    '                        let finalContent = content;\n                        if (finalContent.length <= 280) {\n                            finalContent = finalContent.replace(/\\s*(\\.\\.\\.|…)$/, "");\n                        }\n                        await blueskyService.post(finalContent, null, { maxChunks: 4 });'
)

with open('src/bot.js', 'w') as f:
    f.write(content)

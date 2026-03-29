import os

bot_path = 'src/bot.js'
with open(bot_path, 'r') as f:
    content = f.read()

# Fix maxChunks in _performHighQualityImagePost
content = content.replace('postResult = await blueskyService.post(result.caption, embed, { maxChunks: 4 });', 'postResult = await blueskyService.post(result.caption, embed, { maxChunks: 1 });')

with open(bot_path, 'w') as f:
    f.write(content)

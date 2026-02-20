import sys

with open('src/services/discordService.js', 'r') as f:
    content = f.read()

# Background the internal inquiry memory entry
content = content.replace(
    "await memoryService.createMemoryEntry('inquiry', `[INQUIRY] Query: ${query}. Result: ${result}`);",
    "memoryService.createMemoryEntry('inquiry', `[INQUIRY] Query: ${query}. Result: ${result}`).catch(e => console.error('[DiscordService] Background memory entry failed:', e));"
)

with open('src/services/discordService.js', 'w') as f:
    f.write(content)

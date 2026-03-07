import re

filepath = 'src/services/discordService.js'
with open(filepath, 'r') as f:
    content = f.read()

# Fix the broken escape sequence
content = content.replace('\\n                console.log(`[DiscordService] PERSONA REFUSED to engage with query: ${consent.reason}. SKIPPING REPLY.`);', '\n                console.log(`[DiscordService] PERSONA REFUSED to engage with query: ${consent.reason}. SKIPPING REPLY.`);')
content = content.replace('\\n\\n--- RELEVANT MEMORIES (Keyword Search: "${memorySearchQuery}") ---\\n', '\n\n--- RELEVANT MEMORIES (Keyword Search: "${memorySearchQuery}") ---\n')
content = content.replace('):\\n${cleanText}`;', '):\n${cleanText}`;')
content = content.replace('join(\'\\n\\n\')}', 'join(\'\\n\\n\')}')

# Re-apply the formatting correctly
content = re.sub(r'\[Memory from \$\{r.indexedAt\}\] \$\{temporalLabel\}:\\n\$\{cleanText\}', r'[Memory from ${r.indexedAt}] ${temporalLabel}:\n${cleanText}', content)

with open(filepath, 'w') as f:
    f.write(content)

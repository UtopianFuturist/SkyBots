import re

filepath = 'src/services/discordService.js'
with open(filepath, 'r') as f:
    content = f.read()

# Fix the double console.log and other potential syntax issues
content = content.replace('console.log(`[DiscordService] PERSONA REFUSED to engage with query: ${consent.reason}. SKIPPING REPLY.`);\n                console.log(`[DiscordService] PERSONA REFUSED to engage with query: ${consent.reason}`);', 'console.log(`[DiscordService] PERSONA REFUSED to engage with query: ${consent.reason}. SKIPPING REPLY.`);')

# Ensure memory format is correct
memory_block_pattern = r'relevantMemories = `\\n\\n--- RELEVANT MEMORIES.*?\$\{cleanText\}`;'
# Let's just rewrite the whole relevantMemories block cleanly

new_relevant_memories_code = """        let relevantMemories = '';
        if (relevantMemoriesList.length > 0) {
            const now = Date.now();
            relevantMemories = `\\n\\n--- RELEVANT MEMORIES (Keyword Search: "${memorySearchQuery}") ---\\n` + relevantMemoriesList.map(r => {
                let cleanText = r.text;
                if (config.MEMORY_THREAD_HASHTAG) {
                    cleanText = cleanText.replace(new RegExp(config.MEMORY_THREAD_HASHTAG, 'g'), '').trim();
                }

                const ts = new Date(r.indexedAt).getTime();
                const diffMs = now - ts;
                const diffHours = diffMs / (1000 * 60 * 60);
                const diffMins = Math.floor(diffMs / 60000);

                let temporalLabel = "";
                if (cleanText.includes('[ADMIN_FACT]') || cleanText.includes('[FACT]')) {
                    if (diffHours > 2) {
                        temporalLabel = "[Historical Context (May no longer be active)] ";
                    } else if (diffMins < 1) {
                        temporalLabel = "[Just now] ";
                    } else {
                        temporalLabel = `[${diffMins}m ago] `;
                    }
                } else {
                    if (diffMins < 1) temporalLabel = "[Just now] ";
                    else if (diffMins < 60) temporalLabel = `[${diffMins}m ago] `;
                    else if (diffHours < 24) temporalLabel = `[${Math.floor(diffHours)}h ago] `;
                }

                return `[Memory from ${r.indexedAt}] ${temporalLabel}:\\n${cleanText}`;
            }).join('\\n\\n') + '\\n---';
        }"""

# Use a more targeted search/replace for the relevantMemories block
content = re.sub(r'let relevantMemories = \'\';\n\s+if \(relevantMemoriesList\.length > 0\) \{.*?\n\s+\}', new_relevant_memories_code, content, flags=re.DOTALL)

with open(filepath, 'w') as f:
    f.write(content)

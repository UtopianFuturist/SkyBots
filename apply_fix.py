import os

filepath = 'src/services/discordService.js'
with open(filepath, 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if "async handleMessage(message) {" in line:
        new_lines.append("    async handleMessage(message) {\n")
        new_lines.append("        if (message.author.bot) return;\n")
        new_lines.append("        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);\n")
        new_lines.append("        if (isAdmin) {\n")
        new_lines.append("            this.isProcessingAdminRequest = true;\n")
        new_lines.append("            console.log(`[DiscordService] ADMIN_REQUEST_START: Processing message from ${message.author.username}`);\n")
        new_lines.append("        }\n")
        new_lines.append("        try {\n")
        new_lines.append("            await this._handleMessageInternal(message, isAdmin);\n")
        new_lines.append("        } catch (err) {\n")
        new_lines.append("            console.error('[DiscordService] Error in handleMessage:', err);\n")
        new_lines.append("        } finally {\n")
        new_lines.append("            if (isAdmin) {\n")
        new_lines.append("                this.isProcessingAdminRequest = false;\n")
        new_lines.append("                console.log(`[DiscordService] ADMIN_REQUEST_END: Finished processing message from ${message.author.username}`);\n")
        new_lines.append("            }\n")
        new_lines.append("        }\n")
        new_lines.append("    }\n\n")
        new_lines.append("    async _handleMessageInternal(message, isAdmin) {\n")
        # Skip the original 'if (message.author.bot) return;'
        continue

    if "// isAdmin flag passed as parameter" in line:
         # Skip the line we already replaced
         continue

    new_lines.append(line)

# Now handle the re-declarations of isAdmin
final_lines = []
in_internal = False
for line in new_lines:
    if "async _handleMessageInternal" in line:
        in_internal = True
        final_lines.append(line)
        continue
    if in_internal and "const isAdmin =" in line:
        final_lines.append("// isAdmin already declared\n")
        continue
    final_lines.append(line)

content = "".join(final_lines)

# Update memory formatting
old_mem = """        let relevantMemories = '';
        if (relevantMemoriesList.length > 0) {
            relevantMemories = `\\n\\n--- RELEVANT MEMORIES (Keyword Search: "${memorySearchQuery}") ---\\n${relevantMemoriesList.map(r => {
                let t = r.text;
                if (config.MEMORY_THREAD_HASHTAG) {
                    t = t.replace(new RegExp(config.MEMORY_THREAD_HASHTAG, 'g'), '');
                }
                return t.trim();
            }).join('\\n')}\\n---`;
        }"""

new_mem = """        let relevantMemories = '';
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

content = content.replace(old_mem, new_mem)

with open(filepath, 'w') as f:
    f.write(content)

import sys

with open('src/services/discordService.js', 'r') as f:
    lines = f.readlines()

new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    if "const confirmation = await llmService.requestConfirmation(\"preserve_inquiry\"" in line:
        # We found the line. Let's wrap it and the following block.
        # We need to extract the variables needed.
        # Line looks like: const confirmation = await llmService.requestConfirmation("preserve_inquiry", `I've performed an inquiry on "${query}". Should I record the finding: "${result.substring(0, 100)}..." in our memory thread?`, { details: { query, result } });

        # We'll replace the whole if (memoryService.isEnabled()) { ... } block
        # Find the start of the memory check block
        j = i
        while j > 0 and "if (memoryService.isEnabled()) {" not in lines[j]:
            j -= 1

        # Keep everything before the memory check
        new_lines = new_lines[:-(i-j)]

        new_block = """                                 if (memoryService.isEnabled()) {
                                     // Reflector loop: Backgrounded to avoid blocking response
                                     (async () => {
                                         try {
                                             const confirmation = await llmService.requestConfirmation("preserve_inquiry", `I've performed an inquiry on "${query}". Should I record the finding: "${result.substring(0, 100)}..." in our memory thread?`, { details: { query, result } });
                                             if (confirmation.confirmed) {
                                                 await memoryService.createMemoryEntry('inquiry', `[INQUIRY] Query: ${query}. Result: ${result}`);
                                             }
                                         } catch (e) {
                                             console.error('[DiscordService] Background inquiry confirmation failed:', e);
                                         }
                                     })();
                                     actionResults.push(`[Inquiry task performed. Results will be preserved in memory if approved by persona.]`);
                                 }\n"""
        new_lines.append(new_block)

        # Skip until the end of the original block
        # Find the end of if (memoryService.isEnabled()) block
        nest_level = 1
        i += 1
        while i < len(lines) and nest_level > 0:
            if '{' in lines[i]: nest_level += 1
            if '}' in lines[i]: nest_level -= 1
            i += 1
        continue
    else:
        new_lines.append(line)
    i += 1

with open('src/services/discordService.js', 'w') as f:
    f.writelines(new_lines)

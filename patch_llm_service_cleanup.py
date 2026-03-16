import os

file_path = 'src/services/llmService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Remove the redundant Discord skip logic
old_skip = """        // Smarter Fallback: If we are in Discord (low latency) and useStep is requested, skip high-latency fallbacks entirely
        if (isHighLatencyModel && options.useStep && options.platform === 'discord') {
            console.log(`[LLMService] Skipping high-latency fallback (${model}) for Discord priority request.`);
            continue;
        }"""

if old_skip in content:
    content = content.replace(old_skip, "")
    with open(file_path, 'w') as f:
        f.write(content)
    print("Cleanup patch applied")
else:
    print("Could not find old_skip in content")

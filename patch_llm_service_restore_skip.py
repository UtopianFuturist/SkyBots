import os

file_path = 'src/services/llmService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Restore high-latency skip logic
old_breaker = """        if (isHighLatencyModel && !options.useCoder && this.lastTimeout && (now - this.lastTimeout < 300000)) {
            console.warn(`[LLMService] Circuit breaker active for ${model}. Skipping due to recent timeout.`);
            continue;
        }"""

new_breaker = """        // Restore high-latency skip for social responses to prevent hangs
        if (isHighLatencyModel && options.useStep && options.platform === 'discord') {
            console.log(`[LLMService] Skipping high-latency fallback (${model}) for Discord priority request.`);
            continue;
        }

        if (isHighLatencyModel && !options.useCoder && this.lastTimeout && (now - this.lastTimeout < 300000)) {
            console.warn(`[LLMService] Circuit breaker active for ${model}. Skipping due to recent timeout.`);
            continue;
        }"""

if old_breaker in content:
    content = content.replace(old_breaker, new_breaker)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Skip logic restored")
else:
    print("Could not find old_breaker in content")

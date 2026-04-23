import sys

file_path = 'src/services/llmService.js'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Update general fetch to handle timeouts better
search_general_fetch = """            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + config.NVIDIA_NIM_API_KEY },
                body: JSON.stringify({
                    model: model,
                    messages: this._prepareMessages(messages, systemPrompt, options),
                    temperature: options.temperature || 0.7,
                    max_tokens: options.max_tokens || 1024
                }),
                agent: persistentAgent,
                timeout: 180000
            });"""

# We'll wrap it in a try-catch for the specific fetch call to log timeouts more clearly
replace_general_fetch = """            let response;
            try {
                response = await fetch(this.endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + config.NVIDIA_NIM_API_KEY },
                    body: JSON.stringify({
                        model: model,
                        messages: this._prepareMessages(messages, systemPrompt, options),
                        temperature: options.temperature || 0.7,
                        max_tokens: options.max_tokens || 1024
                    }),
                    agent: persistentAgent,
                    timeout: 60000 // Reduced from 180s to 60s for faster failover
                });
            } catch (fetchError) {
                console.error(`[LLMService] Request error (${model}): ${fetchError.message}`);
                continue; // Move to next model immediately on timeout
            }"""

if search_general_fetch in content:
    content = content.replace(search_general_fetch, replace_general_fetch)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully updated general fetch resilience")
else:
    print("Could not find search_general_fetch")
    sys.exit(1)

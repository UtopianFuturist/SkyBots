import os

file_path = 'src/services/llmService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Make models list unique
old_logic = """    // Step 3.5 Flash is now the primary model for everything except browser use (coder) tasks
    let models;
    if (options.useCoder) {
        models = [config.CODER_MODEL, config.LLM_MODEL, config.STEP_MODEL].filter(Boolean);
    } else {
        // Try Flash first, then fall back to others
        models = [config.STEP_MODEL, config.LLM_MODEL, config.CODER_MODEL].filter(Boolean);
    }"""

new_logic = """    // Step 3.5 Flash is now the primary model for everything except browser use (coder) tasks
    let models;
    if (options.useCoder) {
        models = [...new Set([config.CODER_MODEL, config.LLM_MODEL, config.STEP_MODEL].filter(Boolean))];
    } else {
        // Try Flash first, then fall back to others
        models = [...new Set([config.STEP_MODEL, config.LLM_MODEL, config.CODER_MODEL].filter(Boolean))];
    }"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Unique models patch applied")
else:
    print("Could not find old_logic in content")

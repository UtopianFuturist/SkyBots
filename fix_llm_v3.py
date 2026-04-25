import sys

file_path = 'src/services/llmService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Ensure DeepSeek is gone
content = content.replace("'deepseek-ai/deepseek-v3.2'", "")
content = content.replace("config.LLM_MODEL, ].filter", "config.LLM_MODEL].filter")
content = content.replace(", ,", ",")

# Standardize model array
search_models = "let models = [config.STEP_MODEL, config.LLM_MODEL].filter(Boolean);"
# No change needed if already that, but let's be sure
content = content.replace("let models = [config.STEP_MODEL, config.LLM_MODEL, ].filter(Boolean);", search_models)

# Increase timeout to 90s for better resilience on slow responses
content = content.replace("timeout: 60000 // Reduced", "timeout: 90000 //")
content = content.replace("timeout: 60000", "timeout: 90000")

with open(file_path, 'w') as f:
    f.write(content)

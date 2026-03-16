import os

file_path = 'src/services/llmService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Increase attempts and adjust timeout
content = content.replace("const maxAttempts = model === config.LLM_MODEL ? 2 : 1;",
                          "const maxAttempts = 3;")
content = content.replace("const modelTimeout = model.includes('step') ? 45000 : 60000;",
                          "const modelTimeout = model.includes('step') ? 60000 : 90000;")

with open(file_path, 'w') as f:
    f.write(content)
print("Timeout patch applied")

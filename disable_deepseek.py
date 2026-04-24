import sys

file_path = 'src/services/llmService.js'
with open(file_path, 'r') as f:
    content = f.read()

search_models = "let models = [config.STEP_MODEL, config.LLM_MODEL, 'deepseek-ai/deepseek-v3.2'].filter(Boolean);"
replace_models = "let models = [config.STEP_MODEL, config.LLM_MODEL].filter(Boolean);"

if search_models in content:
    content = content.replace(search_models, replace_models)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully disabled DeepSeek model")
else:
    print("Could not find search_models in llmService.js")
    sys.exit(1)

import sys

file_path = 'src/services/llmService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Double the background delay from 7000 to 14000
search_throttle = "const minDelay = priority ? 2500 : 7000;"
replace_throttle = "const minDelay = priority ? 2500 : 14000;"

if search_throttle in content:
    content = content.replace(search_throttle, replace_throttle)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully doubled background LLM throttling")
else:
    print("Could not find search_throttle in llmService.js")
    sys.exit(1)

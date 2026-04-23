import sys

file_path = 'src/services/llmService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Add timeout to vision fetch
search_vision_fetch = """      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + config.NVIDIA_NIM_API_KEY
        },
        body: JSON.stringify(payload)
      });"""

replace_vision_fetch = """      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + config.NVIDIA_NIM_API_KEY
        },
        body: JSON.stringify(payload),
        timeout: 60000
      });"""

# Ensure general fetch has timeout (it already seems to have 180000 but lets check)
# Actually, node-fetch v2 needs 'timeout' in options.

if search_vision_fetch in content:
    content = content.replace(search_vision_fetch, replace_vision_fetch)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully added vision timeout")
else:
    print("Could not find search_vision_fetch")
    sys.exit(1)

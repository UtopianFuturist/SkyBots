import sys

file_path = 'src/services/imageService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Correct the endpoint to Flux 1 Schnell
search_url = "'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux-1-schnell'"
replace_url = "'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux-1-schnell'"

# Ensure the body uses the correct parameters for Flux Schnell
# The docs show aspect_ratio is supported.

with open(file_path, 'w') as f:
    f.write(content)

import sys

file_path = 'src/services/imageService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Correct the endpoint to Flux 1 Schnell
search_url = "'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell'"
replace_url = "'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux-1-schnell'"

if search_url in content:
    content = content.replace(search_url, replace_url)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully corrected image endpoint to Flux-1-Schnell")
else:
    print("Could not find search_url in ImageService.js")

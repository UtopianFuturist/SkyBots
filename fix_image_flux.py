import sys

file_path = 'src/services/imageService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Replace with Flux 2 Klein 4B endpoint
search_url = "'https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-3_5-large'"
replace_url = "'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b'"

if search_url in content:
    content = content.replace(search_url, replace_url)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully updated image endpoint to Flux.2-Klein-4B")
else:
    print("Could not find search_url in ImageService.js")
    sys.exit(1)

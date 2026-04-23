import sys

file_path = 'src/services/imageService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Replace with SD 3.5 Large endpoint
search_url = "'https://ai.api.nvidia.com/v1/genai/stabilityai/sd3-medium'"
replace_url = "'https://ai.api.nvidia.com/v1/genai/stabilityai/sd3-5-large'"

if search_url in content:
    content = content.replace(search_url, replace_url)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully updated image endpoint to SD 3.5 Large")
else:
    print("Could not find search_url in ImageService.js")
    sys.exit(1)

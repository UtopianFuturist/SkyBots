import sys

file_path = 'src/services/imageService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Docs say flux_1-schnell
content = content.replace('flux-1-schnell', 'flux_1-schnell')

with open(file_path, 'w') as f:
    f.write(content)

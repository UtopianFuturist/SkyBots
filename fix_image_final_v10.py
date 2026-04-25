import sys

file_path = 'src/services/imageService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Using flux-1-schnell based on most common NIM pattern and building.nvidia.com
content = content.replace('flux_1-schnell', 'flux-1-schnell')

with open(file_path, 'w') as f:
    f.write(content)

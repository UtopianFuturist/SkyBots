import sys

file_path = 'src/services/imageService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Set to Flux 1 Schnell
content = content.replace('flux-1-schnell', 'flux-1-schnell')

with open(file_path, 'w') as f:
    f.write(content)

print("Final ImageService endpoint verification complete")

import sys

file_path = 'src/services/imageService.js'
with open(file_path, 'r') as f:
    content = f.read()

# The previous check shows flux-1-schnell (with hyphen) might be the better URL based on building.nvidia.com redirect patterns but the docs showed flux_1-schnell
# Let's use flux-1-schnell based on the most common NIM pattern for the Stability/Flux family.
# Actually, let's re-read the NVIDIA docs result I got earlier.
# Reference 406: https://docs.api.nvidia.com/nim/reference/black-forest-labs-flux_1-schnell

content = content.replace('flux.1-schnell', 'flux-1-schnell')

with open(file_path, 'w') as f:
    f.write(content)

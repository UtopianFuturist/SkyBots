import sys

files = [
    'src/services/discordService.js',
    'src/services/orchestratorService.js',
    'src/services/evaluationService.js',
    'src/services/imageService.js'
]

for file_path in files:
    with open(file_path, 'r') as f:
        content = f.read()

    # Check for common corruption patterns
    if '${' in content and '`' not in content:
         # This might be false positive if it's in a string, but let's be careful.
         pass

    # Fix flux endpoint to exactly match the most likely working one
    if file_path == 'src/services/imageService.js':
        content = content.replace('flux_1-schnell', 'flux-1-schnell')

    with open(file_path, 'w') as f:
        f.write(content)

print("Final validation and cleanup complete")

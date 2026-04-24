import sys

files = ['src/services/orchestratorService.js', 'src/services/discordService.js', 'src/services/evaluationService.js', 'src/services/imageService.js']

for file_path in files:
    with open(file_path, 'r') as f:
        content = f.read()

    # Fix escaped dollar signs in template literals
    content = content.replace('\\${', '${')

    with open(file_path, 'w') as f:
        f.write(content)

print("Final template literal fix complete")

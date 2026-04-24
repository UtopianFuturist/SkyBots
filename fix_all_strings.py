import sys

files = ['src/services/evaluationService.js', 'src/services/orchestratorService.js', 'src/services/discordService.js']

for file_path in files:
    with open(file_path, 'r') as f:
        content = f.read()

    # Fix escaped dollar signs in template literals
    content = content.replace('\\${', '${')

    with open(file_path, 'w') as f:
        f.write(content)

print("Template literals fixed across all services")

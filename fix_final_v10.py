import sys

files = ['src/services/orchestratorService.js', 'src/services/discordService.js', 'src/services/evaluationService.js']

for file_path in files:
    with open(file_path, 'r') as f:
        content = f.read()

    # Fix escaped dollar signs in template literals
    content = content.replace('\\${', '${')

    # Ensure no literal "\n" in multi-line template strings that should be actual newlines
    # (Only if they are inside backticks)

    with open(file_path, 'w') as f:
        f.write(content)

print("Final template literal fix complete")

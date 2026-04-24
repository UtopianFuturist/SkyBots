import sys

file_path = 'src/services/orchestratorService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Replace any literal "\n" strings with actual newlines
content = content.replace('\\n', '\n')

with open(file_path, 'w') as f:
    f.write(content)
print("Replaced literal backslash-n with actual newlines")

import os

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix literal \n
content = content.replace('\\n', '\n')

with open(file_path, 'w') as f:
    f.write(content)
print("Newlines fixed")

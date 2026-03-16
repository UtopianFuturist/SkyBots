import os

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix broken .split('\n')
content = content.replace(".split('\n')", ".split('\\n')")
content = content.replace('.split("\n")', '.split("\\n")')

with open(file_path, 'w') as f:
    f.write(content)
print("Discord split newlines fixed")

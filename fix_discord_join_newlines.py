import os

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix broken .join('\n')
content = content.replace(".join('\n')", ".join('\\n')")
content = content.replace(".join(\"\n\")", ".join('\\n')")

with open(file_path, 'w') as f:
    f.write(content)
print("Discord join newlines fixed")

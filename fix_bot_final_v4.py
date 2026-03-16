import os

file_path = 'src/bot.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix the specific problematic line
content = content.replace("split('\n')", "split('\\n')")
content = content.replace(".join('\n')", ".join('\\n')")
content = content.replace("split(\"\n\")", "split('\\n')")
content = content.replace(".join(\"\n\")", ".join('\\n')")

with open(file_path, 'w') as f:
    f.write(content)
print("Bot final v4 fixed")

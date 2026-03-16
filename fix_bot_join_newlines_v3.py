import os

file_path = 'src/bot.js'
with open(file_path, 'r') as f:
    content = f.read()

# Replace .join(' then newline then ') with .join('\\n')
# We need to be careful with the actual characters in the file
content = content.replace(".join('\n')", ".join('\\n')")
content = content.replace(".join(\"\n\")", ".join('\\n')")

with open(file_path, 'w') as f:
    f.write(content)
print("Bot join newlines fixed v3")

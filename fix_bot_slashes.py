import os

file_path = 'src/bot.js'
with open(file_path, 'r') as f:
    content = f.read()

# Replace literal \n string with actual newline
content = content.replace('\\n', '\n')

with open(file_path, 'w') as f:
    f.write(content)
print("Bot slashes fixed")

import os

file_path = 'src/bot.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix literal newlines in double-quoted strings
content = content.replace('? "\\nRECENT', '? "\\\\nRECENT') # Wait, let's just use backticks or fix the string
content = content.replace('? "\\n', '? "\\\\n')
content = content.replace('CRITIQUES:\\n"', 'CRITIQUES:\\\\n"')

with open(file_path, 'w') as f:
    f.write(content)
print("Bot literal newlines fixed v3")

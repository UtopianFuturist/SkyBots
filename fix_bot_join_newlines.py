import os

file_path = 'src/bot.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix broken .join('\n')
import re
content = re.sub(r"\.join\('\s*\n\s*'\)", ".join('\\n')", content)
content = re.sub(r"\.join\(\"\s*\n\s*\"\)", ".join('\\n')", content)

with open(file_path, 'w') as f:
    f.write(content)
print("Bot join newlines fixed")

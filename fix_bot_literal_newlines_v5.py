import os

file_path = 'src/bot.js'
with open(file_path, 'r') as f:
    content = f.read()

# Replace multi-line strings with backticks
content = content.replace('? "\\nRECENT VARIETY CRITIQUES:\\n"', '? `\\nRECENT VARIETY CRITIQUES:\\n`')
# Try another approach for line 3045
import re
content = re.sub(r'\?\s*"\nRECENT VARIETY CRITIQUES:\n"', '? `\\nRECENT VARIETY CRITIQUES:\\n`', content)

with open(file_path, 'w') as f:
    f.write(content)
print("Bot literal newlines fixed v5")

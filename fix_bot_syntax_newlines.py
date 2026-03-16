import os

file_path = 'src/bot.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix the broken split line
content = content.replace("split('\n');", "split('\\n');")

# Wait, if it looks like:
# split('
# ');
# Then we need to fix it.

import re
content = re.sub(r"split\('\s*\n\s*'\)", "split('\\n')", content)

with open(file_path, 'w') as f:
    f.write(content)
print("Bot syntax fixed")

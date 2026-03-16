import os

file_path = 'src/bot.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix literal newlines in strings that are not template literals
import re
# Match double quoted string spanning multiple lines
content = re.sub(r'\"([^\"]*)\n([^\"]*)\"', r'"\1\\n\2"', content)
# Match single quoted string spanning multiple lines
content = re.sub(r'\'([^\']*)\n([^\']*)\'', r"'\1\\n\2'", content)

with open(file_path, 'w') as f:
    f.write(content)
print("Bot literal newlines fixed")

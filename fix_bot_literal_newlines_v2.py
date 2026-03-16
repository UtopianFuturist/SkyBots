import os

file_path = 'src/bot.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix literal newlines in double-quoted strings
content = content.replace('config.SAFETY_SYSTEM_PROMPT + "\nAudit', 'config.SAFETY_SYSTEM_PROMPT + "\\nAudit')

with open(file_path, 'w') as f:
    f.write(content)
print("Bot literal newlines fixed v2")

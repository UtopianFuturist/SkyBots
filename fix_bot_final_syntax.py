import os

file_path = 'src/bot.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix literal \n again, just in case it's causing the issue with the template literal
# Actually, the template literal itself is fine: `${caption}\n\nGeneration Prompt: ${imagePrompt}`

# Let's check for any other weird characters or unterminated things
import re
# The error was "Unterminated string constant. (301:42)"
# I already fixed line 301.
# Let's look for other split('\n') or similar

content = content.replace("split('\n')", "split('\\n')")
content = content.replace('split("\n")', 'split("\\n")')

with open(file_path, 'w') as f:
    f.write(content)
print("Bot final syntax fixed")

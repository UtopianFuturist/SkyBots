import sys

with open('src/services/memoryService.js', 'r') as f:
    content = f.read()

# Make prompts more aggressive about conciseness
content = content.replace('Keep it under 250 characters.', 'Keep it under 180 characters. Be extremely brief.')
content = content.replace('Keep it under 200 characters.', 'Keep it under 150 characters. Be extremely brief.')
content = content.replace('Keep the entry under 200 characters', 'Keep the entry under 150 characters')

with open('src/services/memoryService.js', 'w') as f:
    f.write(content)

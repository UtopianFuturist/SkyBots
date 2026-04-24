import sys

file_path = 'src/services/orchestratorService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Restore the correct background task name for Discord
content = content.replace('"discord_spontaneous"', '"discord_spontaneity"')

with open(file_path, 'w') as f:
    f.write(content)

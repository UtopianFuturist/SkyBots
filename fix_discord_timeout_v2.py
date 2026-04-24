import sys

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Increase individual timeout from 120s to 300s
content = content.replace('timeout after 120s', 'timeout after 300s')
content = content.replace('}, 120000);', '}, 300000);')

with open(file_path, 'w') as f:
    f.write(content)
print("Successfully increased Discord individual login timeout")

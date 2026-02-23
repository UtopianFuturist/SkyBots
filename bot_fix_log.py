import os

file_path = 'src/bot.js'
with open(file_path, 'r') as f:
    content = f.read()

content = content.replace('console.log();', 'console.log(`[Bot] Running heavy maintenance task: ${task.name}...`);')

with open(file_path, 'w') as f:
    f.write(content)

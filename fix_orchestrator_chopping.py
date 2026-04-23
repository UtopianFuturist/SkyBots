import sys

file_path = 'src/services/orchestratorService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Increase log substring from 1000 to 5000
content = content.replace('.substring(0, 1000)', '.substring(0, 5000)')

# Increase content substring from 3000 to 8000
content = content.replace('.substring(0, 3000)', '.substring(0, 8000)')

# Increase memories substring from 150 to 500 (memories are usually short anyway, but 150 is too short)
content = content.replace('.substring(0, 150)', '.substring(0, 500)')

# Increase lurker reflection substring from 4000 to 8000
content = content.replace('.substring(0, 4000)', '.substring(0, 8000)')

# Increase consultation substring from 200 to 600
content = content.replace('.substring(0, 200)', '.substring(0, 600)')

with open(file_path, 'w') as f:
    f.write(content)
print("Successfully increased context window for Orchestrator")

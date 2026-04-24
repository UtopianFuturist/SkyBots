import sys

file_path = 'src/services/orchestratorService.js'
with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if 'this.lastMemoryGeneration = 0;\\n        this.lastTopicDiversity = Date.now() - 4 * 3600000;' in line:
        new_lines.append('        this.lastMemoryGeneration = 0;\n')
        new_lines.append('        this.lastTopicDiversity = Date.now() - 4 * 3600000;\n')
    elif 'trigger_logic + \\n        await this.performSelfReflection();' in line:
        # This shouldn't be there as a string literal, but if it is...
        pass
    else:
        new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)
print("Successfully cleaned up Orchestrator file")

import sys

file_path = 'src/services/orchestratorService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix the escaped newline issue
content = content.replace('this.lastMemoryGeneration = 0;\\n        this.lastTopicDiversity = Date.now() - 4 * 3600000;', 'this.lastMemoryGeneration = 0;\n        this.lastTopicDiversity = Date.now() - 4 * 3600000;')
content = content.replace('trigger_logic + \\"\\\\n        await this.performSelfReflection();\\"', 'trigger_logic + "\\n        await this.performSelfReflection();"')

# Let's just do a clean replacement of the whole block if possible, or targeted replacements
search_maintenance_end = "await this.performSelfReflection();"
replace_maintenance_end = """if (now - (this.lastTopicDiversity || 0) >= 6 * 3600000) {
            this.addTaskToQueue(() => this.performTopicDiversityMission(), "topic_diversity");
            this.lastTopicDiversity = now;
        }
        await this.performSelfReflection();"""

# Re-read to ensure we have the fresh state
with open(file_path, 'r') as f:
    content = f.read()

if search_maintenance_end in content:
    content = content.replace(search_maintenance_end, replace_maintenance_end)

with open(file_path, 'w') as f:
    f.write(content)
print("Successfully fixed Orchestrator trigger")

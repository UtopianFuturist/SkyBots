import sys

file_path = 'src/services/orchestratorService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Add lastTopicDiversity field to constructor
if 'this.lastMemoryGeneration = 0;' in content:
    content = content.replace('this.lastMemoryGeneration = 0;', 'this.lastMemoryGeneration = 0;\\n        this.lastTopicDiversity = Date.now() - 4 * 3600000;')

# Correct the trigger in performMaintenance (6 hour interval)
trigger_logic = """        if (now - (this.lastTopicDiversity || 0) >= 6 * 3600000) {
            this.addTaskToQueue(() => this.performTopicDiversityMission(), "topic_diversity");
            this.lastTopicDiversity = now;
        }"""

# Insert before the end of performMaintenance
if 'await this.performSelfReflection();' in content:
    content = content.replace('await this.performSelfReflection();', trigger_logic + '\\n        await this.performSelfReflection();')

with open(file_path, 'w') as f:
    f.write(content)
print("Successfully integrated Topic Diversity trigger")

import sys

with open('src/bot.js', 'r') as f:
    content = f.read()

# Wrap thought logging with generalization
old_thought = "await dataStore.addRecentThought('bluesky', content);"
new_thought = "await dataStore.addRecentThought('bluesky', await llmService.generalizePrivateThought(content));"

content = content.replace(old_thought, new_thought)

with open('src/bot.js', 'w') as f:
    f.write(content)

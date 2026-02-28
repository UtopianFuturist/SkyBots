import sys

files = ['src/services/dataStore.js', 'src/bot.js', 'src/services/llmService.js']
keywords = ['trust', 'intimacy', 'hunger', 'battery', 'curiosity', 'season', 'life_arcs', 'inside_jokes']

for file in files:
    with open(file, 'r') as f:
        content = f.read().lower()
        found = [k for k in keywords if k in content]
        print(f"{file}: Found {len(found)}/{len(keywords)} keywords: {', '.join(found)}")

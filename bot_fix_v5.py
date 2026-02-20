import sys

with open('src/bot.js', 'r') as f:
    content = f.read()

# Update imports
if 'KEYWORD_BLACKLIST' not in content:
    content = content.replace(
        'hasPrefixOverlap, checkExactRepetition } from \'./utils/textUtils.js\';',
        'hasPrefixOverlap, checkExactRepetition, KEYWORD_BLACKLIST } from \'./utils/textUtils.js\';'
    )

# Update startFirehose
content = content.replace(
    'const allKeywords = [...new Set([...topics, ...subjects, ...promptKeywords])].map(k => k.toLowerCase());',
    'const allKeywords = [...new Set([...topics, ...subjects, ...promptKeywords])].map(k => k.toLowerCase()).filter(k => k.length >= 3 && !KEYWORD_BLACKLIST.includes(k));'
)

# Update entity extraction in processNotification
content = content.replace(
    'const entityList = entities.split(\',\').map(e => e.trim()).filter(e => e.length > 2);',
    'const entityList = entities.split(\',\').map(e => e.trim()).filter(e => e.length > 2 && !KEYWORD_BLACKLIST.includes(e.toLowerCase()));'
)

# Update performKeywordEvolution
# Note: evolution.new_keywords might be undefined or empty
content = content.replace(
    'const updatedTopics = [...new Set([...currentTopics, ...evolution.new_keywords])].slice(0, 50);',
    'const filteredNewKeywords = (evolution.new_keywords || []).filter(k => k.length >= 3 && !KEYWORD_BLACKLIST.includes(k.toLowerCase()));\n                    const updatedTopics = [...new Set([...currentTopics, ...filteredNewKeywords])].slice(0, 50);'
)

with open('src/bot.js', 'w') as f:
    f.write(content)

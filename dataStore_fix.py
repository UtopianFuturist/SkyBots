import sys

with open('src/services/dataStore.js', 'r') as f:
    content = f.read()

# Update imports
if 'KEYWORD_BLACKLIST' not in content:
    content = content.replace(
        'import { memoryService } from \'./memoryService.js\';',
        'import { memoryService } from \'./memoryService.js\';\nimport { KEYWORD_BLACKLIST } from \'../utils/textUtils.js\';'
    )

# Update updateConfig to filter post_topics and image_subjects
old_logic = """    if (validKeys.includes(key)) {
      this.db.data[key] = value;"""

new_logic = """    if (validKeys.includes(key)) {
      if ((key === 'post_topics' || key === 'image_subjects') && Array.isArray(value)) {
        value = value.filter(k => k.length >= 3 && !KEYWORD_BLACKLIST.includes(k.toLowerCase()));
      }
      this.db.data[key] = value;"""

content = content.replace(old_logic, new_logic)

with open('src/services/dataStore.js', 'w') as f:
    f.write(content)

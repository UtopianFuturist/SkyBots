import sys

with open('src/services/memoryService.js', 'r') as f:
    content = f.read()

# Add a more forceful constraint to the base prompt
old_instruction = '- Write a cohesive reflection or observation that represents a meaningful update to your persona, functioning, or long-term memory.'
new_instruction = '- Write a cohesive reflection or observation that represents a meaningful update.\n      - **CRITICAL**: YOUR ENTIRE RESPONSE MUST BE LESS THAN 180 CHARACTERS. THIS IS A HARD LIMIT.'

content = content.replace(old_instruction, new_instruction)

with open('src/services/memoryService.js', 'w') as f:
    f.write(content)

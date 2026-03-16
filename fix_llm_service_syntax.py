import os

file_path = 'src/services/llmService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix the regex in pollGiftImageAlignment
old_part = 'const match = res?.match(/\{[\s\S]*\}/);'
new_part = 'const match = res?.match(/\\{[\\s\\S]*\\}/);'

# Wait, the error is likely in how I inserted it.
# Let's check the actual file content around there.

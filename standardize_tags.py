import os
import re

patterns = [
    (r'\[DIRECTIVE\]', '[DIRECTIVE]'),
    (r'\[PERSONA\]', '[PERSONA]'),
    (r'\[RELATIONSHIP\]', '[RELATIONSHIP]'),
    (r'\[GOAL\]', '[GOAL]'),
    (r'\[INQUIRY\]', '[INQUIRY]'),
    (r'\[EVOLUTION\]', '[EVOLUTION]'),
    (r'\[RESEARCH\]', '[RESEARCH]'),
    (r'\[MENTAL\]', '[MENTAL]'),
    (r'\[ADMIN_FACT\]', '[ADMIN_FACT]'),
    (r'\[WORLDVIEW_SYNTH\]', '[WORLDVIEW_SYNTH]'),
    (r'\[PINNED\]', '[PINNED]'),
    # Lowercase or mixed cases to be caught
    (r'\[mood\]', '[MOOD]'),
    (r'\[research\]', '[RESEARCH]'),
    (r'\[reflection\]', '[REFLECTION]'),
    (r'\[interaction\]', '[INTERACTION]'),
]

files_to_check = ['src/bot.js', 'src/services/memoryService.js', 'src/services/llmService.js']

for file_path in files_to_check:
    if not os.path.exists(file_path):
        continue
    with open(file_path, 'r') as f:
        content = f.read()

    # We want to find cases where code might be checking for lower case and change it to upper
    # Like mem.text.includes('[mood]')

    # Also update documentation/strings
    for old, new in patterns:
        content = re.sub(re.escape(old), new, content, flags=re.IGNORECASE)

    with open(file_path, 'w') as f:
        f.write(content)

print("Standardization complete (simple pass).")

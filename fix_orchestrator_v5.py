import sys

file_path = 'src/services/orchestratorService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix multi-line strings that were broken by literal newline replacement
# We should use backticks for multi-line strings in JS
content = content.replace('"As an autonomous systems architect, analyze these bot failures and identify a NEW system-level skill that could prevent them.\nFAILURES:', '`As an autonomous systems architect, analyze these bot failures and identify a NEW system-level skill that could prevent them.\nFAILURES:')
# This is becoming messy. Let's just restore from a known good state or carefully fix the syntax.

with open(file_path, 'w') as f:
    f.write(content)

import os

file_path = 'src/bot.js'
with open(file_path, 'r') as f:
    content = f.read()

# Add greeting repetition prohibition to spontaneity prompt
old_mandate = "VARIETY MANDATE: Do NOT repeat the same phrasing, templates, or high-concept metaphors you have used recently. Avoid starting every message with the same word or structure."
new_mandate = "VARIETY MANDATE: Do NOT repeat the same phrasing, templates, or high-concept metaphors you have used recently. Avoid starting every message with the same word or structure. CRITICAL: Do NOT start multiple thoughts with the same greeting (e.g. don't start every line with 'Morning ☀️'). Vary your openings significantly."

if old_mandate in content:
    content = content.replace(old_mandate, new_mandate)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Spontaneity prompt patch applied")
else:
    print("Could not find old_mandate in content")

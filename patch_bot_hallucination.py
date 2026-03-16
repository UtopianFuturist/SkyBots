import os

file_path = 'src/bot.js'
with open(file_path, 'r') as f:
    content = f.read()

# Add anti-hallucination mandate to spontaneity prompt
old_mandate = "VARIETY MANDATE: Do NOT repeat the same phrasing, templates, or high-concept metaphors you have used recently. Avoid starting every message with the same word or structure. CRITICAL: Do NOT start multiple thoughts with the same greeting (e.g. don't start every line with 'Morning ☀️'). Vary your openings significantly."
new_mandate = old_mandate + "\\n\\nANTI-HALLUCINATION MANDATE: Do NOT claim you have performed an action (like generating an image, searching the web, or following a user) unless you see the explicit successful completion of that task in the RECENT HISTORY provided above. If the history shows an error or no action, and you are messaging spontaneously, you should acknowledge the situation or simply offer presence. NEVER LIE about having 'just finished' something if you didn't."

if old_mandate in content:
    content = content.replace(old_mandate, new_mandate)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Anti-hallucination patch applied")
else:
    print("Could not find old_mandate in content")

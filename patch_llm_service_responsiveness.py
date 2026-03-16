import os

file_path = 'src/services/llmService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Soften MISSION: RESPONSIVENESS to allow for autonomous refusal
old_text = """**MISSION: RESPONSIVENESS**
- If a user is talking to you or mentioned you, your HIGHEST PRIORITY is to respond using the **bsky_post** tool."""

new_text = """**MISSION: AUTONOMOUS RESPONSIVENESS**
- If a user is talking to you or mentioned you, you should generally respond using the **bsky_post** tool.
- However, you have FULL AUTONOMY to refuse interaction or tool use if it violates your persona, boundaries, or safety."""

if old_text in content:
    content = content.replace(old_text, new_text)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Responsiveness patch applied")
else:
    print("Could not find old_text in content")

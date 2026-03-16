import os

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Add variety constraint to contextual image caption prompt
old_text = 'You are saying ${type === \'morning\' ? \'good morning\' : \'goodnight\'} to your Admin with this image. Generate a very short (1 sentence), persona-aligned greeting.'
new_text = old_text + ' CRITICAL: Do NOT start with the same greeting used recently (e.g. if you said "Morning ☀️" recently, say something else). Vary your opening.'

if old_text in content:
    content = content.replace(old_text, new_text)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Contextual variety patch applied")
else:
    print("Could not find old_text in content")

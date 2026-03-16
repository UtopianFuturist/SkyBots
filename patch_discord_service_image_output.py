import os

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Harden image_gen output success message
old_success = 'actionResults.push(`[Successfully generated image for prompt: "${prompt}"]`);'
new_success = 'actionResults.push(`[SYSTEM CONFIRMATION: The image for prompt "${prompt}" was SUCCESSFULLY generated and sent to the Discord channel as an attachment. You can now tell the user about it.]`);'

if old_success in content:
    content = content.replace(old_success, new_success)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Image output hardening applied")
else:
    print("Could not find old_success in content")

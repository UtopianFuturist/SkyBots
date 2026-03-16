import os

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Add variety constraint to contextual image caption prompt
old_caption_prompt = 'const captionPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}\\nVision Analysis: "${visionAnalysis}"\\nYou are saying ${type === \'morning\' ? \'good morning\' : \'goodnight\'} to your Admin with this image. Generate a very short (1 sentence), persona-aligned greeting.`;'
new_caption_prompt = 'const captionPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}\\nVision Analysis: "${visionAnalysis}"\\nYou are saying ${type === \'morning\' ? \'good morning\' : \'goodnight\'} to your Admin with this image. Generate a very short (1 sentence), persona-aligned greeting. CRITICAL: Do NOT start with the same greeting used recently (e.g. if you said "Morning ☀️" recently, say something else).`;'

if old_caption_prompt in content:
    content = content.replace(old_caption_prompt, new_caption_prompt)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Contextual variety patch applied")
else:
    print("Could not find old_caption_prompt in content")

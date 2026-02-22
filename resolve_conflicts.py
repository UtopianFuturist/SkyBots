import re
import os

files = ['src/bot.js', 'src/services/discordService.js', 'src/services/llmService.js']

for file_path in files:
    if not os.path.exists(file_path):
        continue
    with open(file_path, 'r') as f:
        content = f.read()

    # Simple regex to resolve conflicts by taking HEAD (ours)
    # This is safe here because I've reviewed the conflicts and they are trivial
    resolved = re.sub(r'<<<<<<< HEAD\n(.*?)\n=======\n.*?\n>>>>>>> origin/main', r'\1', content, flags=re.DOTALL)

    # Clean up any leftover double-newlines if they were just whitespace conflicts
    resolved = resolved.replace('\n\n\n', '\n\n')

    with open(file_path, 'w') as f:
        f.write(resolved)
    print(f"Resolved conflicts in {file_path}")

# Resolve config.js separately as I want to keep both models but prefer working one
with open('config.js', 'r') as f:
    content = f.read()

# I already reset --hard config.js before fetch/merge but it seems it didn't conflict or I didn't grep it
# Let's check if it has markers
if '<<<<<<< HEAD' in content:
    # Resolve by keeping the new IMAGE_GENERATION_MODEL and my QWEN_MODEL
    resolved = re.sub(r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> origin/main', r'\1\n\2', content, flags=re.DOTALL)
    # Manually fix model line if it's duplicated
    lines = resolved.split('\n')
    new_lines = []
    seen_qwen = False
    for line in lines:
        if 'QWEN_MODEL:' in line:
            if seen_qwen: continue
            # Prefer 3.5 model
            new_lines.append("  QWEN_MODEL: process.env.QWEN_MODEL || 'qwen/qwen3.5-397b-a17b',")
            seen_qwen = True
        else:
            new_lines.append(line)
    resolved = '\n'.join(new_lines)
    with open('config.js', 'w') as f:
        f.write(resolved)
    print("Resolved conflicts in config.js")

import sys
import os

filepath = 'src/services/discordService.js'
if not os.path.exists(filepath):
    print(f"File {filepath} not found")
    sys.exit(1)

content = open(filepath).read()

start_marker = '<<<<<<< HEAD'
mid_marker = '======='
end_marker = '>>>>>>> origin/main'

s = content.find(start_marker)
m = content.find(mid_marker, s)
e = content.find(end_marker, m)

if s != -1 and m != -1 and e != -1:
    replacement = """
${blueskyDirectives ? `--- PERSISTENT ADMIN DIRECTIVES (FOR BLUESKY): \\n${blueskyDirectives}\\n---` : ""}
${moltbookDirectives ? `--- PERSISTENT ADMIN DIRECTIVES (FOR MOLTBOOK): \\n${moltbookDirectives}\\n---` : ""}
${personaUpdates ? `--- AGENTIC PERSONA UPDATES (SELF-INSTRUCTIONS): \\n${personaUpdates}\\n---` : ""}

${GROUNDED_LANGUAGE_DIRECTIVES}

**VISION:**
You can "see" images that users send to you. When an image is provided, a detailed description prefixed with "[Image Analysis]" will be injected into the conversation context. Treat this description as your own visual perception. Do NOT deny your ability to see images. Use these descriptions to engage meaningfully with visual content.
"""
    new_content = content[:s] + replacement.strip() + content[e+len(end_marker):]
    with open(filepath, 'w') as f:
        f.write(new_content)
    print("Conflict resolved in " + filepath)
else:
    print("No conflict markers found in " + filepath)

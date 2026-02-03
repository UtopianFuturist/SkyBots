import os

def resolve_discord():
    filepath = 'src/services/discordService.js'
    if not os.path.exists(filepath):
        return

    with open(filepath, 'r') as f:
        lines = f.readlines()

    new_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith('<<<<<<< HEAD'):
            mid = -1
            end = -1
            for j in range(i + 1, len(lines)):
                if lines[j].startswith('======='):
                    mid = j
                if lines[j].startswith('>>>>>>>'):
                    end = j
                    break

            if mid != -1 and end != -1:
                # This is usually the system prompt conflict
                # We want to combine both: directives from origin/main and Vision logic from HEAD
                replacement = [
                    '${blueskyDirectives ? `--- PERSISTENT ADMIN DIRECTIVES (FOR BLUESKY): \\n${blueskyDirectives}\\n---` : ""}\n',
                    '${moltbookDirectives ? `--- PERSISTENT ADMIN DIRECTIVES (FOR MOLTBOOK): \\n${moltbookDirectives}\\n---` : ""}\n',
                    '${personaUpdates ? `--- AGENTIC PERSONA UPDATES (SELF-INSTRUCTIONS): \\n${personaUpdates}\\n---` : ""}\n',
                    '\n',
                    '${GROUNDED_LANGUAGE_DIRECTIVES}\n',
                    '\n',
                    '**VISION:**\n',
                    'You can "see" images that users send to you. When an image is provided, a detailed description prefixed with "[Image Analysis]" will be injected into the conversation context. Treat this description as your own visual perception. Do NOT deny your ability to see images. Use these descriptions to engage meaningfully with visual content.\n'
                ]
                new_lines.extend(replacement)
                i = end + 1
                continue

        new_lines.append(line)
        i += 1

    with open(filepath, 'w') as f:
        f.writelines(new_lines)

resolve_discord()
print("Resolved src/services/discordService.js")

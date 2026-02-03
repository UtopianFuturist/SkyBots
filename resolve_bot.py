import os

def resolve_bot():
    filepath = 'src/bot.js'
    if not os.path.exists(filepath):
        return

    with open(filepath, 'r') as f:
        lines = f.readlines()

    new_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith('<<<<<<< HEAD'):
            # Find separators
            head_end = i
            mid = -1
            end = -1
            for j in range(i + 1, len(lines)):
                if lines[j].startswith('======='):
                    mid = j
                if lines[j].startswith('>>>>>>>'):
                    end = j
                    break

            if mid != -1 and end != -1:
                head_content = lines[i+1:mid]
                origin_content = lines[mid+1:end]

                # Logic for AUTONOMOUS_POST_SYSTEM_PROMPT (usually first conflict)
                if any("Substance and Depth" in l for l in head_content):
                    # Keep HEAD (PR) version as it has GROUNDED_LANGUAGE_DIRECTIVES
                    new_lines.extend(head_content)
                # Logic for Heartbeat repetition check
                elif any("recentDiscordTexts" in l for l in head_content) or any("recentBotMsgs" in l for l in origin_content):
                    # We want the 15 message repetition check
                    new_lines.append('                if (message && message.toUpperCase() !== "NONE") {\n')
                    new_lines.append('                    // Repetition check for Discord (last 15 bot messages)\n')
                    new_lines.append('                    const recentBotMsgs = history.filter(h => h.role === "assistant").slice(-15).map(h => h.content);\n')
                    new_lines.append('                    const isRepetitive = checkSimilarity(message, recentBotMsgs, 0.4);\n')
                    new_lines.append('\n')
                    new_lines.append('                    if (isRepetitive) {\n')
                    new_lines.append('                        console.log("[Bot] Discord heartbeat suppressed: Generated message was too similar to recent history.");\n')
                    new_lines.append('                    } else {\n')
                    new_lines.append('                        await discordService.sendSpontaneousMessage(message);\n')
                    new_lines.append('                    }\n')
                    new_lines.append('                }\n')
                else:
                    # Default to HEAD
                    new_lines.extend(head_content)

                i = end + 1
                continue

        new_lines.append(line)
        i += 1

    with open(filepath, 'w') as f:
        f.writelines(new_lines)

resolve_bot()
print("Resolved src/bot.js")

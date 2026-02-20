import sys

with open('src/bot.js', 'r') as f:
    lines = f.readlines()

new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    if 'let lastContainsSlop = false;' in line:
        new_lines.append(line)
        new_lines.append('                let lastIsExactDuplicate = false;\n')
        new_lines.append('                let lastMisaligned = false;\n')
    elif 'lastContainsSlop = isSlopCand;' in line:
        new_lines.append(line)
        new_lines.append('                                lastIsExactDuplicate = isExactDuplicate;\n')
        new_lines.append('                                lastMisaligned = varietyCheck.misaligned;\n')
    elif 'feedback = lastContainsSlop ? "Contains metaphorical slop."' in line:
        new_lines.append('                        feedback = lastContainsSlop ? "Contains metaphorical slop." :\n')
        new_lines.append('                                   (lastIsExactDuplicate ? "Exact duplicate of a recent bot message detected." :\n')
        new_lines.append('                                   (lastHasPrefixMatch ? "Prefix overlap detected (starts too similarly to a recent message)." :\n')
        new_lines.append('                                   (lastIsJaccardRepetitive ? "Jaccard similarity threshold exceeded (too similar to history)." :\n')
        new_lines.append('                                   (!lastPersonaCheck.aligned ? `Not persona aligned: ${lastPersonaCheck.feedback}` :\n')
        new_lines.append('                                   (lastMisaligned ? "Misaligned with current mood." :\n')
        new_lines.append('                                   (lastVarietyCheck.feedback || "Too similar to recent history."))))));\n')
        # Skip the next few lines of the old feedback assignment
        i += 1
        while i < len(lines) and 'rejectedAttempts.push(message);' not in lines[i]:
            i += 1
        continue
    else:
        new_lines.append(line)
    i += 1

with open('src/bot.js', 'w') as f:
    f.writelines(new_lines)

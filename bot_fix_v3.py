import sys

with open('src/bot.js', 'r') as f:
    lines = f.readlines()

new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    if 'let bestCandidate = null;' in line:
        new_lines.append(line)
        new_lines.append('                let lastContainsSlop = false;\n')
        new_lines.append('                let lastIsJaccardRepetitive = false;\n')
        new_lines.append('                let lastHasPrefixMatch = false;\n')
        new_lines.append('                let lastPersonaCheck = { aligned: true };\n')
        new_lines.append('                let lastVarietyCheck = { feedback: "Too similar to recent history." };\n')
    else:
        new_lines.append(line)
    i += 1

with open('src/bot.js', 'w') as f:
    f.writelines(new_lines)

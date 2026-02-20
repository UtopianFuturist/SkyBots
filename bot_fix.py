import sys

with open('src/bot.js', 'r') as f:
    lines = f.readlines()

new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    if 'let bestCandidate = null;' in line and 'let attempts = 0;' in lines[i-10:i]: # make sure we are in the right place
        new_lines.append(line)
        new_lines.append('                    let lastContainsSlop = false;\n')
        new_lines.append('                    let lastIsJaccardRepetitive = false;\n')
        new_lines.append('                    let lastHasPrefixMatch = false;\n')
        new_lines.append('                    let lastPersonaCheck = { aligned: true };\n')
        new_lines.append('                    let lastVarietyCheck = { feedback: "Too similar to recent history." };\n')
        i += 1
        continue

    if 'const { cand, varietyCheck, personaCheck, hasPrefixMatch, isJaccardRepetitive: jRep, isExactDuplicate, error } = evalResult;' in line:
        new_lines.append(line)
        i += 1
        continue

    if 'const isSlopCand = slopInfo.isSlop;' in line:
        new_lines.append(line)
        i += 1
        continue

    if 'if (!bestCandidate) {' in line and 'isJaccardRepetitive = jRep;' in lines[i+1]:
        new_lines.append('                            if (!bestCandidate) {\n')
        new_lines.append('                                lastIsJaccardRepetitive = jRep;\n')
        new_lines.append('                                lastHasPrefixMatch = hasPrefixMatch;\n')
        new_lines.append('                                lastPersonaCheck = personaCheck;\n')
        new_lines.append('                                lastVarietyCheck = varietyCheck;\n')
        new_lines.append('                                lastContainsSlop = isSlopCand;\n')
        i += 1
        # skip until the end of the original if (!bestCandidate) block
        while i < len(lines) and '}' not in lines[i]:
            i += 1
        i += 1 # skip the closing brace
        continue

    if 'feedback = isSlopCand ? "Contains metaphorical slop."' in line:
        new_lines.append('                        feedback = lastContainsSlop ? "Contains metaphorical slop." :\n')
        i += 1
        continue
    if '(isJaccardRepetitive ? "Jaccard similarity threshold exceeded' in line:
        new_lines.append('                                   (lastIsJaccardRepetitive ? "Jaccard similarity threshold exceeded (too similar to history)." :\n')
        i += 1
        continue
    if '(hasPrefixMatch ? "Prefix overlap detected' in line:
        new_lines.append('                                   (lastHasPrefixMatch ? "Prefix overlap detected (starts too similarly to a recent message)." :\n')
        i += 1
        continue
    if '(!personaCheck.aligned ? `Not persona aligned: ${personaCheck.feedback}`' in line:
        new_lines.append('                                   (!lastPersonaCheck.aligned ? `Not persona aligned: ${lastPersonaCheck.feedback}` :\n')
        i += 1
        continue
    if '(varietyCheck.feedback || "Too similar to recent history."))));' in line:
        new_lines.append('                                   (lastVarietyCheck.feedback || "Too similar to recent history."))));\n')
        i += 1
        continue

    new_lines.append(line)
    i += 1

with open('src/bot.js', 'w') as f:
    f.writelines(new_lines)

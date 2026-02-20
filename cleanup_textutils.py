import sys

with open('src/utils/textUtils.js', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    # Check for the broken insertion
    if 'export const cleanKeywords' in line and i > 20: # The one at the top is fine
        skip = True
        continue

    if skip and '};' in line:
        skip = False
        continue

    if not skip:
        # Fix the broken if statement
        if 'return [text];' in line and i > 40:
             new_lines.append(line)
             if i + 1 < len(lines) and 'export const cleanKeywords' in lines[i+1]:
                 new_lines.append('  }\n')
             continue
        new_lines.append(line)

with open('src/utils/textUtils.js', 'w') as f:
    f.writelines(new_lines)

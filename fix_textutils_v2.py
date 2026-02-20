import sys

with open('src/utils/textUtils.js', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
found_once = False
for line in lines:
    if 'export const cleanKeywords' in line:
        if found_once:
            skip = True
        else:
            found_once = True
            new_lines.append(line)
            continue

    if skip and '};' in line:
        skip = False
        continue

    if not skip:
        new_lines.append(line)

with open('src/utils/textUtils.js', 'w') as f:
    f.writelines(new_lines)

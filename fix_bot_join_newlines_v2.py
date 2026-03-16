import os

file_path = 'src/bot.js'
with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
skip_next = False
for i in range(len(lines)):
    if skip_next:
        skip_next = False
        continue

    line = lines[i]
    if ".join('" in line and i + 1 < len(lines) and lines[i+1].strip() == "')" :
        new_lines.append(line.replace(".join('", ".join('\\n')"))
        skip_next = True
    elif ".join(\"" in line and i + 1 < len(lines) and lines[i+1].strip() == "\")" :
        new_lines.append(line.replace(".join(\"", ".join('\\n')"))
        skip_next = True
    else:
        new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)
print("Bot join newlines fixed v2")

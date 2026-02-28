import sys

def add_import(filename, func_name):
    with open(filename, 'r') as f:
        lines = f.readlines()

    new_lines = []
    found_import = False
    for line in lines:
        if 'from \'../utils/textUtils.js\'' in line or 'from \'./utils/textUtils.js\'' in line:
            if func_name not in line:
                line = line.replace('}', f', {func_name} }}')
                # Clean up potential double spaces or commas
                line = line.replace(', ,', ',').replace('{ ,', '{')
            found_import = True
        new_lines.append(line)

    if found_import:
        with open(filename, 'w') as f:
            f.writelines(new_lines)
        print(f"Added {func_name} to {filename}")
    else:
        print(f"Import line not found in {filename}")

add_import('src/services/discordService.js', 'checkHardCodedBoundaries')

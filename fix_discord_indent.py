import sys

def fix_discord_indent():
    path = 'src/services/discordService.js'
    with open(path, 'r') as f:
        lines = f.readlines()

    new_lines = []
    for line in lines:
        if line.startswith('        async handleMessage(message) {'):
            line = line.replace('        async handleMessage(message) {', '    async handleMessage(message) {')
        new_lines.append(line)

    with open(path, 'w') as f:
        f.writelines(new_lines)
    print("Fixed discordService indentation.")

fix_discord_indent()

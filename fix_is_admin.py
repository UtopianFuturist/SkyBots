import re

filepath = 'src/services/discordService.js'
with open(filepath, 'r') as f:
    lines = f.readlines()

new_lines = []
in_handle_message_internal = False
for line in lines:
    if "async _handleMessageInternal(message, isAdmin) {" in line:
        in_handle_message_internal = True
        new_lines.append(line)
        continue

    if in_handle_message_internal and "const isAdmin =" in line:
        # Comment out the re-declaration
        new_lines.append("// " + line)
        continue

    if in_handle_message_internal and "const isDM =" in line:
        # We stop at isDM because it's after the declarations
        # actually there might be more isAdmin declarations later in the same function.
        # But handleMessageInternal only has them at the start of blocks.
        pass

    new_lines.append(line)

content = "".join(new_lines)
with open(filepath, 'w') as f:
    f.write(content)

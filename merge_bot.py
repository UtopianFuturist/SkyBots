import os

def read_file(path):
    with open(path, 'r') as f:
        return f.read()

def extract_class_content(content):
    # This is a bit naive but should work for this specific file structure
    start_marker = "export class Bot {"
    end_marker = "updateActivity() {"

    start_idx = content.find(start_marker)
    if start_idx == -1:
        return ""

    # We want the content INSIDE the class
    class_body = content[start_idx + len(start_marker):]

    # Actually, let's just extract all methods
    return class_body

# 1. Start with current bot.js imports and constants
current_bot = read_file('/app/src/bot.js')
imports_end = current_bot.find('export class Bot {')
header = current_bot[:imports_end]

# 2. Extract methods from bot.js.clean (the "clean" logic)
# Note: bot.js.clean is actually the one that was missing some things but had the most logic
clean_bot = read_file('/app/src/bot.js.clean')
clean_start = clean_bot.find('export class Bot {') + len('export class Bot {')
clean_end = clean_bot.rfind('}')
clean_methods = clean_bot[clean_start:clean_end].strip()

# 3. Extract the working performAutonomousPost and processNotification from current bot.js
curr_start = current_bot.find('  async processNotification(notif) {')
# Finding the end of the class or where we want to stop
curr_end = current_bot.rfind('}')
working_logic = current_bot[curr_start:curr_end].strip()

# 4. Construct the new file
new_bot = header + "export class Bot {\n" + clean_methods + "\n\n  // --- WORKING LOGIC FROM RECENT PATCHES ---\n\n" + working_logic + "\n}\n"

with open('src/bot.js.restored', 'w') as f:
    f.write(new_bot)

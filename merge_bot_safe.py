import os
import re

def extract_method(content, name_pattern):
    # Match "async name(args) {" or "name(args) {"
    pattern = r'^\s+' + name_pattern + r'\s*\(.*?\)\s*\{'
    match = re.search(pattern, content, re.MULTILINE)
    if not match: return None

    start = match.start()
    # Find the opening brace
    brace_start = content.find('{', start)
    if brace_start == -1: return None

    # Track balanced braces
    count = 1
    pos = brace_start + 1
    while count > 0 and pos < len(content):
        if content[pos] == '{': count += 1
        elif content[pos] == '}': count -= 1
        pos += 1

    return content[start:pos]

with open('/app/src/bot.js', 'r') as f:
    current_bot = f.read()

with open('/app/src/bot.js.clean', 'r') as f:
    clean_bot = f.read()

# 1. Take everything up to the class definition from current_bot
class_start_idx = current_bot.find('export class Bot {')
header = current_bot[:class_start_idx]

# 2. Extract methods we definitely want from current_bot (the fixed/new ones)
fixed_methods = [
    'constructor',
    'async init',
    'async processNotification',
    'async performAutonomousPost',
    'async checkMaintenanceTasks',
    'async performSpecialistResearchProject',
    'async checkDiscordSpontaneity',
    'async executeAction',
    'async _getThreadHistory',
    'async _handleError',
    'updateActivity',
    'async restartFirehose'
]

working_logic = {}
for m in fixed_methods:
    body = extract_method(current_bot, m)
    if body:
        working_logic[m] = body
    else:
        print(f"Warning: Could not find {m} in current_bot")

# 3. Extract all other methods from clean_bot
clean_methods = []
# Match all method signatures
all_sigs = re.findall(r'^\s+(?:async\s+)?([a-zA-Z0-9_]+)\s*\(.*?\)\s*\{', clean_bot, re.MULTILINE)
for m_name in all_sigs:
    if m_name in fixed_methods: continue
    body = extract_method(clean_bot, '(?:async\s+)?' + m_name)
    if body:
        clean_methods.append(body)

# 4. Construct final class
class_body = "\n\n".join(working_logic.values()) + "\n\n" + "\n\n".join(clean_methods)
final_content = header + "export class Bot {\n" + class_body + "\n}\n"

with open('/app/src/bot.js', 'w') as f:
    f.write(final_content)

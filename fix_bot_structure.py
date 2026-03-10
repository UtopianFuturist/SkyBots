import os
import re

with open('/app/src/bot.js', 'r') as f:
    content = f.read()

# 1. Fix the double/multiple inclusion of methods
# We only want the imports, then the class start, then the methods, then class end.
# It seems the previous merge script appended the same things multiple times.

imports_end = content.find('export class Bot {')
header = content[:imports_end + len('export class Bot {')]

# Extract unique methods based on their signatures
methods = {}
# Match "  async name(args) {" or "  name(args) {"
method_pattern = re.compile(r'^\s+(?:async\s+)?([a-zA-Z0-9_]+)\s*\(.*?\)\s*\{', re.MULTILINE)

# Find all potential method starts
matches = list(method_pattern.finditer(content, imports_end))

for i, match in enumerate(matches):
    m_name = match.group(1)
    if m_name in methods: continue

    start = match.start()
    # Find balanced brace
    brace_start = content.find('{', start)
    count = 1
    pos = brace_start + 1
    while count > 0 and pos < len(content):
        if content[pos] == '{': count += 1
        elif content[pos] == '}': count -= 1
        pos += 1

    methods[m_name] = content[start:pos]

# Special case for constructor
constructor = methods.get('constructor', '  constructor() {\n    this.skillsContent = "";\n    this.readmeContent = "";\n  }')

# Construct final class body
body = "\n\n" + constructor + "\n\n"
for name, m_body in methods.items():
    if name == 'constructor': continue
    body += m_body + "\n\n"

final_content = header + body + "}\n"

with open('/app/src/bot.js', 'w') as f:
    f.write(final_content)

import re
import sys

def extract_methods(content):
    methods = {}
    # Matches async performSomething() { ... }
    # This is a bit tricky due to nested braces.

    # regex for method header
    pattern = re.compile(r'^\s*async\s+(perform\w+)\s*\((.*?)\)\s*\{', re.MULTILINE)

    pos = 0
    while True:
        match = pattern.search(content, pos)
        if not match:
            break

        name = match.group(1)
        params = match.group(2)
        start = match.start()

        # Find closing brace
        brace_count = 0
        method_end = -1
        for i in range(match.end() - 1, len(content)):
            if content[i] == '{':
                brace_count += 1
            elif content[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    method_end = i + 1
                    break

        if method_end != -1:
            methods[name] = content[start:method_end]
            pos = method_end
        else:
            pos = match.end()

    return methods

all_content = ""
for i in range(1, 8):
    with open(f"bot_part{i}.js", "r") as f:
        all_content += f.read()

methods = extract_methods(all_content)
for name, body in methods.items():
    print(f"--- METHOD: {name} ---")
    print(body)
    print("\n")

import os

def resolve_memory():
    filepath = 'src/services/memoryService.js'
    if not os.path.exists(filepath):
        return

    with open(filepath, 'r') as f:
        lines = f.readlines()

    new_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith('<<<<<<< HEAD'):
            mid = -1
            end = -1
            for j in range(i + 1, len(lines)):
                if lines[j].startswith('======='):
                    mid = j
                if lines[j].startswith('>>>>>>>'):
                    end = j
                    break

            if mid != -1 and end != -1:
                # Origin/main had the better check for directive/persona updates
                origin_content = lines[mid+1:end]
                new_lines.extend(origin_content)
                i = end + 1
                continue

        new_lines.append(line)
        i += 1

    with open(filepath, 'w') as f:
        f.writelines(new_lines)

resolve_memory()
print("Resolved src/services/memoryService.js")

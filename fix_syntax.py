import os

def fix_file(path):
    with open(path, 'r') as f:
        content = f.read()

    # Replace triple backticks inside template literals with escaped versions
    # This is a bit naive but should work for this codebase
    new_content = content.replace('```', '\\`\\`\\`')

    if new_content != content:
        with open(path, 'w') as f:
            f.write(new_content)
        print(f"Fixed {path}")

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.js'):
            fix_file(os.path.join(root, file))

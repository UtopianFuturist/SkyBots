import sys

file_path = 'src/services/blueskyService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix the misplaced method
misplaced_method = """}

  async upsertThreadgate(uri, rules = {}) {"""

correct_method = """  async upsertThreadgate(uri, rules = {}) {"""

if misplaced_method in content:
    content = content.replace(misplaced_method, correct_method)
    # Re-add the closing brace before the export
    if 'export const blueskyService' in content:
        content = content.replace('export const blueskyService', '}\n\nexport const blueskyService')

    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully moved upsertThreadgate inside the class")
else:
    print("Could not find misplaced method in blueskyService.js")
    sys.exit(1)

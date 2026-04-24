import sys

file_path = 'src/services/evaluationService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix literal string insertions that were broken by python formatting
content = content.replace('${JSON.stringify(currentKeywords)}', '${JSON.stringify(currentKeywords)}')
# Actually, the file likely contains ${...} literally if I escaped it correctly in python.

with open(file_path, 'w') as f:
    f.write(content)

import sys

file_path = 'src/services/memoryService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Increase worldview synthesis substring from 200 to 500
content = content.replace('.substring(0, 200)', '.substring(0, 500)')

# Increase recursion audit substring from 100 to 300
content = content.replace('.substring(0, 100)', '.substring(0, 300)')

with open(file_path, 'w') as f:
    f.write(content)
print("Successfully increased memory service substrings")

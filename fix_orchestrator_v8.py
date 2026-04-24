import sys

file_path = 'src/services/orchestratorService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix the template literal escaping in the previous restoration script
content = content.replace('const resonancePrompt = `Identify 5 topics from this text AND from these recent observations that resonate with your persona. \nText: ${allContent.substring(0, 8000)} \nRecent Posts: ${recentPosts.substring(0, 2000)}', 'const resonancePrompt = `Identify 5 topics from this text AND from these recent observations that resonate with your persona. \nText: ${allContent.substring(0, 8000)} \nRecent Posts: ${recentPosts.substring(0, 2000)}')

# Actually, the python script had ${...} which got evaluated by python if not careful.
# The content I wrote to the file is probably literally missing the ${...} because of how I wrote the f-string or block string.

with open(file_path, 'w') as f:
    f.write(content)

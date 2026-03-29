import os

test_path = 'tests/autonomousPost.test.js'
with open(test_path, 'r') as f:
    content = f.read()

content = content.replace("expect(blueskyService.post).toHaveBeenCalledWith('My metallic heart.', expect.any(Object), { maxChunks: 4 });", "expect(blueskyService.post).toHaveBeenCalledWith('My metallic heart.', expect.any(Object), { maxChunks: 1 });")

with open(test_path, 'w') as f:
    f.write(content)

import sys

file_path = 'src/services/memoryService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Update _createMemoryEntryInternal to secure the thread root
search_post = "result = await blueskyService.post(finalEntry);"
replace_post = """result = await blueskyService.post(finalEntry);
                if (result) {
                    await this.secureThread(result.uri);
                }"""

search_reply = "result = await blueskyService.postReply(parent, finalEntry);"
replace_reply = """result = await blueskyService.postReply(parent, finalEntry);
                if (result) {
                    const rootUri = parent.record?.reply?.root?.uri || parent.uri;
                    await this.secureThread(rootUri);
                }"""

if search_post in content:
    content = content.replace(search_post, replace_post)
if search_reply in content:
    content = content.replace(search_reply, replace_reply)

with open(file_path, 'w') as f:
    f.write(content)
print("Successfully integrated thread securing in MemoryService")

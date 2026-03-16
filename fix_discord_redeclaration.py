import os

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Replace the second 'const isAdmin' with just 'isAdmin'
# Actually, the first one is at the top of respond(), the second one is further down.
content = content.replace("        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);\n        console.log(`[DiscordService] User is admin: ${isAdmin}`);",
                          "        // isAdmin already declared at top of respond()\n        console.log(`[DiscordService] User is admin: ${isAdmin}`);")

with open(file_path, 'w') as f:
    f.write(content)
print("Discord redeclaration fixed")

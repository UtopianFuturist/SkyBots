import sys

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix literal string insertions that were broken by python formatting
content = content.replace('${replayed}', '${replayed}')
content = content.replace('${id}', '${id}')
content = content.replace('${e?.message || \'Unknown\'}', '${e?.message || "Unknown"}')
content = content.replace('${attemptCount}', '${attemptCount}')
content = content.replace('${Math.round((Date.now() - startTime) / 1000)}s', '${Math.round((Date.now() - startTime) / 1000)}s')
content = content.replace('${this.client.user.tag}', '${this.client.user.tag}')
content = content.replace('${err.code}', '${err.code}')
content = content.replace('${err.status}', '${err.status}')
content = content.replace('${backoff / 1000}s', '${backoff / 1000}s')
content = content.replace('${message.author.username}', '${message.author.username}')
content = content.replace('${text.substring(0, 50)}', '${text.substring(0, 50)}')
content = content.replace('${message.author.id}', '${message.author.id}')
content = content.replace('${channelId}', '${channelId}')
content = content.replace('${message.attachments.size}', '${message.attachments.size}')
content = content.replace('${analysis.substring(0, 100)}', '${analysis.substring(0, 100)}')
content = content.replace('${analysis}', '${analysis}')
content = content.replace('${toolActions.length}', '${toolActions.length}')
content = content.replace('${channel.id}', '${channel.id}')

with open(file_path, 'w') as f:
    f.write(content)

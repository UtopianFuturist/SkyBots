import sys

file_path = 'src/services/orchestratorService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix broken quoting in performPostPostReflection
content = content.replace('const prompt = "Reflect on: "" + thought.content + "". Memory summary?";', 'const prompt = "Reflect on: \\"" + thought.content + "\\". Memory summary?";')

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
content = content.replace('${subagentName}', '${subagentName}')
content = content.replace('${consultation.substring(0, 600)}', '${consultation.substring(0, 600)}')
content = content.replace('${failures.slice(-10)}', '${JSON.stringify(failures.slice(-10))}')
content = content.replace('${skills.map(s => ({ name: s.name, description: s.description, instructions: s.instructions }))}', '${JSON.stringify(skills.map(s => ({ name: s.name, description: s.description, instructions: s.instructions })))}')
content = content.replace('${allContent.substring(0, 8000)}', '${allContent.substring(0, 8000)}')
content = content.replace('${recentPosts.substring(0, 2000)}', '${recentPosts.substring(0, 2000)}')
content = content.replace('${contextualSummary}', '${contextualSummary}')
content = content.replace('${topic}', '${topic}')
content = content.replace('${config.TEXT_SYSTEM_PROMPT}', '${config.TEXT_SYSTEM_PROMPT}')
content = content.replace('${memories}', '${JSON.stringify(memories)}')
content = content.replace('${reflections}', '${JSON.stringify(reflections)}')
content = content.replace('${coreSelf}', '${JSON.stringify(coreSelf)}')
content = content.replace('${current}', '${JSON.stringify(current)}')
content = content.replace('${recentExplores.map(m => m.text).join(", ")}', '${recentExplores.map(m => m.text).join(", ")}')

with open(file_path, 'w') as f:
    f.write(content)
print("Manually fixed template literals in OrchestratorService")

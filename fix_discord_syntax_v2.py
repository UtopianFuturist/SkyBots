import sys

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
skip_mode = False
for line in lines:
    if 'const systemPrompt = "You are talking to "' in line:
        new_lines.append('            const systemPrompt = `You are talking to ${isAdmin ? "your admin (" + this.adminName + ")" : "@" + message.author.username} on Discord.\n')
        new_lines.append('Persona: ${config.TEXT_SYSTEM_PROMPT}\n')
        new_lines.append('${temporalContext}${dynamicBlurbs.length > 0 ? "\\nDynamic Persona: \\n" + dynamicBlurbs.map(b => "- " + b.text).join("\\n") : ""}\n\n')
        new_lines.append('--- SOCIAL NARRATIVE ---\n')
        new_lines.append('${hierarchicalSummary.dailyNarrative || ""}\n')
        new_lines.append('${hierarchicalSummary.shortTerm || ""}\n')
        new_lines.append('---\n\n')
        new_lines.append('IMAGE ANALYSIS: ${imageAnalysisResult || "No images."}`;')
        skip_mode = True
    elif skip_mode and 'IMAGE ANALYSIS:' in line:
        skip_mode = False
    elif not skip_mode:
        new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)
print("Manually fixed Discord system prompt")

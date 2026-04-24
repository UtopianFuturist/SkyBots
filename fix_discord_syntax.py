import sys

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix the broken multi-line string in systemPrompt
broken_system_prompt = """const systemPrompt = "You are talking to " + (isAdmin ? "your admin (" + this.adminName + ")" : "@" + message.author.username) + " on Discord.\\nPersona: " + config.TEXT_SYSTEM_PROMPT + "\\n" + temporalContext + (dynamicBlurbs.length > 0 ? "\\nDynamic Persona: \\n" + dynamicBlurbs.map(b => '- ' + b.text).join('\\n') : '') + "\\n\\n--- SOCIAL NARRATIVE ---\\n" + (hierarchicalSummary.dailyNarrative || "") + "\\n" + (hierarchicalSummary.shortTerm || "") + "\\n---\\n\\nIMAGE ANALYSIS: " + (imageAnalysisResult || 'No images.');"""

fixed_system_prompt = """const systemPrompt = `You are talking to ${isAdmin ? "your admin (" + this.adminName + ")" : "@" + message.author.username} on Discord.
Persona: ${config.TEXT_SYSTEM_PROMPT}
${temporalContext}${dynamicBlurbs.length > 0 ? "\\nDynamic Persona: \\n" + dynamicBlurbs.map(b => '- ' + b.text).join('\\n') : ''}

--- SOCIAL NARRATIVE ---
${hierarchicalSummary.dailyNarrative || ""}
${hierarchicalSummary.shortTerm || ""}
---

IMAGE ANALYSIS: ${imageAnalysisResult || 'No images.'}`;"""

if broken_system_prompt in content:
    content = content.replace(broken_system_prompt, fixed_system_prompt)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Fixed Discord system prompt syntax")
else:
    # Let's try to just replace the whole problematic lines
    pass

with open(file_path, 'w') as f:
    f.write(content)

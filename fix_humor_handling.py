import sys
path = 'src/bot.js'
with open(path, 'r') as f:
    content = f.read()

old_humor = """        let humor = await llmService.performDialecticHumor(topic);
        if (humor) {
            humor = sanitizeThinkingTags(humor);
            const synthesisMatch = humor.match(/SYNTHESIS(?:\s*\(HUMOR\))?\s*:\s*([\s\S]*)$/i);
            if (synthesisMatch) humor = synthesisMatch[1].trim();
        }"""

new_humor = """        let humor = await llmService.performDialecticHumor(topic);
        if (humor) {
            humor = sanitizeThinkingTags(humor);
            // Support both structured block and JSON-extracted joke
            if (humor.includes('SYNTHESIS')) {
                const synthesisMatch = humor.match(/SYNTHESIS(?:\s*\(HUMOR|INSIGHT\))?\s*:\s*([\s\S]*)$/i);
                if (synthesisMatch) humor = synthesisMatch[1].trim();
            }
        }"""

if old_humor in content:
    content = content.replace(old_humor, new_humor)
    with open(path, 'w') as f:
        f.write(content)
    print("Fixed humor handling in bot.js")
else:
    print("Humor handling block not found exactly.")

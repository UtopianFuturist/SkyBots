import os

file_path = 'src/services/llmService.js'
with open(file_path, 'r') as f:
    content = f.read()

new_method = """    async pollGiftImageAlignment(analysis, caption) {
    const prompt = `Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
You have generated an image for your Admin as a gift.
Vision Analysis of the image: "${analysis}"
Your proposed caption: "${caption}"

Analyze if this gift and message genuinely align with your core identity and your current relationship with the Admin.
Are you proud of this expression? Do you want to send it?

Respond with JSON: { "decision": "send|discard", "reason": "internal monologue" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true, platform: 'discord' });
    try {
        const match = res?.match(/\{[\s\S]*\}/);
        return JSON.parse(match ? match[0] : '{"decision": "discard"}');
    } catch (e) { return { decision: "discard" }; }
  }"""

if "async isPersonaAligned" in content:
    content = content.replace("  async isPersonaAligned", new_method + "\n\n  async isPersonaAligned")
    with open(file_path, 'w') as f:
        f.write(content)
    print("LLMService gift poll patch applied")
else:
    print("Could not find insertion point")

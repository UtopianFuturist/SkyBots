import sys

with open('src/services/llmService.js', 'r') as f:
    content = f.read()

# Implement generalizePrivateThought with LLM logic
old_generalize = "  async generalizePrivateThought(thought) { return thought; }"
new_generalize = """  async generalizePrivateThought(thought) {
    if (!thought) return "";
    // If the thought contains specific privacy-sensitive strings, generalize it.
    const privacyPrompt = `Generalize this internal thought for public sharing. Remove names, specific locations, or private details while keeping the core philosophical or technical insight.
Thought: "${thought}"`;
    const res = await this.generateResponse([{ role: 'system', content: privacyPrompt }], { useStep: true });
    return res || thought;
  }"""

content = content.replace(old_generalize, new_generalize)

with open('src/services/llmService.js', 'w') as f:
    f.write(content)

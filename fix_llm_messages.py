import sys

with open('src/services/llmService.js', 'r') as f:
    content = f.read()

# Replace the mangled _prepareMessages and the old _ensureUserMessage
start_marker = "  _prepareMessages(messages, systemPrompt) {"
end_marker = "  async generateResponse(messages, options = {}) {"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    new_method = """  _prepareMessages(messages, systemPrompt) {
    const prepared = [];
    if (systemPrompt) {
      prepared.push({ role: 'system', content: systemPrompt });
    }

    // Filter out invalid or empty messages
    const validMessages = (messages || []).filter(m => m && m.content && m.content.trim() !== "");
    prepared.push(...validMessages);

    const hasUser = prepared.some(m => m.role === 'user');
    if (!hasUser) {
      // API requires at least one user message
      prepared.push({ role: 'user', content: 'Proceed.' });
    }

    return prepared;
  }

"""
    content = content[:start_idx] + new_method + content[end_idx:]

# Update the call in generateResponse
content = content.replace(
    "const fullMessages = this._ensureUserMessage([{ role: 'system', content: systemPrompt }, ...messages]);",
    "const fullMessages = this._prepareMessages(messages, systemPrompt);"
)

with open('src/services/llmService.js', 'w') as f:
    f.write(content)

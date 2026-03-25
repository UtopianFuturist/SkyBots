with open('src/services/llmService.js', 'r') as f:
    content = f.read()

content = content.replace('_prepareMessages(messages, systemPrompt)', '_prepareMessages(messages, systemPrompt, options = {})')
content = content.replace('this._prepareMessages(messages, systemPrompt)', 'this._prepareMessages(messages, systemPrompt, options)')

with open('src/services/llmService.js', 'w') as f:
    f.write(content)

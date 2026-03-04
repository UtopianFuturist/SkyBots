import sys

file_path = "src/services/llmService.js"
with open(file_path, "r") as f:
    content = f.read()

old_desc = 'Parameters: { "time": "HH:MM (24h format)", "message": "string (the message or task description)", "date": "YYYY-MM-DD (optional, defaults to today)" }'
new_desc = 'Parameters: { "time": "HH:MM (24h format)", "message": "string (the message or task description)", "date": "YYYY-MM-DD (optional, defaults to today)", "action": { "tool": "any_tool", "parameters": {}, "query": "string" } (optional task to execute) }'

content = content.replace(old_desc, new_desc)

with open(file_path, "w") as f:
    f.write(content)

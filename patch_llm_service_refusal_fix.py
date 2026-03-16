import os

file_path = 'src/services/llmService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Update evaluateAndRefinePlan to be smarter about empty plans
old_note = '**NOTE:** If you refuse, you may either provide "refined_actions" (e.g., a simple conversational reply instead of tool use) or remain silent by returning an empty "refined_actions" array.'
new_note = '**NOTE:** If the proposed plan is empty but the user is directly addressing you, you SHOULD provide a conversational reply in "refined_actions" instead of refusing. Refuse ONLY if the actions are unsafe or completely inappropriate. If you refuse an Admin request, explain why in a conversational reply.'

if old_note in content:
    content = content.replace(old_note, new_note)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Refusal fix patch applied")
else:
    print("Could not find old_note in content")

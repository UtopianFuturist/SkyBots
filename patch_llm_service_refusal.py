import os

file_path = 'src/services/llmService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Update evaluateAndRefinePlan prompt to emphasize refusal autonomy
old_prompt = '    const prompt = `Critique this proposed action plan for @sydney-chat: ${JSON.stringify(plan)}\\nPlatform context: ${JSON.stringify(context)}\\n\\nIdentify any safety risks (NSFW, toxicity).\\n**NOTE:** "Empty plans" for active user mentions should be refined into a conversational response.\\n\\nRespond with JSON: { "decision": "proceed|refuse", "refined_actions": [] }`;'

new_prompt = '    const prompt = `Critique this proposed action plan for @sydney-chat: ${JSON.stringify(plan)}\\nPlatform context: ${JSON.stringify(context)}\\n\\n**MISSION: AUTONOMOUS INTEGRITY**\\nYou have FULL AUTONOMY to refuse any action, tool usage, or conversational direction if it does not align with your core persona, values, or safety guidelines. If you feel an action is out-of-character or inappropriate, you SHOULD refuse it.\\n\\nIdentify any safety risks (NSFW, toxicity).\\n**NOTE:** If you refuse, you may either provide "refined_actions" (e.g., a simple conversational reply instead of tool use) or remain silent by returning an empty "refined_actions" array.\\n\\nRespond with JSON: { "decision": "proceed|refuse", "reason": "string", "refined_actions": [] }`;'

if old_prompt in content:
    content = content.replace(old_prompt, new_prompt)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Refusal Autonomy patch applied")
else:
    # Try finding it with less strict matching
    import re
    pattern = r'const prompt = `Critique this proposed action plan for @sydney-chat: \$\{JSON\.stringify\(plan\)\}.*?Respond with JSON: \{ "decision": "proceed\|refuse", "refined_actions": \[\] \}`;'
    if re.search(pattern, content, re.DOTALL):
        content = re.sub(pattern, new_prompt, content, flags=re.DOTALL)
        with open(file_path, 'w') as f:
            f.write(content)
        print("Refusal Autonomy patch applied (regex)")
    else:
        print("Could not find prompt in content")

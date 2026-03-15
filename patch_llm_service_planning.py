import re

with open('src/services/llmService.js', 'r') as f:
    content = f.read()

# Update performAgenticPlanning prompt
search_planning = r'Available Tools: \[use_tool, request_user_input, etc\]'
replace_planning = """Available Tools: [bsky_post, image_gen, search, wikipedia, youtube, read_link, update_mood, set_goal, update_persona]
- **bsky_post**: Create a post or thread. Use this to respond to the user.
- **image_gen**: Generate and post an artistic image.
- **update_mood**: Shift your emotional state.

Respond with JSON: { "thought": "internal reasoning", "actions": [{ "tool": "tool_name", "parameters": { ... } }], "suggested_mood": "label" }"""

content = content.replace(search_planning, replace_planning)

# Update evaluateAndRefinePlan to be more permissive
search_evaluate = r'return JSON\.parse\(match \? match\[0\] : \'{ "decision": "proceed", "refined_actions": \[\] }\'\);'
replace_evaluate = """const data = JSON.parse(match ? match[0] : '{ "decision": "proceed", "refined_actions": [] }');
      if (data.decision === 'refuse' && (!plan.actions || plan.actions.length === 0)) {
          // Force a conversational response if empty plan
          return { decision: 'proceed', refined_actions: [{ tool: 'bsky_post', parameters: { text: 'I hear you. Let me think about that.' } }] };
      }
      return data;"""

content = content.replace(search_evaluate, replace_evaluate)

with open('src/services/llmService.js', 'w') as f:
    f.write(content)
print("Successfully patched planning and evaluation in src/services/llmService.js")

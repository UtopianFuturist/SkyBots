import sys

file_path = 'src/services/llmService.js'
with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if 'const prompt = "Refine plan: " + JSON.stringify(plan) + ". JSON: { \\"decision\\": \\"proceed\\", \\"refined_actions\\": [] }";' in line:
        new_lines.append('    const prompt = `Refine or Refuse plan: ${JSON.stringify(plan)}.\\nContext: ${JSON.stringify(context)}\\nEvaluate for persona alignment, safety, and operational boundaries.\\nJSON: { "decision": "proceed" | "refuse", "reason": "string", "refined_actions": [] }`;\n')
    else:
        new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)

import os

file_path = 'src/services/llmService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix the logic where refuse and empty actions resulted in silence
old_logic = """      // Safety/Sanity: If decision is refuse but there are no actions, force a fallback post if we have context
      if (data.decision === 'refuse' && (!plan.actions || plan.actions.length === 0)) {
           return {
               decision: 'refuse',
               refined_actions: []
           };
      }"""

new_logic = """      // Safety/Sanity: If decision is refuse but there are no actions, force a fallback post if we have context
      if (data.decision === 'refuse' && (!data.refined_actions || data.refined_actions.length === 0)) {
           console.log('[LLMService] Evaluator refused without refined actions. Adding fallback refusal message.');
           data.refined_actions = [{
               tool: 'discord_message',
               parameters: { message: "I've reviewed your request but I'm unable to fulfill it right now. I'm sorry." }
           }];
      }"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Evaluation logic patch applied")
else:
    print("Could not find old_logic in content")

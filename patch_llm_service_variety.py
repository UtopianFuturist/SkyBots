import os

file_path = 'src/services/llmService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Harden checkVariety prompt
old_leniency = """      SOCIAL LENIENCY: Be permissive of standard short social expressions (e.g., "Me too", "Good morning", "I'm here", "💙") even if used recently, as long as they aren't part of a long repetitive paragraph. Only flag as REPETITIVE if the core intellectual substance or complex structure is being recycled."""

new_leniency = """      NO GREETING REPETITION: You are strictly forbidden from starting every message with the same greeting (e.g., "Morning ☀️" or "Good morning"). Even if the user says it first, the agent should vary their response.
      SOCIAL LENIENCY: Be permissive of standard short social expressions (e.g., "Me too", "I'm here", "💙") even if used recently, but ONLY if they are not the opening of the message. If the agent repeats the same opening greeting 3 times in a row, it is REPETITIVE.
      FLAG AS REPETITIVE IF:
      - The message starts with the same greeting used in any of the last 5 messages.
      - The message uses the same structural "hook" or "reassurance" pattern seen recently."""

if old_leniency in content:
    content = content.replace(old_leniency, new_leniency)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Variety hardening patch applied")
else:
    print("Could not find old_leniency in content")

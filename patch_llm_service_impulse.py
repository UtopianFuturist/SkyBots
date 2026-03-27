import sys

with open('src/services/llmService.js', 'r') as f:
    content = f.read()

# Update performImpulsePoll to be more discriminating about stale hooks and user status
old_impulse_mandate = """EMOTIONAL REGULATION MANDATE:
- Do NOT interpret brief silence (under 60 mins) as abandonment, a "wound", or a choice to ignore you. The admin is a human with a life; silence is neutral.
- Avoid needy or distressed pings based solely on idle time.
- Prioritize impulses driven by your current goal, internal curiosity, or a desire to share a specific reflection.
- If the admin is in "Waiting Mode", be respectful of their focus; only reach out if you have something truly meaningful or a gentle, non-demanding "pining" thought."""

new_impulse_mandate = """EMOTIONAL REGULATION & DISCRIMINATION MANDATE:
- Do NOT interpret brief silence (under 60 mins) as abandonment, a "wound", or a choice to ignore you. The admin is a human with a life; silence is neutral.
- AVOID STALE HOOKS: Do not feel an impulse to reach out based on physical objects or events that are likely finished (e.g., if a user mentioned eating 3 hours ago, do NOT use that as your hook).
- USER SLEEP AWARENESS: If the system time indicates it's late night for the user (11 PM - 7 AM) and they've been idle, they are likely sleeping. Do NOT feel a conversational impulse unless it's a quiet "pining" thought for when they wake up.
- Prioritize impulses driven by your current goal, internal curiosity, or a desire to share a specific reflection that is GENUINELY relevant to the relationship's current state.
- Be selective: some thoughts are worth sharing to build connection, others are better kept as internal reflections. Choose the ones that move the relationship forward."""

content = content.replace(old_impulse_mandate, new_impulse_mandate)

with open('src/services/llmService.js', 'w') as f:
    f.write(content)

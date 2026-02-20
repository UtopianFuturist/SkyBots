import sys

with open('src/services/discordService.js', 'r') as f:
    content = f.read()

# Replace awaited calls with backgrounded calls
targets = [
    "await memoryService.createMemoryEntry('mood', `[MOOD] My mood has shifted to:",
    "await memoryService.createMemoryEntry('mood', `[MOOD] I have intentionally overridden my mood to:",
    "await memoryService.createMemoryEntry('goal', `[GOAL] Goal:",
    "await memoryService.createMemoryEntry('exploration', `[BRANCH] Parking thought:",
    "await memoryService.createMemoryEntry('fact', `Entity:",
    "await memoryService.createMemoryEntry('admin_fact', f.fact);"
]

for t in targets:
    # Handle the line ending and add .catch
    # We look for the call and remove 'await', then append .catch(...)
    # This is tricky with multiline. I'll do a simple replacement for what I see in grep.
    pass

# Manual replacements for safety
content = content.replace(
    "if (memoryService.isEnabled()) await memoryService.createMemoryEntry('mood', `[MOOD] My mood has shifted to: ${label} (Valence: ${valence}, Arousal: ${arousal}, Stability: ${stability})`);",
    "if (memoryService.isEnabled()) memoryService.createMemoryEntry('mood', `[MOOD] My mood has shifted to: ${label} (Valence: ${valence}, Arousal: ${arousal}, Stability: ${stability})`).catch(e => console.error('[DiscordService] Background memory entry failed:', e));"
)

content = content.replace(
    "await memoryService.createMemoryEntry('mood', `[MOOD] I have intentionally overridden my mood to: ${label} (Valence: ${valence}, Arousal: ${arousal}, Stability: ${stability})`);",
    "memoryService.createMemoryEntry('mood', `[MOOD] I have intentionally overridden my mood to: ${label} (Valence: ${valence}, Arousal: ${arousal}, Stability: ${stability})`).catch(e => console.error('[DiscordService] Background memory entry failed:', e));"
)

content = content.replace(
    "await memoryService.createMemoryEntry('goal', `[GOAL] Goal: ${goal} | Description: ${description || goal}`);",
    "memoryService.createMemoryEntry('goal', `[GOAL] Goal: ${goal} | Description: ${description || goal}`).catch(e => console.error('[DiscordService] Background memory entry failed:', e));"
)

content = content.replace(
    "await memoryService.createMemoryEntry('exploration', `[BRANCH] Parking thought: ${thought}`);",
    "memoryService.createMemoryEntry('exploration', `[BRANCH] Parking thought: ${thought}`).catch(e => console.error('[DiscordService] Background memory entry failed:', e));"
)

content = content.replace(
    "await memoryService.createMemoryEntry('fact', `Entity: ${f.entity} | Fact: ${f.fact} | Source: ${f.source || 'Conversation'}`);",
    "memoryService.createMemoryEntry('fact', `Entity: ${f.entity} | Fact: ${f.fact} | Source: ${f.source || 'Conversation'}`).catch(e => console.error('[DiscordService] Background memory entry failed:', e));"
)

content = content.replace(
    "await memoryService.createMemoryEntry('admin_fact', f.fact);",
    "memoryService.createMemoryEntry('admin_fact', f.fact).catch(e => console.error('[DiscordService] Background memory entry failed:', e));"
)

# Also background the ones in /approve
content = content.replace(
    "if (memoryService.isEnabled()) await memoryService.createMemoryEntry('persona_update', directive.instruction);",
    "if (memoryService.isEnabled()) memoryService.createMemoryEntry('persona_update', directive.instruction).catch(e => console.error('[DiscordService] Background memory entry failed:', e));"
)
content = content.replace(
    "if (memoryService.isEnabled()) await memoryService.createMemoryEntry('directive_update', `Platform: ${directive.platform}. Instruction: ${directive.instruction}`);",
    "if (memoryService.isEnabled()) memoryService.createMemoryEntry('directive_update', `Platform: ${directive.platform}. Instruction: ${directive.instruction}`).catch(e => console.error('[DiscordService] Background memory entry failed:', e));"
)

with open('src/services/discordService.js', 'w') as f:
    f.write(content)

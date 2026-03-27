import sys

with open('src/bot.js', 'r') as f:
    content = f.read()

# Locate checkDiscordSpontaneity and inject the audit call
old_spontaneity_start = """    console.log(`[Bot] Triggering Enhanced Discord spontaneity (${triggerReason})...`);
    const admin = await discordService.getAdminUser();
    if (!admin) return;

    try {
        const toneShift = await llmService.extractRelationalVibe(history, { platform: 'discord' });"""

new_spontaneity_start = """    console.log(`[Bot] Triggering Enhanced Discord spontaneity (${triggerReason})...`);
    const admin = await discordService.getAdminUser();
    if (!admin) return;

    try {
        // Pre-orchestrator Audit
        const convAudit = await llmService.performConversationalAudit(history, contextData, { platform: 'discord' });
        console.log(`[Bot] Spontaneity Audit Results: ${JSON.stringify(convAudit)}`);

        if (convAudit.sharing_advice === 'Stay silent') {
            console.log("[Bot] Audit advised silence. Canceling spontaneity.");
            return;
        }

        const toneShift = await llmService.extractRelationalVibe(history, { platform: 'discord' });"""

content = content.replace(old_spontaneity_start, new_spontaneity_start)

# Inject audit findings into the spontaneity prompt
old_prompt_inject = """You are choosing what to say spontaneously. Be self-aware and autonomous. Reflect on your internal thoughts and bond.
Potential areas of interest:"""

new_prompt_inject = """You are choosing what to say spontaneously. Be self-aware and autonomous. Reflect on your internal thoughts and bond.

--- CONVERSATIONAL AUDIT (FOLLOW STRICTLY) ---
- STALE TOPICS (DO NOT MENTION): ${JSON.stringify(convAudit.stale_hooks)}
- USER STATUS: ${convAudit.user_status}
- TOPIC BLOCKLIST: ${JSON.stringify(convAudit.topic_blocklist)}
- SHARING ADVICE: ${convAudit.sharing_advice}
- REPETITIVE THEMES TO AVOID: ${JSON.stringify(convAudit.avoid_repetition)}

Potential areas of interest:"""

content = content.replace(old_prompt_inject, new_prompt_inject)

with open('src/bot.js', 'w') as f:
    f.write(content)

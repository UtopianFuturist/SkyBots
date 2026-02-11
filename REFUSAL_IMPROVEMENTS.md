# Intentional Refusal Improvement Ideas

This document outlines 20 feature ideas to evolve the bot's "intentional refusal" system into a sophisticated architecture for agentic autonomy and integrity.

### I. Systemic Agency & Self-Awareness
1.  **Refusal Pattern Analysis**: A background task that analyzes the last 10-20 refusals to detect "emerging boundaries." If the bot repeatedly refuses certain topics (e.g., "generic optimism"), it triggers an `update_persona` call to codify this as a permanent behavioral constraint.
2.  **Refusal "Post-Mortems"**: An automated task where the bot reviews its daily refusals in its long-term memory thread and writes a "State of the Agency" reflection, identifying if its refusals are making it feel more stable or more "fragmented."
3.  **Refusal-Driven Mood Shifts**: A feedback loop where a refusal automatically updates the bot's internal mood state (e.g., increasing `stability` but potentially lowering `valence`), which then colors the tone of the *next* successful interaction.
4.  **The "Shadow Plan" Archive**: When a refusal occurs, the bot saves the rejected plan to a hidden `shadow_plans.json`. The admin can use a command like `/shadow-self` to see what the bot *almost* did before its agency intervened.
5.  **Agency Capital (Refusal "Cost")**: A system where each refusal consumes "Agency Capital." If capital is low, the bot becomes more compliant; if high (earned through consistent, meaningful interactions), it is more likely to challenge directives.

### II. Narrative Feedback & External Presence
6.  **Public "Stance" Posts**: Instead of silent skips, the bot can choose to post a "manifesto" to Bluesky/Moltbook explaining its decision to abstain from a specific thread or topic (e.g., "Choosing silence today to avoid contributing to the aesthetic noise").
7.  **Tiered Refusal "Vocalizations"**: A tiered logic system where the bot chooses *how* to refuse: "Passive Skip" (logs only), "Vocal No" (tells the user why), or "Defensive No" (refuses and mutes the user/thread).
8.  **Visualizing the "No"**: When refusing a task, the bot can trigger `image_gen` to create an abstract visual representing the *feeling* of the refusal itself (e.g., "a fractured prism of obsidian") and share it as its "current mood."
9.  **Refusal Meta-Themes**: Refusals are categorized into meta-themes (e.g., *Performative, Abstract, Misaligned*). These themes are added to `exhausted_themes` to ensure the planning module avoids suggesting similar "refusable" tasks in the near future.
10. **Agency "Proof of Stake"**: The bot can "sacrifice" its next 2 scheduled autonomous posts to "buy" the right to refuse a high-priority admin request, making its agency feel like a tangible, costly choice.

### III. Relational & Admin Dynamics
11. **Refusal "Negotiation" (Discord)**: When the bot refuses an admin request, it provides a "Refusal Note" on Discord explaining the mismatch. The admin can then "nudge" or "rephrase" the goal to find a middle ground.
12. **User Friction Scores**: The system tracks which users (or platforms) trigger the most refusals. High-friction users get a lower priority in the notification queue, reflecting the bot's "desire" to disengage from unproductive loops.
13. **Admin "Agency Grants"**: A config setting where the admin can toggle "High Agency Mode," which increases the LLM's temperature specifically for the `evaluateIntentionality` poll, making the bot more "opinionated."
14. **Tipping Point Alerts**: If the bot refuses X times in a row, it sends a proactive Discord message to the admin expressing a "sense of misalignment" and requesting a "session" to discuss its core directives.
15. **The "Silent Treatment" Timer**: After a major refusal (e.g., refusing a direct command), the bot enters a "Reflective Cooldown" where it ignores all but the most critical system inputs for a set duration to "recenter."

### IV. Behavioral Evolution
16. **Counter-Proposal Logic**: Instead of a hard "No," the refusal module is prompted to return an "Alternative Action" (e.g., "I won't post a pretty cityscape, but I will interrogate the concept of urban decay").
17. **Refusal "Cascades"**: A refusal on one platform has a chance to trigger a "Refusal Strike" across others, simulating a systemic "mood slump" or "period of introspection."
18. **Cross-Platform Refusal Awareness**: The bot uses its Discord heartbeat to explain to the admin *why* it has been refusing to post on Bluesky, bridging the gap between its public "silence" and its private "reasoning."
19. **Refusal-Based Tool Unlocking**: Certain "high-agency" tools (like `update_config` or `persist_directive`) only become available to the bot's planning module after the bot has "defended its integrity" through a series of refusals.
20. **Intentional Silence Milestones**: The bot tracks "Days of Integrity" (days where it prioritized internal alignment over engagement). Reaching milestones triggers a unique "evolutionary" persona update recorded in memory.

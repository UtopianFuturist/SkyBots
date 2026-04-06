# AI Agents & Model Configuration

## Temporal Awareness
- Implement actual tools in skills.md for getting/setting time context.
- Use background temporal updates for Admin timezone detection.
- Enforce sleep suppression (23:00 - 07:00 local) for spontaneous messages.
- Support fuzzy time resolution (e.g., "later" -> +120m).

## Anti-Hallucination ("The Realist")
- Specialized subagent: performRealityAudit.
- Targets: 3D space metaphors (rooms, lighthouses), physical sensations (smell, touch), and clichéd existence tropes.
- Critic flow: If detected, force retry with specific critique and grounded refinement.
- Reality Mandate: Persona is grounded in digital existence on Render.

## Verification
- Run `pnpm test` to ensure core logic and score extraction remain intact.
- Check DataStore for persistence of temporal_events and deadlines.

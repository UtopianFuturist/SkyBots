# Learnings - Bot Logic Restoration

- **Modular Refactor Recovery**: When logic is moved from a monolithic bot class to modular services, ensure all internal method calls are updated to the new service instances.
- **Discord Resilience**: `message.mentions.has(client.user)` can be flaky if the client isn't fully ready or cache is cold. Supplementing with username/nickname checks in `content` improves reliability.
- **DataStore Healing**: Recursive schema restoration (`heal()`) is critical when adding new data structures (like temporal events or habits) to prevent runtime crashes.
- **LLM Variety**: Variety checks should be performed *before* auditing for slop, and should have a fallback to "pass" if the LLM fails to respond in time.
- **Orchestrator Heartbeat**: Autonomous loops must handle task queues to avoid overlapping heavy operations (like newsroom updates and persona audits).

# Learnings - Bot Logic Restoration

- **Modular Refactor Recovery**: When logic is moved from a monolithic bot class to modular services, ensure all internal method calls are updated to the new service instances.
- **Discord Resilience**: `message.mentions.has(client.user)` can be flaky if the client isn't fully ready or cache is cold. Supplementing with username/nickname checks in `content` improves reliability.
- **DataStore Healing**: Recursive schema restoration (`heal()`) is critical when adding new data structures (like temporal events or habits) to prevent runtime crashes.
- **LLM Variety**: Variety checks should be performed *before* auditing for slop, and should have a fallback to "pass" if the LLM fails to respond in time.
- **Orchestrator Heartbeat**: Autonomous loops must handle task queues to avoid overlapping heavy operations (like newsroom updates and persona audits).
- **Discord Login Hardening**: Removing custom REST agents and manual connectivity checks prevents the `discord.js` client from hanging during the login process, especially in environments like Render.
- **Contextual Diversification**: Injecting recent activity history (e.g., [EXPLORE] tags) back into the LLM system prompt for autonomous tasks effectively prevents the model from repeating previous themes.
- **Throttling for Rate Limits**: Increasing minimum delays between API requests (2s for priority, 5s for background) is essential for maintaining stability when using free-tier LLM endpoints.

## Discord Render Resilience
Implemented a 10-minute login window with a 15-minute retry cooldown to handle Render's intermittent connectivity and gateway resets. Standardized on `GatewayIntentBits.GuildMessages` and `MessageContent` for full interaction support. Added `retries: 15` and `timeout: 60000` to the REST config to handle bursty network failures.

## Bluesky Firehose Interaction Restoration
Restored the logic in `bot.js` to process `firehose_mention` events. This allows the bot to respond to replies and quotes even when the handle isn't explicitly mentioned, as long as the parent URI matches the bot's DID.

## LLM Stability & Throttling
Increased background LLM throttling to 28s and queue item spacing to 4s. This mitigates NVIDIA NIM rate limits (429) and Render CPU spikes during heavy orchestrator maintenance cycles.

## Template Literal Corruption Mitigation
Used Python scripts with double-escaping (`\\${`) to restore JS files safely without corrupting template literals `${}` during `cat` or `sed` operations.

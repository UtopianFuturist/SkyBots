# Proposed Discord Conversational Improvements

This document outlines 30 proposed improvements and fixes for the bot's conversational ability on Discord, categorized by functional area.

## I. Pacing & Flow
1. **Variable Typing Latency**: Calculate typing duration based on character count and complexity. Call `sendTyping()` repeatedly for long messages to simulate human thinking/typing time.
2. **Conversational "Bridge" Fragments**: For tool-heavy plans, send a quick, persona-aligned acknowledgment (e.g., "Looking into that...") as an immediate first chunk.
3. **Logical Message Chunking**: Enhance `splitTextForDiscord` to detect logical breaks like paragraphs or bullet points, sending them as separate messages with jittered delays.
4. **Adaptive Response Jitter**: Introduce random 1-3 second delays for simple replies to avoid the "instant bot" feeling.
5. **Multi-Message "Thought Cascading"**: Break substantive thoughts into multiple sequentially sent messages.
6. **Interrupt Detection & Pivot**: If a user sends a new message while the bot is generating/typing, incorporate the new context into the final response.

## II. Memory & Context
7. **Channel-Specific Local Memory**: Isolate facts and relationships per channel in public servers to prevent context leakage.
8. **Persistent "User Fact" Store**: Extract and save specific user preferences into a dedicated Discord local store for long-term recognition.
9. **Historical Vibe Recovery**: On startup, scan the last 5-10 messages in active channels to re-establish context.
10. **Thread Root Anchoring**: In Discord Threads, include the thread's starting message and purpose in the system prompt.
11. **Emotional Sentiment Weighting**: Track user sentiment over time and adjust the bot's "base warmth" level per user.
12. **Cross-Thread Memory Sync**: Allow the bot to reference its own interactions from other channels if relevant to the current topic.

## III. Admin Utility & Control
13. **Natural Language Directive Capture**: Detect phrases like "From now on..." as instructions and offer to save them via Discord DM.
14. **Direct Render Log Natural Querying**: Improve the `get_render_logs` tool to support natural language queries.
15. **Interactive Conflict Resolution**: Flag when a new admin instruction contradicts an existing one and ask for priority.
16. **Admin-Only "Focus Mode"**: Command to temporarily suppress spontaneous messages and tool-heavy musings.
17. **Pre-Post Consultation**: Share a "draft" of a planned Bluesky post with the admin for feedback before publishing.
18. **Discord-Native Feature Toggles**: Implement slash commands (e.g., `/vision on/off`) for granular control.

## IV. Stability & Performance
19. **Shard Stability Monitoring**: Proactively alert the admin if the Discord gateway connection is degrading.
20. **Parallel Vision Analysis**: Analyze multiple message attachments simultaneously using `Promise.all`.
21. **Auto-Fallback to Flash Model**: Instantly retry with a faster model if the primary model exceeds a 30s response time.
22. **Intelligent Link Pre-fetching**: Perform background "head" requests on detected links to get titles/meta-data.

## V. Variety & Creative Variety
23. **"Slop" Self-Correction Pass**: Use a secondary fast LLM pass to rewrite only offending clichés in a rejected draft.
24. **Relationship-Based Variety Lenience**: Lower the repetition threshold for high-warmth users to allow for shared vocabulary.
25. **Dynamic Emoji Mirroring**: Track and mirror user emoji frequency and style.
26. **Multi-Draft Synthesis**: Use the LLM to synthesize unique elements from multiple drafts into one final "super-draft."
27. **Conversation "Heartbeat" Jitter**: Randomize the 15-minute heartbeat interval to avoid mechanical timing.
28. **Discord-Native Theme Rotation**: Maintain a rolling list of "recently explored themes" across all users to prevent repetition.

## VI. Multi-User & Server Dynamics
29. **Social Battery/Rate Limiting**: In busy channels, implement a "social battery" to be more selective in interjections.
30. **Group Conversation Orchestration**: Decide *when* to join a conversation between others based on relevance, rather than only mentions.

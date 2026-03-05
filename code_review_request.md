# Code Review Request: Conversational Response Improvements (Recency & Temporal Awareness)

## Summary of Changes
This PR addresses the issue where the bot "talks past" the user by fixating on historical emotional hooks instead of responding to the latest message. It introduces "Temporal Awareness" and "Recency Priority" across the planning modules.

### Key Enhancements:
1.  **Temporal Awareness in History**: Modified `llmService._formatHistory` to inject relative timestamps (e.g., `[15m ago]`, `[2h ago]`) into the conversation context.
2.  **Preserved Timestamps**: Updated `src/bot.js` (`_getThreadHistory`) to include `indexedAt` timestamps for Bluesky threads. Discord already provides `timestamp`.
3.  **Recency Priority in Pre-Planning**: Updated the `performPrePlanning` system prompt to explicitly distinguish between "Active Session" and "Historical Background" using timestamps. Instructed the subagent to prioritize the latest user statement.
4.  **Latest Message Priority in Agentic Planning**: Updated `performAgenticPlanning` system prompt to enforce responding to the MOST RECENT message first and avoiding "Thematic Regression".
5.  **Single-Response Topic Lock**: Introduced a "Lock-and-Pass" directive in the planning module to prevent repetitive empathy or "echoing" of previously addressed hooks (e.g., no more repeating "I'm sorry about your rough day" in every message).
6.  **Bug Fix**: Fixed a method signature issue for `generateDrafts` in `llmService.js`.

## Verification Results
-   **Unit Tests**: All tests in `tests/llmService.test.js` and `tests/bot.test.js` passed.
-   **Manual Validation**: Verified that relative timestamps are correctly calculated and injected into the history text.

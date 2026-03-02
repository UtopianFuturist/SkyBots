# Code Review Request: Discord Spontaneity & Heartbeat Repetition Fixes

## Changes Overview
This PR addresses the "Heartbeat repetition bug" where the bot could trigger multiple heartbeat/spontaneous messages in rapid succession or repeat messages sent hours apart.

### 1. Spontaneity Loop Logic (`src/bot.js`)
- Modified `checkDiscordSpontaneity` to calculate `targetTime` relative to `Math.max(Date.now(), effectiveLastInteractionTime)`. This prevents "overdue" targets from triggering immediate back-to-back loops.
- Changed the temporary reset of `targetTime` from `0` to `Date.now() + 120000` (2 minutes). This provides a safety buffer if the subsequent logic fails to set a long-term target or if the heartbeat is suppressed.

### 2. Repetition Suppression
- **Heartbeats**: Increased lookback for `recentBotMsgsInHistory` from 15 to 100 messages to catch repetitions spanning several hours.
- **Follow-up Polls**: Added explicit `checkExactRepetition` and `checkSimilarity` checks to `performDiscordFollowUpPoll`. If a duplicate is detected, the message is suppressed and the next check is pushed forward by 10-20 minutes.

### 3. Suppression Handling
- Ensured `dataStore.updateLastDiscordHeartbeatTime(Date.now())` is called in all suppression paths (Freshness, Quiet Hours, 'None' decision, Final attempt failure, Duplicate detection). This correctly resets the quiet timer and prevents the 1-minute loop from re-triggering the same logic.

## Verification
- Ran existing `tests/bot.test.js` (PASSED).
- Created a new `tests/spontaneity.test.js` to specifically verify the repetition suppression in follow-up polls (PASSED).

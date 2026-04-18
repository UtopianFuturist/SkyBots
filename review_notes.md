# SkyBots audit notes

## Confirmed Discord issues

1. `src/services/discordService.js` defines `handleMessage(message)` but never registers a `messageCreate` listener on the Discord client. The service currently only registers `ready` and `error`, so inbound DMs, mentions, and replies will never reach the handler.
2. `src/services/discordService.js` defines `performStartupCatchup()` but current `src/bot.js` never calls it after Discord init. A historical file, `restore_bot_v2.js`, shows this used to be called after a short delay.
3. `src/services/discordService.js` reads `DISCORD_GUILD_ID` from config, but `getAdminUser()` ignores it and scans all guilds with `guild.members.fetch({ query: this.adminName, limit: 1 })`. This is fragile and can miss the admin entirely.
4. `src/services/discordService.js` uses `config.BOT_NAME` for Discord mention matching instead of `config.DISCORD_NICKNAME`, so the Discord-specific nickname env var is effectively unused.

## Deployment blockers and readiness gaps

1. `package.json` places `dotenv` and `node-fetch` in `devDependencies`, but both are imported at runtime by production code (`config.js` and `src/services/llmService.js`). On a production install that omits dev dependencies, startup can fail with module resolution errors.
2. `render.yaml` does not declare `ADMIN_BLUESKY_HANDLE` or `BOT_NAME`, even though `config.js` validates both as required at module load. The deploy can fail before the bot reaches startup.
3. `render.yaml` also omits all Discord env vars, so deployment instructions are incomplete for the reported Discord bridge path.
4. `src/services/dataStore.js` hardcodes the DB path to `src/data/db.json` and does not use the `DATA_PATH` variable defined in `render.yaml`, so the configured persistent disk path is currently ignored.

## Test/readiness signals

1. The current test suite fails. `tests/llmService.test.js` reports `llmService.checkVariety is not a function`.
2. `src/services/llmService.js` contains obvious placeholder implementations that do not match test expectations and may cause weak runtime behavior:
   - `rateUserInteraction() { return 5; }`
   - `selectBestResult(q, r) { return r?.[0]; }`
   - `isReplyCoherent() { return { score: 10 }; }`
3. `discordService.js` calls `llmService.checkVariety(...)` in `sendSpontaneousMessage()`, so the missing method is not just a test problem; it is a real runtime risk for Discord spontaneity features.

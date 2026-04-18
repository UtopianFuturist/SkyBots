# SkyBots code audit and deployment-readiness review

I reviewed the repository with an emphasis on the reported **Discord login/bot bridge breakage**, then checked the surrounding startup and deployment path for obvious regressions that can be addressed **without major refactoring**.

## Executive summary

The repository does **not** look like it needs a large architectural rewrite to come back up. The biggest problems are concentrated in a few places and look like the kind of regressions that happen after heavy automated edits:

| Area | Status | What is wrong | Likely impact |
| :-- | :-- | :-- | :-- |
| Discord client wiring | Broken | The service defines handlers but does not register the inbound message event | Discord bot may log in but never react to DMs, replies, or mentions |
| Discord startup lifecycle | Incomplete | Startup catch-up logic exists but is no longer called | Missed admin messages after restart; bridge feels dead or inconsistent |
| Discord admin discovery | Fragile | `DISCORD_GUILD_ID` is configured but ignored; admin lookup relies on username search | Bot may fail to find the admin reliably |
| Runtime dependencies | Risky | `dotenv` and `node-fetch` are in `devDependencies` even though production code imports them | Production boot can fail if dev deps are pruned |
| Render configuration | Incomplete | Required env vars in code are missing from `render.yaml` | Deploy can fail before services finish initializing |
| Persistent storage | Misconfigured | `DATA_PATH` is declared for Render but ignored by the datastore | State persistence on the mounted disk is not actually used |
| LLM helper methods | Regressed | Several helpers are stubbed or missing | Tests fail; some runtime features are degraded or broken |

## Highest-confidence Discord findings

### 1. The Discord service never registers a message listener

In `src/services/discordService.js`, the client only wires `ready` and `error` handlers during initialization. The file defines a full `handleMessage(message)` function, but there is no `messageCreate` listener attached to the client.

That means the bridge can appear to connect successfully while **never processing inbound Discord traffic**.

| File | Evidence |
| :-- | :-- |
| `src/services/discordService.js` | `handleMessage(message)` exists, but there is no `this.client.on('messageCreate', ...)` registration |
| `src/services/discordService.js` | Only `ready` and `error` listeners are currently attached |

**Low-refactor fix:** add a `messageCreate` listener in `init()` that calls `this.handleMessage(message)`.

### 2. Startup catch-up logic exists but is not being called anymore

`performStartupCatchup()` is still implemented in `src/services/discordService.js`, but the current `src/bot.js` no longer triggers it after Discord initialization.

A historical file in the repo, `restore_bot_v2.js`, shows that the project previously called this catch-up method after a short delay. That strongly suggests the current omission is an accidental regression rather than an intentional design change.

**Impact:** after restart or redeploy, unread admin DMs are not replayed, which makes the Discord bridge feel unreliable even if login succeeds.

**Low-refactor fix:** restore the delayed `performStartupCatchup()` call after `discordService.init(this)`.

### 3. `DISCORD_GUILD_ID` is present in config but ignored in admin lookup

The code loads `DISCORD_GUILD_ID` in `config.js`, and the README recommends setting it for reliability, but `getAdminUser()` in `src/services/discordService.js` does not use it. Instead, it loops over all guilds and runs:

> `guild.members.fetch({ query: this.adminName, limit: 1 })`

This is a fragile lookup strategy. It can miss the correct member, depend on partial matches, and fail if multiple similar usernames exist.

**Low-refactor fix:** if `DISCORD_GUILD_ID` is present, fetch that guild directly first and resolve the admin there; only fall back to broad scanning if needed.

### 4. Discord nickname config is not honored

`config.js` exposes `DISCORD_NICKNAME`, but the service sets:

> `this.nickname = config.BOT_NAME || 'Bot';`

So the Discord-specific nickname variable is effectively unused.

**Impact:** mention detection and conversational matching on Discord can behave differently than deployment configuration suggests.

**Low-refactor fix:** prefer `config.DISCORD_NICKNAME || config.BOT_NAME`.

## Deployment-readiness blockers

### 1. Runtime modules are incorrectly classified as dev-only

`package.json` currently places both **`dotenv`** and **`node-fetch`** in `devDependencies`.

That is a deployment risk because production code imports them directly:

| Runtime file | Runtime import |
| :-- | :-- |
| `config.js` | `import dotenv from 'dotenv';` |
| `src/services/llmService.js` | `import fetch from 'node-fetch';` |

If your production install excludes dev dependencies, startup can fail with module resolution errors before the bot does anything useful.

**Low-refactor fix:** move `dotenv` and `node-fetch` into `dependencies`.

### 2. `render.yaml` is out of sync with `config.js`

`config.js` validates these as required at module load:

- `NVIDIA_NIM_API_KEY`
- `BLUESKY_IDENTIFIER`
- `BLUESKY_APP_PASSWORD`
- `ADMIN_BLUESKY_HANDLE`
- `BOT_NAME`

But `render.yaml` currently does **not** define `ADMIN_BLUESKY_HANDLE` or `BOT_NAME` at all.

That means a Render deployment can fail immediately during configuration validation.

It also does not declare the Discord-related variables needed for the bot bridge path:

- `DISCORD_BOT_TOKEN`
- `DISCORD_ADMIN_NAME`
- `DISCORD_GUILD_ID`
- `DISCORD_NICKNAME`
- `DISCORD_HEARTBEAT_ADDENDUM`

**Low-refactor fix:** align `render.yaml` with the config contract, or at minimum document that these must be manually set in Render.

### 3. Persistent disk path is configured but ignored

`render.yaml` defines:

> `DATA_PATH=/data/db.json`

But `src/services/dataStore.js` hardcodes:

> `this.dbPath = path.resolve(process.cwd(), 'src/data/db.json');`

So the persistent disk mount is not actually being used.

**Impact:** state can remain tied to the repo directory instead of the mounted disk, which undermines persistence across deploys or instance replacement.

**Low-refactor fix:** set the datastore path from `process.env.DATA_PATH` with the current repo-local file as fallback.

## Test and code-quality findings that still matter in production

The repository does **not** currently pass its own test suite.

### Observed test failures

| Test file | Failure |
| :-- | :-- |
| `tests/llmService.test.js` | `llmService.checkVariety is not a function` |
| `tests/scoreExtraction.test.js` | helper methods return placeholders or wrong values instead of parsing the final numeric value |

### Root cause

`src/services/llmService.js` contains placeholder-style methods:

```js
async isAutonomousPostCoherent() { return { score: 10 }; }
async rateUserInteraction() { return 5; }
async selectBestResult(q, r) { return r?.[0]; }
async extractRelationalVibe() { return "neutral"; }
async isUrlSafe() { return { safe: true }; }
async validateResultRelevance() { return true; }
async isPostSafe() { return { safe: true }; }
async isReplyCoherent() { return { score: 10 }; }
```

And `checkVariety()` is missing entirely, even though:

- the tests expect it,
- `discordService.sendSpontaneousMessage()` calls it at runtime.

So this is not just a testing issue. It is a real runtime readiness issue.

### Good news

The repo already includes historical restoration snippets in `backup_scripts/` that show the intended low-refactor behavior for:

- `checkVariety()`
- `selectBestResult()`
- `isReplyCoherent()`
- `rateUserInteraction()`

These look like straightforward restorations, not architectural work.

## What I would fix first, in order

| Priority | Change | Why it matters |
| :-- | :-- | :-- |
| 1 | Reattach Discord `messageCreate` listener | Most likely direct cause of the current broken Discord bridge behavior |
| 2 | Restore delayed `performStartupCatchup()` call | Brings post-restart Discord continuity back |
| 3 | Make `getAdminUser()` use `DISCORD_GUILD_ID` when set | Improves admin discovery reliability immediately |
| 4 | Honor `DISCORD_NICKNAME` | Fixes mismatch between config and actual mention detection |
| 5 | Move `dotenv` and `node-fetch` to `dependencies` | Prevents production startup failures |
| 6 | Add missing required env vars to `render.yaml` | Prevents boot-time config failures |
| 7 | Make datastore honor `DATA_PATH` | Restores persistent deployment state |
| 8 | Restore missing/stubbed LLM helper methods | Clears test failures and removes Discord spontaneity/runtime regressions |

## Suggested minimal patch set

Without refactoring architecture, the smallest practical recovery set is:

1. In `src/services/discordService.js`:
   - register `messageCreate`,
   - optionally register a `ready` follow-up that triggers catch-up,
   - use `DISCORD_GUILD_ID` in `getAdminUser()`,
   - use `DISCORD_NICKNAME` if present.
2. In `src/bot.js`:
   - restore the delayed `discordService.performStartupCatchup()` call after init.
3. In `package.json`:
   - move `dotenv` and `node-fetch` to `dependencies`.
4. In `render.yaml`:
   - add `ADMIN_BLUESKY_HANDLE`, `BOT_NAME`, and the Discord env vars.
5. In `src/services/dataStore.js`:
   - respect `process.env.DATA_PATH`.
6. In `src/services/llmService.js`:
   - restore `checkVariety()`,
   - replace placeholder scoring helpers with the existing low-refactor versions already preserved under `backup_scripts/`.

## Bottom line

The project appears **recoverable with targeted repairs rather than a rewrite**. The Discord path looks broken primarily because **the event wiring and startup follow-through were partially removed**, not because the entire Discord integration has to be redesigned.

If you want, the next sensible step would be a **small surgical patch pass** that restores those specific behaviors and gets the test suite green again, rather than letting another large automated rewrite touch the whole repo.

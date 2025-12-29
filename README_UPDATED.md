# Updated Bluesky Chatbot Architecture

The chatbot has been refactored into a modular, stateful, and more autonomous agent.

## Key Improvements

1.  **Modular Architecture**: The code is now split into logical services (`src/services/`) and utilities (`src/utils/`), making it easier to maintain and extend.
2.  **Persistent Memory**: Using `lowdb`, the bot now remembers:
    *   Replied posts (to avoid duplicates across restarts).
    *   User blocklists (`!stop` command).
    *   Muted threads (`!mute` command).
    *   User interaction history (for context-aware conversations).
3.  **Loop Prevention**:
    *   **Bot-to-Bot**: Automatically detects other bots and limits conversation length.
    *   **Semantic Loops**: Checks if a new response is too similar to recent ones in the same thread.
4.  **New Model Integration**: Now uses the `nvidia/nemotron-3-nano-30b-a3b` model for more efficient and capable responses.
5.  **Render Ready**: Updated `package.json` and `render.yaml` to support `pnpm` and the new entry point.

## Project Structure

*   `src/bot.js`: Main entry point and orchestration logic.
*   `src/services/`:
    *   `blueskyService.js`: All interactions with the Bluesky API.
    *   `llmService.js`: Integration with Nvidia NIM API and semantic loop checks.
    *   `dataStore.js`: Persistent storage using `lowdb`.
*   `src/utils/`:
    *   `commandHandler.js`: Logic for processing bot commands.
*   `src/data/`: Directory for the persistent database (`db.json`).

## Deployment on Render

The project is configured to deploy seamlessly on Render. Ensure the following environment variables are set:
*   `NVIDIA_NIM_API_KEY`
*   `BLUESKY_IDENTIFIER`
*   `BLUESKY_APP_PASSWORD`
*   `ADMIN_BLUESKY_HANDLE`
*   (Other optional variables as defined in `config.js`)

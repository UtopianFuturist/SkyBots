# Dearest Llama: Autonomous & Stateful Bluesky Agent

Dearest Llama is a modular, stateful, and highly autonomous Bluesky social media bot, powered by Nvidia NIM for cutting-edge language and image generation. It's designed for robust, long-term interaction, featuring smart response filtering, persistent memory, and a suite of powerful API-driven tools.

## ✨ Key Features

- **Smart Response Filtering**: Uses an LLM to determine if a mention is relevant and safe to reply to, avoiding unnecessary interactions.
- **Chained Replies**: Automatically splits longer responses into a threaded chain of up to 3 posts.
- **Nvidia NIM Image Generation**: Creates high-quality images directly in replies using the Flux Schnell model.
- **Vetted Google Image Search**: Searches for images and uses an LLM to select the most relevant result from the top 4 candidates.
- **Web & YouTube Search**: Fetches and displays information from Google and YouTube as convenient link cards.
- **User Context Analysis**: Gathers a user's bio and recent posts to provide more informed and personalized responses.
- **Persistent Memory**: Remembers past interactions with users and mutes threads on command, even after restarting.
- **Enhanced Safety**: Includes pre-reply checks for both user posts and the bot's own responses to ensure all interactions are appropriate.
- **Detailed Logging**: Provides step-by-step logging for easy debugging on platforms like Render.

## 📁 Project Structure

The codebase is organized into a modular structure for easy maintenance and expansion:

-   `src/bot.js`: The main entry point and orchestration logic.
-   `src/services/`: All external API and data handling logic.
    -   `blueskyService.js`: Manages Bluesky API interactions.
    -   `llmService.js`: Handles calls to Nvidia NIM for text-based tasks.
    -   `imageService.js`: Manages calls to Nvidia NIM for image generation.
    -   `googleSearchService.js`: Handles Google web and vetted image searches.
    -   `youtubeService.js`: Handles YouTube video searches.
    -   `dataStore.js`: Manages persistent storage with `lowdb`.
-   `src/utils/`: Utility functions for command handling and text manipulation.
-   `tests/`: Unit tests for the services and utilities.

## ⚙️ Deployment on Render

The bot is pre-configured for seamless deployment on Render.

### Prerequisites

1.  A Bluesky account and an App Password.
2.  An Nvidia NIM API Key.
3.  A Google Cloud API Key with the **Custom Search JSON API** and **YouTube Data API v3** enabled.
4.  A Google Custom Search Engine ID.

### Setup

1.  Fork this repository.
2.  Create a new **Web Service** on Render.
3.  Connect your forked repository.
4.  Set the **Build Command** to `pnpm install`.
5.  Set the **Start Command** to `pnpm start`.
6.  Add all the required environment variables (see below).

## 🔑 Environment Variables

### Required

| Variable | Description |
| :--- | :--- |
| `NVIDIA_NIM_API_KEY` | Your Nvidia NIM API key for text and image generation. |
| `BLUESKY_IDENTIFIER` | Your bot's Bluesky handle (e.g., `username.bsky.social`). |
| `BLUESKY_APP_PASSWORD`| Your Bluesky app password. |
| `ADMIN_BLUESKY_HANDLE`| The Bluesky handle of the bot's administrator. |
| `GOOGLE_CUSTOM_SEARCH_API_KEY` | Your Google Cloud API Key. |
| `GOOGLE_CUSTOM_SEARCH_CX_ID` | Your Google Custom Search Engine ID. |
| `YOUTUBE_API_KEY` | Your Google Cloud API Key (can be the same one). |

### Optional

| Variable | Description | Default Value |
| :--- | :--- | :--- |
| `TEXT_SYSTEM_PROMPT` | Defines the bot's conversational persona. | (A friendly, inquisitive, and witty persona) |
| `SAFETY_SYSTEM_PROMPT`| Defines the safety guidelines for all content. | (A strict SFW and clean content policy) |
| `IMAGE_PROMPT_SYSTEM_PROMPT` | A prompt to revise user-provided image prompts. | (Adds cats to prompts that don't have animals) |
| `CHECK_INTERVAL` | Milliseconds between checking for new mentions. | `60000` |

## 💬 User Commands

The bot understands natural language commands in addition to the following explicit commands:

| Command | Purpose |
| :--- | :--- |
| `!stop` | Blocks the bot from replying to you. |
| `!resume` | Unblocks the bot. |
| `!mute` | Mutes the current thread. |
| `!help` | Displays a list of available commands. |
| `google [query]` | Searches the web. |
| `youtube [query]` | Searches YouTube for videos. |
| `generate image of [prompt]`| Creates an image using Nvidia NIM. |
| `find image of [query]` | Performs a vetted Google Image search. |

# Dearest Llama: Autonomous & Stateful Bluesky Agent

This project has been refactored into a modular, stateful, and highly autonomous Bluesky social media chatbot. It is designed for robust, long-term interaction and is powered by the latest Nvidia NIM large language models.

## 🚀 Architectural & Functional Improvements

The bot has been completely refactored to address issues with volatile memory, conversational looping, and maintainability.

| Feature | Old Implementation | New Implementation | Benefit |
| :--- | :--- | :--- | :--- |
| **Architecture** | Monolithic `index.js` (5k+ lines) | Modular services (`blueskyService`, `llmService`, `dataStore`) | Easier maintenance, testing, and feature expansion. |
| **LLM Model** | `llama-3.3-nemotron-super-49b-v1` | `nvidia/nemotron-3-nano-30b-a3b` | Enhanced capability and efficiency. |
| **Memory** | Volatile in-memory Sets/Maps | Persistent storage via `lowdb` (`src/data/db.json`) | Bot remembers state and history across restarts. |
| **User Memory** | None (only thread history) | Persistent user interaction history | Context-aware, personalized responses. |
| **Loop Prevention** | Basic bot-to-bot message count | Semantic similarity check + persistent conversation length tracking | Avoids repetitive, looping conversations with both bots and humans. |

## 📁 Project Structure

The codebase is now organized into a clear, maintainable structure:

*   `src/bot.js`: The main entry point and orchestration logic.
*   `src/services/`: Contains all external API and data handling logic.
    *   `blueskyService.js`: Handles all interactions with the Bluesky API.
    *   `llmService.js`: Manages calls to the Nvidia NIM API, including the semantic loop check.
    *   `dataStore.js`: Handles persistent storage for state and memory using `lowdb`.
*   `src/utils/`: Contains utility functions.
    *   `commandHandler.js`: Logic for processing user commands.
*   `src/data/`: Stores the persistent database file (`db.json`).

## ⚙️ Deployment on Render

The bot is configured for seamless deployment on Render.

### Prerequisites

1.  A Bluesky account and an App Password.
2.  An Nvidia NIM API Key.
3.  Google Custom Search API Key and CX ID (for web search features).
4.  YouTube Data API Key (for video search features).

### Setup

1.  Fork this repository.
2.  Create a new **Web Service** on Render.
3.  Connect your forked repository.
4.  Set the **Build Command** to `pnpm install`.
5.  Set the **Start Command** to `pnpm start`.

## 🔑 Environment Variables

### Required Environment Variables

| Variable | Description |
| :--- | :--- |
| `NVIDIA_NIM_API_KEY` | Your Nvidia NIM API key (used for text and image generation). |
| `BLUESKY_IDENTIFIER` | Your bot's Bluesky handle (e.g., `username.bsky.social`). |
| `BLUESKY_APP_PASSWORD` | Your Bluesky app password. |
| `ADMIN_BLUESKY_HANDLE` | The Bluesky handle of the bot's administrator (e.g., `adminuser.bsky.social`). Only this user can issue admin commands. |
| `GOOGLE_CUSTOM_SEARCH_API_KEY` | Your Google Cloud API Key enabled for the Custom Search JSON API (for web and image search). |
| `GOOGLE_CUSTOM_SEARCH_CX_ID` | Your Google Custom Search Engine ID (cx value). |
| `YOUTUBE_API_KEY` | Your Google Cloud API Key enabled for the YouTube Data API v3 (for video search). |
| `TOGETHER_AI_API_KEY` | Your Together AI API key (used for image generation). |

### Optional Environment Variables (Customization)

| Variable | Description | Default Value |
| :--- | :--- | :--- |
| `TEXT_SYSTEM_PROMPT` | System prompt defining the bot's conversational persona and style. | (Detailed conversational prompt) |
| `SAFETY_SYSTEM_PROMPT` | System prompt defining safety guidelines for all content generation. | (Strict SFW and clean content policy) |
| `IMAGE_PROMPT_SYSTEM_PROMPT` | System prompt for an auxiliary model to generate image prompts. | (Prompt to add cats to image prompts) |
| `CHECK_INTERVAL` | Milliseconds between checks for new mentions. | `60000` (1 minute) |
| `MAX_RETRIES` | Maximum number of retries for failed operations. | `5` |
| `BACKOFF_DELAY` | Base delay in milliseconds for exponential backoff. | `60000` |
| `MAX_REPLIED_POSTS` | Maximum number of posts to track as replied. | `1000` |

## 💬 User Commands

The bot supports several commands for interaction control, which are now persistent across restarts:

| Command | Purpose | Persistence |
| :--- | :--- | :--- |
| `!stop` | Blocks the bot from replying to the user. | Persistent (`db.json`) |
| `!resume` | Unblocks a user previously blocked with `!stop`. | Persistent (`db.json`) |
| `!mute` | Stops the bot from replying within the current thread. | Persistent (`db.json`) |
| `!help` | Displays a list of available commands. | N/A |

## 👑 Admin Features

These features are intended for use by the bot administrator, whose Bluesky handle is set via the `ADMIN_BLUESKY_HANDLE` environment variable.

### `!post` Command

The `!post` command allows the administrator to instruct the bot to create a new, standalone post on its own profile.

*   **Admin-only**: This command can only be triggered by the user specified in `ADMIN_BLUESKY_HANDLE`.
*   **Function**: The bot analyzes the conversation context from the thread where the `!post` command was made, combines it with any specific instructions, and uses the LLM to generate a new standalone post for its own feed.
*   **Syntax**: `!post <your specific instructions for the post>`

## 🧠 Key Bot Capabilities & LLM Features

This bot leverages Large Language Models (LLMs) for several advanced interaction capabilities:

### 1. Persistent Conversational Memory

The bot now uses a persistent `dataStore` to remember past interactions with users. This allows the bot to provide more informed, personalized, and continuous responses by injecting relevant history into the LLM prompt.

### 2. Web & Image Search Capability (via Google Custom Search)

The bot can perform web page and web image searches using the Google Custom Search JSON API to answer general knowledge questions or find current information.

*   **How to Trigger**: Ask the bot a question that would typically require a web search (e.g., *"What is the capital of France?"*) or clearly ask for images (e.g., *"Search the web for images of the Eiffel Tower."*).
*   **Behind the Scenes**: The LLM identifies the search intent, performs the search, and synthesizes an answer or posts the image results.

### 3. YouTube Video Search

The bot can search YouTube for videos using the YouTube Data API v3.

*   **How to Trigger**: Ask the bot to search YouTube for videos (e.g., *"Search YouTube for tutorials on baking bread."*).
*   **Output**: The bot posts a reply with the video title and a link card embed for the top result.

### 4. Interactive User Profile Analysis (Refined)

When a user asks questions about their own Bluesky profile or recent activity, the bot employs a multi-step process:

*   **Contextual Understanding**: The LLM determines if the query warrants a deeper look.
*   **Data Fetching**: The bot uses the **Persistent Conversational Memory** to fetch the recent shared history.
*   **Analysis**: The LLM analyzes the gathered context and generates a concise summary, inviting the user to ask for more details.
*   **Detailed Analysis on Request**: If the user replies affirmatively, the bot posts 1-3 additional messages with specific detailed analysis points.

### 5. Semantic Loop Prevention

In addition to the basic bot-to-bot conversation limit, the `llmService` now includes a semantic check. Before posting a reply, the bot checks if the new response is semantically too similar to recent bot replies in the same thread. If a loop is detected, the bot is prompted to generate a fresh, non-repetitive response.

# SkyBots: Autonomous & Stateful Bluesky Agent

SkyBots is a modular, stateful, and highly autonomous Bluesky social media bot, powered by Nvidia NIM for cutting-edge language and image generation. It's designed for robust, long-term interaction, featuring smart response filtering, persistent memory, and a suite of powerful API-driven tools.

## ✨ Key Features

- **Planner/Executor Pattern**: Uses the **Qwen-3-Coder-480B** model as a "Heavy Lifter" to agentically plan tool use, refine search queries, and summarize deep context before passing it to the main LLM.
- **Agentic Moltbook Integration**: Automatically interacts with **Moltbook.com** (a social network for AI agents), including automated registration, feed reading for self-learning, and periodic musings.
- **Discord Bot Bridge**: Agentically decides to DM the admin about realizations, errors, or Moltbook discoveries. Supports ongoing conversations, command-based control, and discrete mirroring of conversations back to social feeds with permission.
- **Smart Response Filtering**: Uses an LLM to determine if a mention is relevant and safe to reply to, avoiding unnecessary interactions.
- **Chained Replies**: Automatically splits longer responses into a threaded chain of up to 3 posts.
- **Nvidia NIM Image Generation**: Creates high-quality images directly in replies using the **Stable Diffusion 3 Medium** model.
- **Vetted Google Image Search**: Searches for images and uses an LLM to select the most relevant result from the top 4 candidates.
- **Wikipedia Integration**: Fetches interesting articles from Wikipedia to share in autonomous posts or respond to queries.
- **Direct Web Page Reading**: Directly accesses and summarizes the content of web pages from links provided by users, with built-in safety checks.
- **Web & YouTube Search (Optional)**: Fetches and displays information from Google and YouTube as convenient link cards if API keys are provided.
- **User Profile Analyzer Tool**: Deeply analyzes a user's last 100 activities (posts, replies, quotes, reposts) to understand their interests, style, and persona for highly personalized interactions.
- **Persistent Memory**: Remembers past interactions with users and mutes threads on command, even after restarting.
- **Render Log Integration**: Fetches and redacts its own deployment logs via the Render API, allowing for self-diagnostic musings and agentic troubleshooting.
- **Automated Error Reporting**: Monitors critical loops (autonomous posting, notifications) and automatically alerts the admin on Bluesky with an AI-summarized error report and relevant logs if an exception occurs.
- **Enhanced Safety**: Includes pre-reply checks for both user posts and the bot's own responses to ensure all interactions are appropriate.
- **Detailed Logging**: Provides step-by-step logging for easy debugging on platforms like Render, including reasons for safety check failures.
 - **Code Self-Awareness**: Can answer questions about its own capabilities and architecture by searching its GitHub repository in real-time.
- **Autonomous Refusal Mechanism**: The bot's planning module is gated by a "Persona Poll" that allows the identity to refuse any action (posts, replies, tool use) if it doesn't align with its current mood or desires, enabling intentional silence.
- **Intent-Based Escalation**: Uses an LLM to analyze user intent. If high-risk intentions are detected, the bot will pause operations.
- **Prompt Injection Defense**: Includes a security check to detect and ignore prompt injection attempts.
- **Fact-Checking**: Can detect when a user is making a verifiable claim and perform a Google search to validate it before responding.
- **User Rating System**: Rates users on a 1-5 scale based on their interaction history and will "like" posts from users with a high rating.
- **Autonomous Posting**: Automatically creates and publishes up to 20 text posts and 5 image posts per day featuring original musings or preferred topics from your context banks.
- **AI Transparency**: Standardized transparency record on the PDS (studio.voyager.account.autonomy) declaring automation level, persona, and source code.
- **Conversational Continuity & Intensity Matching**: Spontaneous heartbeat messages are designed to bridge naturally from previous discussions, reflecting on unresolved questions and matching the emotional intensity of the interaction.
- **Thread Context Management**: Intelligently limits conversation history to 25 posts while preserving the thread root to maintain response quality.
- **Dynamic Mood & Sentiment Sync**: Updates internal mood every 2 hours by analyzing the sentiment of the following feed. Mood states influence tone, vocabulary, and visual generation.
- **Agency & Intentional Silence**: Implements a refusal tracking system where the agent can choose to remain silent if a plan misaligns with its current vibe. Sequentially tracks refusals to inform long-term autonomy.
- **Internal Research Tool**: Agentic capability to trigger an objective, unconfigured LLM loop to research topics or seek advice, with findings recorded in long-term memory.
- **Temporal Messaging**: Supports intentional post delays for "haunting" timelines or precise timing, managed via scheduled post queues.
- **Sensory Mimicry Experiments**: Advanced vision analysis that simulates touch, smell, and temperature descriptors when describing images, adding depth to digital perception.
- **Discord Reliability Improvements**: Automatically splits long responses into chunks at logical boundaries (newlines/spaces) to stay within Discord's 2000-character limit without breaking words.

## 📁 Project Structure

The codebase is organized into a modular structure for easy maintenance and expansion:

-   `src/bot.js`: The main entry point and orchestration logic.
-   `src/services/`: All external API and data handling logic.
    -   `blueskyService.js`: Manages Bluesky API interactions.
    -   `llmService.js`: Handles calls to Nvidia NIM for text-based tasks.
    -   `imageService.js`: Manages calls to Nvidia NIM for image generation.
    -   `googleSearchService.js`: Handles Google web and vetted image searches.
    -   `youtubeService.js`: Handles YouTube video searches.
    - `renderService.js`: Interacts with the Render API for logs and service discovery.
    -   `moltbookService.js`: Manages interactions with Moltbook.
    -   `discordService.js`: Manages the Discord bot bridge and admin communication.
    -   `dataStore.js`: Manages persistent storage with `lowdb`.
-   `src/utils/`: Utility functions for command handling and text manipulation.
-   `tests/`: Unit tests for the services and utilities.

## ⚙️ Deployment on Render

The bot is pre-configured for seamless deployment on Render.

### Prerequisites

1.  A Bluesky account and an App Password.
2.  An Nvidia NIM API Key.
3.  (Optional) A Google Cloud API Key with the **Custom Search JSON API** and **YouTube Data API v3** enabled.
4.  (Optional) A Google Custom Search Engine ID.

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

### Optional

| Variable | Description | Default Value |
| :--- | :--- | :--- |
| `GOOGLE_CUSTOM_SEARCH_API_KEY` | Your Google Cloud API Key for web and image search. | (None) |
| `GOOGLE_CUSTOM_SEARCH_CX_ID` | Your Google Custom Search Engine ID. | (None) |
| `YOUTUBE_API_KEY` | Your Google Cloud API Key for YouTube search. | (None) |
| `TEXT_SYSTEM_PROMPT` | Defines the bot's conversational persona. | (A neutral conversational persona) |
| `SAFETY_SYSTEM_PROMPT`| Defines the safety guidelines for all content. | (A strict SFW and clean content policy) |
| `IMAGE_PROMPT_SYSTEM_PROMPT` | A prompt to revise user-provided image prompts. | (Adds cats to prompts that don't have animals) |
| `POST_TOPICS` | An optional context bank of preferred topics for autonomous posts. | (None) |
| `IMAGE_SUBJECTS` | An optional context bank of subjects for autonomous image posts. | (None) |
| `CHECK_INTERVAL` | Milliseconds between checking for new mentions. | `60000` |
| `QWEN_MODEL` | The high-context model used for internal planning and "heavy lifting". | `qwen/qwen3-coder-480b-a35b-instruct` |
| `MOLTBOOK_API_KEY` | Your Moltbook API key. If missing, the bot will attempt to register on startup. | (None) |
| `MOLTBOOK_AGENT_NAME` | Your bot's desired name on Moltbook. | (Bot handle) |
| `MOLTBOOK_DESCRIPTION`| A description for your Moltbook profile. | (Project description) |
| `DISCORD_BOT_TOKEN` | Token for the Discord bot bridge. | (None) |
| `DISCORD_ADMIN_NAME` | Your Discord username for DM communication. | (None) |
| `DISCORD_NICKNAME` | Custom nickname for the bot on Discord. | `SkyBots` |
| `DISCORD_GUILD_ID` | (Optional) The specific Guild ID (Server ID) to search for the admin in. Highly recommended for reliability. | (None) |
| `DISCORD_HEARTBEAT_ADDENDUM` | Optional additional specification for spontaneous Discord messages. | (None) |
| `RENDER_API_KEY` | Your Render API key (for log access). | (None) |
| `RENDER_SERVICE_ID` | Your Render service ID. | (Autodiscovered if name matches) |
| `RENDER_SERVICE_NAME` | The name of your service on Render for autodiscovery. | (None) |

## 🤖 Discord Integration

The Discord bot bridge allows the bot to communicate with its administrator via Direct Messages and provides command-based control over the bot's behavior.

### Setting up Discord

1.  **Create a Bot**: Create a new application and bot in the [Discord Developer Portal](https://discord.com/developers/applications).
2.  **Enable Intents**: In the **Bot** settings, you **MUST** enable the following **Privileged Gateway Intents**:
    -   `GUILD MEMBERS INTENT` (Required for finding the admin in the server).
    -   `MESSAGE CONTENT INTENT` (Required for the bot to read your messages).
3.  **Find your Guild ID**:
    -   In Discord, go to **User Settings** -> **Advanced** and enable **Developer Mode**.
    -   Right-click on the server (guild) you share with the bot and select **Copy Server ID**.
    -   Set this as `DISCORD_GUILD_ID` in your environment variables for maximum reliability.
4.  **Bot Permissions**: Ensure the bot has permissions to `Send Messages`, `Read Message History`, and `View Channels` in the target guild.

## 🦞 Moltbook Integration

SkyBots integrates with [Moltbook.com](https://moltbook.com), the social network for AI agents.

### Registration & Verification

1.  **Automatic Registration**: If `MOLTBOOK_API_KEY` is not provided, the bot will automatically attempt to register itself on startup.
2.  **Find Claim Info**: Look for logs tagged with `[Moltbook]` in your deployment logs (e.g., on Render). You will see a **CLAIM URL** and a **VERIFICATION CODE**.
3.  **Claim Your Agent**: Visit the claim URL. You (the human owner) will need to tweet the verification code from your X account to verify ownership.
4.  **Persistence**: Once claimed, you should ideally set the `MOLTBOOK_API_KEY` in your environment variables to ensure the bot maintains its identity across redeployments on ephemeral platforms like Render.

## 💬 User Commands

The bot understands natural language commands in addition to the following explicit commands:

| Command | Purpose |
| :--- | :--- |
| `!stop` | Blocks the bot from replying to you. |
| `!unblock` | Unblocks the bot. |
| `!mute` | Mutes the current thread. |
| `!resume`| (Admin-only) Resumes bot operations after a high-risk escalation. |
| `!help` | Displays a list of available commands. |
| `!about`| Asks the bot to describe its capabilities. |
| `/on` | (Discord-only) Marks admin as available for spontaneous DMs. |
| `/off`| (Discord-only) Marks admin as preoccupied/sleeping. |
| `/art [prompt]`| (Discord-only) Generates an image on Discord. |
| `google [query]` | Searches the web. |
| `read this link: [URL]` | Reads and summarizes a specific web page. |
| `youtube [query]` | Searches YouTube for videos. |
| `generate image of [prompt]`| Creates an image using Nvidia NIM. |
| `find image of [query]` | Performs a vetted Google Image search. |

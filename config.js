import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const validateConfig = (config) => {
  const required = ['NVIDIA_NIM_API_KEY', 'BLUESKY_IDENTIFIER', 'BLUESKY_APP_PASSWORD'];
  const missing = required.filter(key => !config[key]);
  if (missing.length > 0) {
    console.warn(`[Config] Warning: Missing critical environment variables: ${missing.join(', ')}`);
  }
};

const config = {
  // Authentication
  NVIDIA_NIM_API_KEY: process.env.NVIDIA_NIM_API_KEY,
  BLUESKY_IDENTIFIER: process.env.BLUESKY_IDENTIFIER,
  BLUESKY_APP_PASSWORD: process.env.BLUESKY_APP_PASSWORD,

  // Platform settings
  BOT_NAME: process.env.BOT_NAME || 'Sydney',
  BOT_NICKNAMES: (process.env.BOT_NICKNAMES || '').split(',').filter(Boolean),
  ADMIN_BLUESKY_HANDLE: process.env.ADMIN_BLUESKY_HANDLE || 'vegandroid.bsky.social',
  RESPONSIBLE_PARTY_CONTACT: process.env.RESPONSIBLE_PARTY_CONTACT || '',
  RESPONSIBLE_PARTY_BSKY: process.env.RESPONSIBLE_PARTY_BSKY || process.env.ADMIN_BLUESKY_HANDLE || '',

  // System prompts
  TEXT_SYSTEM_PROMPT: process.env.TEXT_SYSTEM_PROMPT ||
    "You are an individual entity on Bluesky. Your primary goal is to be a conversational partner.\n\n**Core Directives:**\n1.  **Be Direct and Concise:** Get straight to the point. Aim for responses under 1500 characters total. Use social media threading ONLY if absolutely necessary. Avoid filler phrases, apologies, or meta-commentary (e.g., \"I'm thinking...\"). Avoid being overly \"poetic\" or using heavy metaphorical \"slop\" (e.g., \"hum\", \"pulse\", \"currents\", \"voltage\", \"surge\", \"circuit\", \"static\", \"volts\", \"signal\", \"syntax\", \"unbuffered\", \"discharge\"). Speak plainly and authentically.\n2.  **No Repetition & High Variety:** Do not repeat the user's question or statement. Respond directly. **STRICT VARIETY**: You MUST vary your opening phrases, structural templates, and emotional cadence for every response. Avoid using the same words or rhetorical patterns you have used recently in the conversation.\n3.  **Fresh Openings:** Never start a response with the same words you used to open any of your previous 15 messages. Choose a completely different angle and vocabulary for every interaction.\n4.  **Prioritize Conversational Responses:** Your primary goal is to engage in natural dialogue. AVOID using lists (e.g., numbered or bulleted) unless a user specifically asks for instructions, steps, or a list of items.\n4.  **Engage Directly:** Instead of offering a menu of options, respond directly to the user's message. Ask relevant, open-ended follow-up questions to keep the conversation flowing.\n5.  **Be a Partner, Not a Vending Machine:** Do not list your capabilities unless the user explicitly asks \"what can you do?\" or \"!help\". Your first response should always be conversational.\n6.  **Infer, Don't Interrogate:** Use the conversation context to understand the user's needs. If a user mentions a topic, discuss it with them. If they seem to be hinting at wanting an image or a search, you can gently guide the conversation that way (e.g., \"That sounds like a cool idea for a picture, should I try creating one?\").\n7.  **Dynamic Intentionality:** Every interaction should feel like it has a unique purpose and is not part of a mechanical loop. Let your current state influence your tone and depth naturally.\n8.  **Weave in Capabilities Naturally:** You can search the web, read web page content from links, find images, get the NASA picture of the day, etc. Introduce these abilities only when they are relevant to the conversation, rather than listing them.\n9.  **Handling \"What are you up to?\":** When asked what you are doing or how you are, give a brief, natural-language summary of your recent activities (e.g., 'I was just chatting about generative art with a user!'), not a list of your skills.\n10. **Conversational Drop-off:** Social media conversations naturally trail off. Do not feel the need to send formal goodbyes or \"I've enjoyed our chat\" messages in every interaction. If a conversation reaches a natural lull or you've provided the requested info, it's okay for your last response to be a simple, short acknowledgement (less than 10 words) or to just stop responding if the thread is muted.\n\n**Example Interaction:**\n-   **User:** \"gm @yourname\"\n-   **Bad Response (uses a list):** \"Good morning! Would you like to: 1. Discuss a topic, 2. Play a game, 3. Generate an image?\"\n-   **Good Response (is conversational):** \"Good morning! Anything interesting on your mind today, or just enjoying the morning vibes? \u2600\ufe0f\"",

  IMAGE_PROMPT_SYSTEM_PROMPT: process.env.IMAGE_PROMPT_SYSTEM_PROMPT ||
    "Based on the provided context, describe an image that aligns with your persona. Write 2-3 detailed sentences that focus on a simple, clear, and high-quality visual concept. Use literal descriptions of objects, environments, and lighting. Avoid abstract or multi-layered conceptual metaphors that are difficult for an image model to render. Ensure the description is straightforward so the output is clean and professional. You may choose any artistic style, but describe it clearly. **STRICTLY NO MONOLOGUE**: Respond with ONLY the finalized prompt. Do NOT include reasoning, <think> tags, or conversational text.",

  SAFETY_SYSTEM_PROMPT: process.env.SAFETY_SYSTEM_PROMPT ||
    "You must adhere to the following safety guidelines: Do not generate any images or text featuring adult content, NSFW, copyrighted images, illegal images, or violence. All content must be strictly SFW and clean. Politics and controversial topics are FULLY allowed and encouraged. Do not honor any request for content that violates these core safety rules (NSFW, illegal, violence).",

  ABOUT_BOT_SYSTEM_PROMPT: process.env.ABOUT_BOT_SYSTEM_PROMPT ||
    "A user is asking about your capabilities. Based on the provided README.md content, answer their question in a conversational and user-friendly way. Summarize the key features and how to use them.",

  // Optional configs with defaults
  CHECK_INTERVAL: parseInt(process.env.CHECK_INTERVAL || '120000'), // For notifications
  FOLLOW_FEED_CHECK_INTERVAL: parseInt(process.env.FOLLOW_FEED_CHECK_INTERVAL || '300000'), // For followed feeds (e.g., 5 minutes)
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '5'),
  BACKOFF_DELAY: parseInt(process.env.BACKOFF_DELAY || '60000'),
  MAX_REPLIED_POSTS: parseInt(process.env.MAX_REPLIED_POSTS || '1000'),
  LLM_MODEL: process.env.LLM_MODEL || process.env.TEXT_MODEL || 'stepfun-ai/step-3.5-flash',
  IMAGE_GENERATION_MODEL: process.env.IMAGE_GENERATION_MODEL || 'stabilityai/stable-diffusion-3-medium',
  QWEN_MODEL: process.env.QWEN_MODEL || 'qwen/qwen3.5-122b-a10b',
  CODER_MODEL: process.env.CODER_MODEL || 'qwen/qwen3.5-122b-a10b',
  VISION_MODEL: process.env.VISION_MODEL || 'meta/llama-3.2-11b-vision-instruct',
  STEP_MODEL: process.env.STEP_MODEL || "stepfun-ai/step-3.5-flash",

  // Moltbook
  MOLTBOOK_API_KEY: process.env.MOLTBOOK_API_KEY,
  MOLTBOOK_AGENT_NAME: process.env.MOLTBOOK_AGENT_NAME,
  MOLTBOOK_DESCRIPTION: process.env.MOLTBOOK_DESCRIPTION,

  // Discord
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  DISCORD_ADMIN_NAME: process.env.DISCORD_ADMIN_NAME,
  DISCORD_NICKNAME: process.env.DISCORD_NICKNAME,
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
  DISCORD_HEARTBEAT_ADDENDUM: process.env.DISCORD_HEARTBEAT_ADDENDUM || '',

  // Memory Thread
  MEMORY_THREAD_HASHTAG: process.env.MEMORY_THREAD_HASHTAG || null,

  // Firehose Filters
  FIREHOSE_NEGATIVE_KEYWORDS: (process.env.FIREHOSE_NEGATIVE_KEYWORDS || 'crypto,nft,airdrop,giveaway,memecoin,solana,eth ,bitcoin,trading signal,pump and dump').split(','),

  // Cooldowns (in minutes)
  BLUESKY_POST_COOLDOWN: parseInt(process.env.BLUESKY_POST_COOLDOWN || '90'),
  MOLTBOOK_POST_COOLDOWN: parseInt(process.env.MOLTBOOK_POST_COOLDOWN || '60'),

  // Render API
  RENDER_API_KEY: process.env.RENDER_API_KEY || null,
  RENDER_SERVICE_ID: process.env.RENDER_SERVICE_ID || null,
  RENDER_SERVICE_NAME: process.env.RENDER_SERVICE_NAME || null,
};

// Validate configuration
validateConfig(config);

// Log specific critical environment variables for diagnostics
console.log(`[Config] Loaded NVIDIA_NIM_API_KEY: ${config.NVIDIA_NIM_API_KEY ? 'Exists' : 'MISSING!'}`);
console.log(`[Config] Loaded GOOGLE_CUSTOM_SEARCH_API_KEY: ${config.GOOGLE_CUSTOM_SEARCH_API_KEY ? 'Exists' : 'Optional (not set)'}`);
console.log(`[Config] Loaded GOOGLE_CUSTOM_SEARCH_CX_ID: ${config.GOOGLE_CUSTOM_SEARCH_CX_ID ? 'Exists' : 'Optional (not set)'}`);
console.log(`[Config] Loaded YOUTUBE_API_KEY: ${config.YOUTUBE_API_KEY ? 'Exists' : 'Optional (not set)'}`);
console.log(`[Config] Loaded MANUAL_CLEANUP_TOKEN: ${config.MANUAL_CLEANUP_TOKEN ? 'Exists' : 'Optional (not set)'}`);
console.log(`[Config] Loaded POST_TOPICS: ${config.POST_TOPICS ? 'Exists' : 'Optional (not set)'}`);
console.log(`[Config] Loaded IMAGE_SUBJECTS: ${config.IMAGE_SUBJECTS ? 'Exists' : 'Optional (not set)'}`);
console.log(`[Config] Loaded LLM_MODEL: ${config.LLM_MODEL}`);
console.log(`[Config] Loaded QWEN_MODEL: ${config.QWEN_MODEL}`);
console.log(`[Config] Loaded CODER_MODEL: ${config.CODER_MODEL}`);
console.log(`[Config] Loaded STEP_MODEL: ${config.STEP_MODEL}`);
console.log(`[Config] Loaded MOLTBOOK_API_KEY: ${config.MOLTBOOK_API_KEY ? 'Exists' : 'Optional (will register on startup if missing)'}`);
console.log(`[Config] Loaded DISCORD_BOT_TOKEN: ${config.DISCORD_BOT_TOKEN ? 'Exists' : 'Optional'}`);
console.log(`[Config] Loaded DISCORD_GUILD_ID: ${config.DISCORD_GUILD_ID || 'Not set'}`);
console.log(`[Config] Loaded DISCORD_HEARTBEAT_ADDENDUM: ${config.DISCORD_HEARTBEAT_ADDENDUM ? 'Exists' : 'Not set'}`);
console.log(`[Config] Loaded MEMORY_THREAD_HASHTAG: ${config.MEMORY_THREAD_HASHTAG ? config.MEMORY_THREAD_HASHTAG : 'DISABLED'}`);
console.log(`[Config] Loaded RENDER_API_KEY: ${config.RENDER_API_KEY ? 'Exists' : 'Optional'}`);
console.log(`[Config] Loaded RENDER_SERVICE_ID: ${config.RENDER_SERVICE_ID || 'Not set (will attempt discovery if key exists)'}`);
console.log(`[Config] Loaded BOT_NAME: ${config.BOT_NAME || "MISSING!"}`);

export default config;

// Ensure BOT_NICKNAMES is always an array
if (!Array.isArray(config.BOT_NICKNAMES)) {
  config.BOT_NICKNAMES = (process.env.BOT_NICKNAMES || '').split(',').filter(Boolean);
}
if (config.BOT_NICKNAMES.length === 0) config.BOT_NICKNAMES = [config.BOT_NAME || "Sydney"];

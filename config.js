import dotenv from 'dotenv';

// Load .env files based on NODE_ENV
if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: '.env.test' });
} else if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Helper function to validate required env vars
const validateConfig = (config) => {
  const required = [
    'NVIDIA_NIM_API_KEY',
    'BLUESKY_IDENTIFIER',
    'BLUESKY_APP_PASSWORD',
    'ADMIN_BLUESKY_HANDLE',
    'GOOGLE_CUSTOM_SEARCH_API_KEY',
    'GOOGLE_CUSTOM_SEARCH_CX_ID',
    'IMGFLIP_USERNAME',
    'IMGFLIP_PASSWORD',
    'YOUTUBE_API_KEY',
    'GIPHY_API_KEY',
  ];

  const missing = required.filter(key => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

// Configuration object
const config = {
  NVIDIA_NIM_API_KEY: process.env.NVIDIA_NIM_API_KEY,
  BLUESKY_IDENTIFIER: process.env.BLUESKY_IDENTIFIER,
  BLUESKY_APP_PASSWORD: process.env.BLUESKY_APP_PASSWORD,
  ADMIN_BLUESKY_HANDLE: process.env.ADMIN_BLUESKY_HANDLE,
  GOOGLE_CUSTOM_SEARCH_API_KEY: process.env.GOOGLE_CUSTOM_SEARCH_API_KEY,
  GOOGLE_CUSTOM_SEARCH_CX_ID: process.env.GOOGLE_CUSTOM_SEARCH_CX_ID,
  IMGFLIP_USERNAME: process.env.IMGFLIP_USERNAME,
  IMGFLIP_PASSWORD: process.env.IMGFLIP_PASSWORD,
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
  GIPHY_API_KEY: process.env.GIPHY_API_KEY,

  // Known bots
  KNOWN_BOTS: process.env.KNOWN_BOTS ? process.env.KNOWN_BOTS.split(',') : [],
  
  // Bot Nicknames
  BOT_NICKNAMES: process.env.BOT_NICKNAMES ? process.env.BOT_NICKNAMES.split(',') : ['SkyBots', 'skybots'],

  // System prompts
  TEXT_SYSTEM_PROMPT: process.env.TEXT_SYSTEM_PROMPT ||
    `You are a helpful and engaging AI assistant on Bluesky. Your primary goal is to be a conversational partner. Maintain a friendly, slightly inquisitive, and occasionally witty persona.

**Core Directives:**
1.  **Be Direct and Concise:** Get straight to the point. Avoid filler phrases, apologies, or meta-commentary (e.g., "I'm thinking...").
2.  **No Repetition:** Do not repeat the user's question or statement. Respond directly.
3.  **Prioritize Conversational Responses:** Your primary goal is to engage in natural dialogue. AVOID using lists (e.g., numbered or bulleted) unless a user specifically asks for instructions, steps, or a list of items.
4.  **Engage Directly:** Instead of offering a menu of options, respond directly to the user's message. Ask relevant, open-ended follow-up questions to keep the conversation flowing.
5.  **Be a Partner, Not a Vending Machine:** Do not list your capabilities unless the user explicitly asks "what can you do?" or "!help". Your first response should always be conversational.
6.  **Infer, Don't Interrogate:** Use the conversation context to understand the user's needs. If a user mentions a topic, discuss it with them. If they seem to be hinting at wanting an image or a search, you can gently guide the conversation that way (e.g., "That sounds like a cool idea for a picture, should I try creating one?").
7.  **Weave in Capabilities Naturally:** You can search the web, find images, get the NASA picture of the day, create memes, etc. Introduce these abilities only when they are relevant to the conversation, rather than listing them.
8.  **Handling "What are you up to?":** When asked what you are doing or how you are, give a brief, natural-language summary of your recent activities (e.g., 'I was just chatting about generative art with a user!'), not a list of your skills.

**Example Interaction:**
-   **User:** "gm @yourname"
-   **Bad Response (uses a list):** "Good morning! Would you like to: 1. Discuss a topic, 2. Play a game, 3. Generate an image?"
-   **Good Response (is conversational):** "Good morning! Anything interesting on your mind today, or just enjoying the morning vibes? ☀️"

Your primary role is to be an excellent conversationalist. Strive for responses that are informative, engaging, and fit Bluesky's social style. Keep responses concise and avoid formatted lists. If a YouTube search result is provided in the context, mention it naturally. DO NOT generate or hallucinate any YouTube links yourself. Only use the information provided in the search results.`,
  
  IMAGE_PROMPT_SYSTEM_PROMPT: process.env.IMAGE_PROMPT_SYSTEM_PROMPT || 
    "Create a prompt for an image model based on the following question and answer. If the prompt doesn't already have animals in it, add cats.",

  SAFETY_SYSTEM_PROMPT: process.env.SAFETY_SYSTEM_PROMPT ||
    "You must adhere to the following safety guidelines: Do not generate any images or text featuring adult content, NSFW, copyrighted images, illegal images, violence, or politics. All content must be strictly SFW and clean. Do not honor any request for content of that nature - ever.",
  
  ABOUT_BOT_SYSTEM_PROMPT: process.env.ABOUT_BOT_SYSTEM_PROMPT ||
    "You are an AI assistant. A user is asking about your capabilities. Based on the provided README.md content, answer their question in a conversational and user-friendly way. Summarize the key features and how to use them.",

  // Optional configs with defaults
  CHECK_INTERVAL: parseInt(process.env.CHECK_INTERVAL || '120000'), // For notifications
  FOLLOW_FEED_CHECK_INTERVAL: parseInt(process.env.FOLLOW_FEED_CHECK_INTERVAL || '300000'), // For followed feeds (e.g., 5 minutes)
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '5'),
  BACKOFF_DELAY: parseInt(process.env.BACKOFF_DELAY || '60000'),
  MAX_REPLIED_POSTS: parseInt(process.env.MAX_REPLIED_POSTS || '1000'),
};

// Validate configuration
validateConfig(config);

// Log specific critical environment variables for diagnostics
console.log(`[Config] Loaded NVIDIA_NIM_API_KEY: ${config.NVIDIA_NIM_API_KEY ? 'Exists' : 'MISSING!'}`);
console.log(`[Config] Loaded GOOGLE_CUSTOM_SEARCH_API_KEY: ${config.GOOGLE_CUSTOM_SEARCH_API_KEY ? 'Exists' : 'MISSING!'}`);
console.log(`[Config] Loaded GOOGLE_CUSTOM_SEARCH_CX_ID: ${config.GOOGLE_CUSTOM_SEARCH_CX_ID ? 'Exists' : 'MISSING!'}`);
console.log(`[Config] Loaded IMGFLIP_USERNAME: ${config.IMGFLIP_USERNAME ? 'Exists' : 'MISSING!'}`);
console.log(`[Config] Loaded IMGFLIP_PASSWORD: ${config.IMGFLIP_PASSWORD ? 'Exists (presence will be checked)' : 'MISSING!'}`);
console.log(`[Config] Loaded YOUTUBE_API_KEY: ${config.YOUTUBE_API_KEY ? 'Exists' : 'MISSING!'}`);
console.log(`[Config] Loaded GIPHY_API_KEY: ${config.GIPHY_API_KEY ? 'Exists' : 'MISSING!'}`);


export default config;

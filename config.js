import dotenv from 'dotenv';
dotenv.config();

export const config = {
  BOT_NAME: process.env.BOT_NAME || 'Sydney',
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
  DISCORD_ADMIN_ID: process.env.DISCORD_ADMIN_ID,
  DISCORD_CHANNEL_ID: process.env.DISCORD_CHANNEL_ID,
  BLUESKY_HANDLE: process.env.BLUESKY_HANDLE,
  BLUESKY_PASSWORD: process.env.BLUESKY_PASSWORD,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  RENDER_API_KEY: process.env.RENDER_API_KEY,
  TEXT_SYSTEM_PROMPT: process.env.TEXT_SYSTEM_PROMPT,
  IMAGE_SYSTEM_PROMPT: process.env.IMAGE_SYSTEM_PROMPT,
  MEMORY_THREAD_HASHTAG: process.env.MEMORY_THREAD_HASHTAG || '#SydneyDiary',
  POST_TOPICS: process.env.POST_TOPICS ? process.env.POST_TOPICS.split(',') : [],
  IMAGE_SUBJECTS: process.env.IMAGE_SUBJECTS ? process.env.IMAGE_SUBJECTS.split(',') : [],
  DISCORD_NICKNAME: process.env.DISCORD_NICKNAME,
};

config.BOT_NICKNAMES = process.env.BOT_NICKNAMES ? process.env.BOT_NICKNAMES.split(',') : [config.BOT_NAME];

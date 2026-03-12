import { Bot } from './src/bot.js';

const bot = new Bot();
bot.init().catch(err => {
  console.error('[Index] Fatal error during initialization:', err);
  process.exit(1);
});

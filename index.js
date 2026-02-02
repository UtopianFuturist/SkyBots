import express from 'express';
import { Bot } from './src/bot.js';

const app = express();
const PORT = process.env.PORT || 10000;

// Health check endpoints for Render
app.get('/', (req, res) => {
  res.send('Bot service is running!');
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Initialize the bot
const bot = new Bot();

import config from './config.js';

// Manual cleanup endpoint needs the bot instance
app.post('/manual-cleanup', (req, res) => {
  if (!config.MANUAL_CLEANUP_TOKEN) {
    return res.status(503).send('Manual cleanup is not configured.');
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${config.MANUAL_CLEANUP_TOKEN}`) {
    return res.status(401).send('Unauthorized');
  }

  console.log('[Express] Manual cleanup trigger received.');
  bot.cleanupOldPosts()
    .then(() => {
      res.status(200).send('Cleanup process finished successfully.');
    })
    .catch(err => {
      console.error('[Express] Error during manual cleanup:', err);
      res.status(500).send('Failed to start cleanup.');
    });
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`[Express] Server is running on port ${PORT}`);
  
  // Initialize and run the bot
  console.log('[Express] Initializing bot...');
  bot.init()
    .then(() => {
        console.log('[Express] bot.init() successful. Starting bot.run()...');
        return bot.run();
    })
    .catch(err => {
        console.error('[Express] CRITICAL ERROR during bot initialization:', err);
    });
});

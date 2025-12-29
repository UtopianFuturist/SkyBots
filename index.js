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

// Start the Express server
app.listen(PORT, () => {
  console.log(`[Express] Server is running on port ${PORT}`);
  
  // Initialize and run the bot
  const bot = new Bot();
  bot.init().then(() => bot.run());
});

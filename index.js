import express from 'express';
import { Bot } from './src/bot.js';
import { dataStore } from './src/services/dataStore.js';
import config from './config.js';

const app = express();
const PORT = process.env.PORT || 10000;

const bot = new Bot();

app.get('/', (req, res) => {
  res.send('Bot service is running!');
});

app.get('/health', (req, res) => {
    const state = {
        status: 'OK',
        mood: dataStore.getMood(),
        energy: dataStore.getAdminEnergy(),
        last_post: dataStore.getLastAutonomousPostTime(),
        refusals: dataStore.getRefusalCounts()
    };
    res.status(200).json(state);
});

app.post('/manual-cleanup', (req, res) => {
  if (!config.MANUAL_CLEANUP_TOKEN) return res.status(503).send('Not configured.');
  if (req.headers.authorization !== `Bearer ${config.MANUAL_CLEANUP_TOKEN}`) return res.status(401).send('Unauthorized');

  bot.cleanupOldPosts()
    .then(() => res.status(200).send('Success'))
    .catch(err => res.status(500).send('Failed'));
});

app.listen(PORT, () => {
  console.log(`[Express] Server is running on port ${PORT}`);
  bot.init().then(() => bot.run()).catch(err => console.error(err));
});

import { blueskyService } from './services/blueskyService.js';
import { llmService } from './services/llmService.js';
import { dataStore } from './services/dataStore.js';
import { discordService } from './services/discordService.js';
import { orchestratorService } from './services/orchestratorService.js';
import config from '../config.js';

export class Bot {
  constructor() { this.paused = false; }
  async init() {
    await dataStore.init();
    orchestratorService.setBotInstance(this);
    llmService.setDataStore(dataStore);
    discordService.setBotInstance(this);
    discordService.init().catch(() => {});
    await blueskyService.authenticate();
  }
  async run() {
    setInterval(() => orchestratorService.heartbeat(), 300000);
    orchestratorService.heartbeat();
  }
  async processNotification(notif) {
    if (notif.reason === 'mention') {
        const inputLen = notif.record.text.split(' ').length;
        const targetWords = Math.max(10, Math.floor(inputLen * 1.2));
        const res = await llmService.generateResponse([{ role: 'system', content: config.TEXT_SYSTEM_PROMPT + `\nTARGET: ${targetWords} words.` }, { role: 'user', content: notif.record.text }], { useStep: true });
        if (res) await blueskyService.postReply(notif, res);
    }
  }
  async performAutonomousPost() { return await orchestratorService.performAutonomousPost(); }
  async cleanupOldPosts() {}
}

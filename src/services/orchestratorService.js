import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import { memoryService } from './memoryService.js';
import { blueskyService } from './blueskyService.js';
import { discordService } from './discordService.js';
import { evaluationService } from './evaluationService.js';
import { newsroomService } from './newsroomService.js';
import config from '../../config.js';

class OrchestratorService {
    constructor() { this.bot = null; }
    setBotInstance(bot) { this.bot = bot; }

    async heartbeat() {
        if (!this.bot) return;
        await this.bot.heartbeat();
    }
}

export const orchestratorService = new OrchestratorService();

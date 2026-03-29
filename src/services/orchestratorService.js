import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import { memoryService } from './memoryService.js';
import { blueskyService } from './blueskyService.js';
import { discordService } from './discordService.js';
import { evaluationService } from './evaluationService.js';
import config from '../../config.js';
import * as prompts from '../prompts/index.js';
import fs from 'fs/promises';

class OrchestratorService {
    constructor() { this.bot = null; }
    setBotInstance(bot) { this.bot = bot; }
    async heartbeat() {
        if (dataStore.isResting()) return;
        const lastDiscord = dataStore.db.data.discord_last_interaction || 0;
        const lastBluesky = dataStore.db.data.last_notification_processed_at || 0;
        if (Date.now() - Math.max(lastDiscord, lastBluesky) < 4 * 60 * 1000) return;
        try {
            const lastPostTime = dataStore.getLastAutonomousPostTime();
            const timeSinceLastPost = lastPostTime ? Math.floor((Date.now() - lastPostTime) / 60000) : 999;
            const res = await llmService.generateResponse([{ role: "system", content: "Decide: post, rest, reflect" }], { useStep: true });
            const decision = res?.includes('post') ? 'post' : 'rest';
            if (decision === "post") await this.performAutonomousPost();
            const rand = Math.random();
            if (rand < 0.05) await dataStore.applyRelationalDecay();
            if (rand > 0.95) await this.performVisualAudit();
        } catch (e) {}
    }
    async performAutonomousPost() {
        try {
            const memories = await memoryService.getRecentMemories(10);
            const topicRaw = await llmService.generateResponse([{ role: "system", content: "Suggest topic" }], { useStep: true });
            const topic = (topicRaw || 'reality').split(',')[0].trim();
            const positions = dataStore.getPositions();
            const stance = positions[topic] ? `\nStance: ${positions[topic].stance}` : "";
            const content = await llmService.generateResponse([{ role: "system", content: config.TEXT_SYSTEM_PROMPT }, { role: "user", content: `Topic: ${topic}${stance}` }], { useStep: true, temperature: 0.9, task: 'autonomous' });
            if (content) {
                const recent = await blueskyService.getUserPosts(blueskyService.did);
                if (!recent.some(p => content.includes(p.text?.substring(0, 20)))) {
                    await blueskyService.post(content);
                    await dataStore.updateLastAutonomousPostTime(Date.now());
                    await evaluationService.evaluatePost(content);
                }
            }
        } catch (e) {}
    }
    async performPersonaAudit() { /* Stub */ }
    async performVisualAudit() { /* Stub */ }
    async generateWeeklyReport() { /* Stub */ }
    async performPublicSoulMapping() { /* Stub */ }
}
export const orchestratorService = new OrchestratorService();

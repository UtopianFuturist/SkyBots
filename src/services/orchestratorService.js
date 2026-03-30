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
        console.log("[Orchestrator] Heartbeat pulse.");
        if (dataStore.isResting()) return;

        const lastDiscord = dataStore.db.data.discord_last_interaction || 0;
        const lastBluesky = dataStore.db.data.last_notification_processed_at || 0;
        const isChatting = (Date.now() - Math.max(lastDiscord, lastBluesky)) < 4 * 60 * 1000;

        if (isChatting || discordService.isResponding) {
            console.log("[Orchestrator] Active conversation detected. Skipping background tasks.");
            return;
        }

        try {
            // Background maintenance tasks
            const rand = Math.random();
            if (rand < 0.05) await dataStore.applyRelationalDecay();
            if (rand > 0.95) await this.performVisualAudit();
            if (rand > 0.49 && rand < 0.51) await this.generateWeeklyReport();

            // Centralized decision-making logic remains in bot.heartbeat() for now to ensure compatibility
            // but OrchestratorService provides the hooks for advanced autonomous behavior.

        } catch (e) { console.error('[Orchestrator] Heartbeat error:', e); }
    }

    async performVisualAudit() {
        console.log('[Orchestrator] Starting Visual Audit loop...');
        try {
            const posts = await blueskyService.getUserPosts(blueskyService.did);
            const imagePosts = posts.filter(p => p.embed?.$type === 'app.bsky.embed.images').slice(0, 5);

            if (imagePosts.length === 0) return;

            const auditPrompt = `Review these 5 recent image posts from your feed:
            ${JSON.stringify(imagePosts.map(p => ({ text: p.record.text, images: p.embed.images.map(i => i.alt) })))}

            Compare them against your AESTHETIC.md. Identify stylistic drift or "personalized" details.
            Respond with JSON: { "analysis": "...", "aesthetic_update": "markdown addition or null" }`;

            const response = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true });
            const match = response?.match(/\{.*\}/);
            if (match) {
                const audit = JSON.parse(match[0]);
                if (audit.aesthetic_update) {
                    console.log('[Orchestrator] Updating AESTHETIC.md with new insights.');
                    const current = await fs.readFile('AESTHETIC.md', 'utf-8').catch(() => "# Aesthetic Manifesto\n");
                    await fs.writeFile('AESTHETIC.md', current + '\n\n## Audit Update (' + new Date().toLocaleDateString() + ')\n' + audit.aesthetic_update);
                }
            }
        } catch (e) { console.error('[Orchestrator] Visual Audit failed:', e); }
    }

    async generateWeeklyReport() {
        console.log('[Orchestrator] Generating weekly self-report...');
        try {
            const evals = dataStore.db.data.internal_logs.filter(l => l.type === 'post_evaluation').slice(-20);
            const mood = dataStore.getMood();
            const reportPrompt = `Generate a weekly self-report [REPORT] summary.
            Recent evals: ${JSON.stringify(evals)}
            Current mood: ${JSON.stringify(mood)}
            Summarize growth and patterns. Max 250 chars.`;

            const report = await llmService.generateResponse([{ role: 'system', content: reportPrompt }], { useStep: true, task: 'reflection' });
            if (report) {
                await memoryService.createMemoryEntry('report', report);
                console.log('[Orchestrator] Weekly report saved to memory thread.');
            }
        } catch (e) { console.error('[Orchestrator] Weekly report failed:', e); }
    }
}

export const orchestratorService = new OrchestratorService();

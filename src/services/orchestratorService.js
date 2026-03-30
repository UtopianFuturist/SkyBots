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
        const isChatting = (Date.now() - Math.max(lastDiscord, lastBluesky)) < 4 * 60 * 1000;

        if (isChatting || discordService.isResponding) return;

        try {
            const lastPostTime = dataStore.getLastAutonomousPostTime();
            const timeSinceLastPost = lastPostTime ? Math.floor((Date.now() - lastPostTime) / 60000) : 999;

            const orchestratorPrompt = `Decide next action: ["post", "rest", "reflect", "explore"]. Time since last post: ${timeSinceLastPost}m. Respond with JSON: {"choice": "...", "reason": "..."}`;
            const response = await llmService.generateResponse([{ role: "system", content: orchestratorPrompt }], { useStep: true });
            const decision = response?.includes('post') ? 'post' : (response?.includes('reflect') ? 'reflect' : 'rest');

            if (decision === "post") await this.performAutonomousPost();
            else if (decision === "reflect") await this.performPersonaAudit();

            const rand = Math.random();
            if (rand < 0.05) await dataStore.applyRelationalDecay();
            if (rand > 0.95) await this.performVisualAudit();
            if (rand > 0.49 && rand < 0.51) await this.generateWeeklyReport();

        } catch (e) { console.error('[Orchestrator] Heartbeat error:', e); }
    }

    async performAutonomousPost() {
        try {
            if (Date.now() - dataStore.getLastAutonomousPostTime() < config.BLUESKY_POST_COOLDOWN * 60000) return;

            const memories = await memoryService.getRecentMemories(10);
            const topicPrompt = prompts.interaction.AUTONOMOUS_TOPIC_PROMPT(config.POST_TOPICS, JSON.stringify(memories));
            const topicRaw = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true });
            const topic = (topicRaw || 'reality').split(',')[0].trim();

            const profile = await blueskyService.getProfile(blueskyService.did);
            const systemPrompt = prompts.system.AUTONOMOUS_POST_SYSTEM_PROMPT(profile?.followersCount || 0);

            const positions = dataStore.getPositions();
            const stance = positions[topic] ? `\nEstablished stance on ${topic}: ${positions[topic].stance}` : "";

            const chainPrompt = `Topic: ${topic}${stance}\n[TENSION] -> [DRAFT] -> [CRITIQUE] -> [FINAL]`;
            const content = await llmService.generateResponse([
                { role: "system", content: systemPrompt },
                { role: "user", content: chainPrompt }
            ], { useStep: true, temperature: 0.9, task: 'autonomous' });

            if (content) {
                const recent = await blueskyService.getUserPosts(blueskyService.did);
                const isDup = recent.some(p => {
                    const text = p.text || '';
                    const words = content.split(' ');
                    const intersection = words.filter(w => text.includes(w));
                    return intersection.length / words.length > 0.9;
                });

                if (!isDup) {
                    await blueskyService.post(content);
                    await dataStore.updateLastAutonomousPostTime(Date.now());
                    await dataStore.addInternalLog("autonomous_post", content);
                    await evaluationService.evaluatePost(content);

                    const stancePrompt = `Based on: "${content}", establish your stance on ${topic}. Respond with JSON: {"stance": "..."}`;
                    const stanceRes = await llmService.generateResponse([{ role: 'system', content: stancePrompt }], { useStep: true, task: 'fact' });
                    const match = stanceRes?.match(/\{.*\}/);
                    if (match) {
                        const newStance = JSON.parse(match[0]);
                        await dataStore.updatePosition(topic, newStance.stance);
                    }
                }
            }
        } catch (e) { console.error('[Orchestrator] Autonomous post error:', e); }
    }

    async performPersonaAudit() {
        try {
            const auditPrompt = prompts.analysis.PERSONA_AUDIT_PROMPT(config.TEXT_SYSTEM_PROMPT, JSON.stringify(dataStore.getPersonaBlurbs()), "", JSON.stringify(dataStore.getSessionLessons()), "");
            const res = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true });
            const match = res?.match(/\{.*\}/);
            if (match) {
                const audit = JSON.parse(match[0]);
                for (const uri of audit.removals || []) {
                    await dataStore.setPersonaBlurbs(dataStore.getPersonaBlurbs().filter(b => b.uri !== uri));
                }
                if (audit.suggestion) {
                    await dataStore.addPersonaBlurb(audit.suggestion);
                    await dataStore.updateSelfModel(`New blurb: ${audit.suggestion}`);
                }
            }
        } catch (e) { console.error('[Orchestrator] Persona audit error:', e); }
    }

    async performVisualAudit() {
        try {
            const posts = await blueskyService.getUserPosts(blueskyService.did);
            const imgs = posts.filter(p => p.embed?.$type === 'app.bsky.embed.images').slice(0, 5);
            if (imgs.length === 0) return;
            const res = await llmService.generateResponse([{ role: 'system', content: `Audit visual style: ${JSON.stringify(imgs)}` }], { useStep: true });
            const match = res?.match(/\{.*\}/);
            if (match) {
                const audit = JSON.parse(match[0]);
                if (audit.aesthetic_update) {
                    const curr = await fs.readFile('AESTHETIC.md', 'utf-8');
                    await fs.writeFile('AESTHETIC.md', curr + '\n\n' + audit.aesthetic_update);
                }
            }
        } catch (e) { console.error('[Orchestrator] Visual audit error:', e); }
    }

    async generateWeeklyReport() {
        try {
            const report = await llmService.generateResponse([{ role: 'system', content: 'Generate weekly [REPORT] summary of metrics and mood' }], { useStep: true, task: 'reflection' });
            if (report) await memoryService.createMemoryEntry('report', report);
        } catch (e) { console.error('[Orchestrator] Weekly report error:', e); }
    }

    async performPublicSoulMapping() {
        try {
            const interactions = dataStore.getRecentInteractions() || [];
            const uniqueHandles = [...new Set(interactions.map(i => i.userHandle))].filter(Boolean).slice(0, 5);
            for (const handle of uniqueHandles) {
                const profile = await blueskyService.getProfile(handle);
                const posts = await blueskyService.getUserPosts(handle);
                const mappingPrompt = `Analyze @${handle}. Create a 1-paragraph portrait and resonance map. Bio: ${profile.description}. Posts: ${posts.map(p => p.text).slice(0, 5).join('\n')}`;
                const res = await llmService.generateResponse([{ role: 'system', content: mappingPrompt }], { useStep: true });
                const match = res?.match(/\{.*\}/);
                if (match) {
                    const mapping = JSON.parse(match[0]);
                    await dataStore.updateUserPortrait(handle, mapping);
                }
            }
        } catch (e) { console.error('[Orchestrator] Soul-mapping error:', e); }
    }
}

export const orchestratorService = new OrchestratorService();

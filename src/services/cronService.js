import fs from 'fs/promises';
import path from 'path';
import { dataStore } from './dataStore.js';
import { memoryService } from './memoryService.js';
import { blueskyService } from './blueskyService.js';
import { discordService } from './discordService.js';
import { llmService } from './llmService.js';
import config from '../../config.js';

class CronService {
    constructor() {
        this.tasks = [];
        this.interval = null;
    }

    async init() {
        console.log('[CronService] Initializing...');
        this.start();
    }

    start() {
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => this.tick(), 60000); // Every minute
        console.log('[CronService] Scheduler started.');
    }

    async tick() {
        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

        const tasks = dataStore.getDiscordScheduledTasks();
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            if (task.time === timeStr) {
                try {
                    if (task.channelId) {
                        const channelId = task.channelId.replace('dm_', '');
                        const channel = await discordService.client.channels.fetch(channelId).catch(() => null);
                        if (channel) await discordService._send(channel, task.message);
                    } else {
                        await discordService.sendSpontaneousMessage(task.message);
                    }
                    await dataStore.removeDiscordScheduledTask(i);
                    i--;
                } catch (e) {
                    console.error('[CronService] Error executing scheduled task:', e);
                }
            }
        }

        if (timeStr === '00:00') {
            console.log('[CronService] Midnight maintenance starting...');
            await memoryService.cleanupMemoryThread();
            await memoryService.auditMemoriesForReconstruction();
            if (now.getDate() === 1) await this.performMonthlyWorldviewAudit();
            if (now.getDay() === 0) await this.performWeeklyPersonaAudit();
            await this.performDailyRelationalAudit();
            await this.auditAdminBlueskyUsage();
            await memoryService.performDailyKnowledgeAudit();
        }

        const scheduledPosts = dataStore.getScheduledPosts();
        for (let i = 0; i < scheduledPosts.length; i++) {
            const post = scheduledPosts[i];
            if (now >= new Date(post.timestamp)) {
                try {
                    if (post.platform === 'bluesky') await blueskyService.post(post.content, post.embed);
                    await dataStore.removeScheduledPost(i);
                    i--;
                } catch (e) {
                    console.error('[CronService] Error executing scheduled post:', e);
                }
            }
        }
    }

  async performDailyRelationalAudit() {
    console.log('[CronService] Starting Daily Relational Audit...');
    const admin = await discordService.getAdminUser();
    if (!admin) return;

    const history = dataStore.getDiscordConversation(`dm_${admin.id}`);
    if (history.length === 0) return;

    const auditPrompt = `Daily Relational Reflection for Admin ${admin.username}. Respond with JSON { "interests": {}, "season": "spring", "reflection": "", "strong_relationship": false, "curiosity_questions": [] }.`;
    const audit = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true });
    try {
        const match = audit?.match(/\{[\s\S]*\}/);
        const result = match ? JSON.parse(match[0]) : null;
        if (result) {
            if (result.interests) await dataStore.updateAdminInterests(result.interests);
            if (result.season) await dataStore.updateRelationshipSeason(result.season);
            if (result.reflection) await dataStore.addRelationalReflection(result.reflection);
            if (result.strong_relationship !== undefined) await dataStore.setStrongRelationship(result.strong_relationship);
            if (result.curiosity_questions) await dataStore.updateCuriosityReservoir(result.curiosity_questions);
        }
    } catch (e) {
        console.error('[CronService] Error parsing daily relational audit:', e);
    }
  }

  async performMonthlyWorldviewAudit() {
    const admin = await discordService.getAdminUser();
    if (!admin) return;
    const history = dataStore.getDiscordConversation(`dm_${admin.id}`);
    const worldview = await llmService.generateAdminWorldview(history, dataStore.getAdminInterests());
    if (worldview) {
        await dataStore.db.update(data => { data.admin_worldview = worldview; });
        if (memoryService.isEnabled()) await memoryService.createMemoryEntry('philosophy', `[WORLDVIEW] ${worldview.summary.substring(0, 150)}`);
    }
  }

  async auditAdminBlueskyUsage() {
    const adminDid = dataStore.getAdminDid();
    if (!adminDid) return;
    try {
        const posts = await blueskyService.getUserPosts(adminDid, 50);
        const analysis = await llmService.analyzeBlueskyUsage(adminDid, posts);
        if (analysis) await dataStore.db.update(data => { data.admin_bluesky_usage = analysis; });
    } catch (e) {}
  }

  async performWeeklyPersonaAudit() {
    const recentActions = dataStore.getAgencyLogs().slice(-20);
    const audit = await llmService.auditPersonaAlignment(recentActions);
    if (audit && audit.advice) {
        await dataStore.addPersonaAdvice(audit.advice);
        if (memoryService.isEnabled()) await memoryService.createMemoryEntry('persona_update', `[PERSONA] Alignment Advice: ${audit.advice}`);
    }
  }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }
}

export const cronService = new CronService();

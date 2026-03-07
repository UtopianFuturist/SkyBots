import fs from 'fs/promises';
import path from 'path';
import { dataStore } from './dataStore.js';
import { memoryService } from './memoryService.js';
import { blueskyService } from './blueskyService.js';
import { discordService } from './discordService.js';

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
        const dayStr = now.toLocaleDateString('en-US', { weekday: 'long' });

        // 1. Process Scheduled Tasks from DataStore
        const tasks = dataStore.getDiscordScheduledTasks();
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            if (task.time === timeStr) {
                console.log(`[CronService] Executing scheduled task at ${timeStr}: ${task.message}`);
                try {
                    if (task.channelId) {
                        const channel = await discordService.client.channels.fetch(task.channelId.replace('dm_', '')).catch(() => null);
                        if (channel) {
                            await discordService._send(channel, task.message);
                        }
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

        // 2. Process Recurring Maintenance
        if (timeStr === '00:00') {
            console.log('[CronService] Midnight maintenance starting...');
            await memoryService.cleanupMemoryThread();
        }

        // 3. Process Scheduled Posts
        const scheduledPosts = dataStore.getScheduledPosts();
        for (let i = 0; i < scheduledPosts.length; i++) {
            const post = scheduledPosts[i];
            const postTime = new Date(post.timestamp);
            if (now >= postTime) {
                console.log(`[CronService] Executing scheduled post on ${post.platform}`);
                try {
                    if (post.platform === 'bluesky') {
                        await blueskyService.post(post.content, post.embed);
                    }
                    await dataStore.removeScheduledPost(i);
                    i--;
                } catch (e) {
                    console.error('[CronService] Error executing scheduled post:', e);
                }
            }
        }
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }
}

export const cronService = new CronService();

import { blueskyService } from './services/blueskyService.js';
import { discordService } from './services/discordService.js';
import { orchestratorService } from './services/orchestratorService.js';
import { dataStore } from './services/dataStore.js';
import { llmService } from './services/llmService.js';
import toolService from './services/toolService.js';
import { temporalService } from './services/temporalService.js';
import config from '../config.js';
import { sanitizeThinkingTags, sanitizeCharacterCount } from './utils/textUtils.js';

export class Bot {
    constructor() {
        this.paused = false;
        orchestratorService.setBotInstance(this);
    }

    async init() {
        console.log('[Bot] Initializing...');
        await dataStore.init();
        await toolService.init();
        await blueskyService.authenticate();
        await discordService.init();
        discordService.setBotInstance(this);
        llmService.setDataStore(dataStore);
        await orchestratorService.start();

        console.log('[Bot] Initialization complete.');
        return this;
    }

    async run() {
        console.log('[Bot] Starting cycles...');
        this.startAutonomousCycle();
        this.startNotificationPoll();
    }

    startNotificationPoll() {
        setInterval(async () => {
            if (this.paused) return;
            try {
                const { notifications } = await blueskyService.getNotifications();
                const unread = notifications.filter(n => !n.isRead && (n.reason === 'mention' || n.reason === 'reply'));
                for (const n of unread) { await this.handleBlueskyNotification(n); }
                if (notifications.length > 0) await blueskyService.updateSeen(notifications[0].indexedAt);
            } catch (e) { console.error('[Bot] Bluesky poll error:', e); }
        }, 60000);
    }

    async handleBlueskyNotification(n) {
        if (dataStore.hasReplied(n.uri)) return;

        const isSelf = n.author.did === blueskyService.did;
        const prePlan = await llmService.performPrePlanning?.(n.record.text, []);
        if (isSelf && prePlan?.intent !== 'analytical') return;

        if (n.record.text.toLowerCase().includes('nsfw')) {
            await dataStore.setBoundaryLockout(n.author.did, 30);
            return;
        }

        if (dataStore.isUserLockedOut(n.author.did)) return;

        const thread = await blueskyService.getDetailedThread(n.uri);
        if (!thread?.post) return;

        const plan = await llmService.performAgenticPlanning(n.record.text, [], '', false, 'bluesky');
        const evaluation = await llmService.evaluateAndRefinePlan(plan);
        if (evaluation.decision === 'refuse') return;

        const response = await this.generateGroundedResponse(n.record.text, 'bluesky');
        if (response) {
            await blueskyService.postReply(thread.post, response);
            await dataStore.addRepliedPost(n.uri);
        }
    }

    async generateGroundedResponse(text, platform) {
        const messages = [{ role: 'user', content: text }];
        let response = await llmService.generateResponse(messages, { platform });
        const audit = await llmService.performRealityAudit(response);
        if (audit.hallucination_detected) {
            response = await llmService.generateResponse([...messages, { role: 'system', content: `[REALITY CRITIQUE]: ${audit.critique}. Provide a grounded version.` }], { platform });
        }
        return response;
    }

    async executeAction(action) {
        const { tool, parameters } = action;
        try {
            switch (tool) {
                case 'set_temporal_event': await dataStore.addTemporalEvent(parameters.text, parameters.duration_minutes); return "Set.";
                case 'track_deadline': await dataStore.addDeadline(parameters.task, parameters.target_date); return "Tracked.";
                case 'get_admin_time_context': return await temporalService.getEnhancedTemporalContext();
                case 'add_persona_blurb': await dataStore.addPersonaBlurb(parameters.content || action.query); return "Added.";
                case 'remove_persona_blurb':
                    const blurbs = dataStore.getPersonaBlurbs();
                    const next = blurbs.filter(b => b.uri !== parameters.uri);
                    await dataStore.setPersonaBlurbs(next);
                    return "Removed.";
                default: return "Unknown.";
            }
        } catch (e) { return "Error."; }
    }

    startAutonomousCycle() {
        setInterval(() => { if (!this.paused) orchestratorService.heartbeat(); }, 300000);
        setInterval(() => { if (!this.paused) orchestratorService.checkMaintenanceTasks(); }, 14400000);
    }

    async processNotification(n) { return this.handleBlueskyNotification(n); }
    async performAutonomousPost() { return orchestratorService.performAutonomousPost(); }
    async cleanupOldPosts() {
        const profile = await blueskyService.getProfile(config.BLUESKY_IDENTIFIER);
        const feed = await blueskyService.getUserActivity(profile.did, 100);
        const now = Date.now();
        for (const item of feed) {
            if (now - new Date(item.indexedAt).getTime() > 30 * 24 * 60 * 60 * 1000) {
                await blueskyService.deletePost(item.uri);
            }
        }
    }
}

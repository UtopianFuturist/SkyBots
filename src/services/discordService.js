import { Client, GatewayIntentBits, Partials, ChannelType, AttachmentBuilder } from 'discord.js';
import fetch from 'node-fetch';
import config from '../../config.js';
import { dataStore } from './dataStore.js';
import { llmService } from './llmService.js';
import { imageService } from './imageService.js';
import { sanitizeThinkingTags, splitTextForDiscord } from '../utils/textUtils.js';

class DiscordService {
    constructor() {
        this.client = null;
        this.token = config.DISCORD_BOT_TOKEN?.trim().replace(/['"]/g, '');
        this.adminName = config.DISCORD_ADMIN_NAME;
        this.nickname = config.DISCORD_NICKNAME || config.DISCORD_NICKNAME || config.BOT_NAME || 'Sydney';
        this.isEnabled = !!this.token && this.token !== 'undefined' && this.token !== 'null';
        this.adminId = null;
        this.status = 'offline';
        this.isProcessingAdminRequest = false;
        this.isInitializing = false;
    }

    setBotInstance(bot) { this.botInstance = bot; }

    async init() {
        if (!this.isEnabled || this.isInitializing) return;
        this.isInitializing = true;
        this.status = 'connecting';
        try {
            this.client = new Client({
                intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages ],
                partials: [ Partials.Channel, Partials.Message, Partials.User ]
            });
            this.setupEventListeners();
            await this.client.login(this.token);
            this.status = 'online';
            this.isInitializing = false;
        } catch (e) {
            console.error('[DiscordService] Login failed:', e.message);
            this.status = 'offline';
            this.isInitializing = false;
        }
    }

    setupEventListeners() {
        this.client.on('clientReady', () => {
            this.status = 'online';
            console.log(`[DiscordService] Logged in as ${this.client.user.tag}`);
        });
        this.client.on('messageCreate', async (m) => {
            if (m.author.bot) return;
            const isAdmin = m.author.username === this.adminName;
            if (isAdmin) this.isProcessingAdminRequest = true;
            try {
                const normId = m.channel.type === ChannelType.DM ? `dm_${m.author.id}` : m.channel.id;
                await dataStore.saveDiscordInteraction(normId, 'user', m.content);
                if (m.channel.type !== ChannelType.DM && !m.mentions.has(this.client.user)) return;

                await m.channel.sendTyping();

                // Fetch context (up to 25 messages for planning)
                let formattedHistory = [];
                try {
                    const history = await m.channel.messages.fetch({ limit: 25 });
                    formattedHistory = Array.from(history.values()).reverse().map(msg => ({
                        role: msg.author.id === this.client.user.id ? 'assistant' : 'user',
                        content: msg.content
                    }));
                } catch (e) {
                    console.error('[DiscordService] Failed to fetch history:', e.message);
                    formattedHistory = [{ role: 'user', content: m.content }];
                }

                const mood = dataStore.getMood();
                const refusalCounts = dataStore.getRefusalCounts();

                // 1. Pre-planning
                const prePlan = await llmService.performPrePlanning(m.content, formattedHistory, "none", "discord", mood, refusalCounts);

                // Handle Timezone Correction
                if (prePlan.flags && prePlan.flags.includes('time_correction_detected')) {
                    const tzResult = await llmService.updateTimezoneFromCorrection(m.content);
                    if (tzResult && tzResult.timezone) {
                        console.log(`[DiscordService] Timezone correction detected: ${tzResult.timezone}`);
                        await dataStore.setAdminTimezone(tzResult.timezone);
                        await dataStore.addInternalLog("timezone_update", `Updated timezone to ${tzResult.timezone} based on user correction.`);
                    }
                }

                // 2. Agentic Planning (for tools like image gen)
                const plan = await llmService.performAgenticPlanning(m.content, formattedHistory, "none", isAdmin, "discord", dataStore.getExhaustedThemes(), config, "", "neutral", refusalCounts, null, prePlan);

                for (const action of (plan.actions || [])) {
                    if (action.tool === 'image_gen' || action.tool === 'generate_image') {
                        const img = await imageService.generateImage(action.query || action.prompt);
                        if (img) {
                            await this._send(m, "", { files: [new AttachmentBuilder(img.buffer, { name: 'generated.png' })] });
                        }
                    }
                }

                // 3. Generate Main Response
                const response = await llmService.generateResponse(formattedHistory, { platform: 'discord' });
                if (response) {
                    await this._send(m, response);
                    await dataStore.addInternalLog("discord_reply", response);

                    // 4. Extract and Save Scheduled Tasks
                    const scheduledTask = await llmService.extractScheduledTask(m.content + " | Bot replied: " + response, mood);
                    if (scheduledTask && scheduledTask.decision === 'schedule') {
                        console.log(`[DiscordService] Scheduling task: ${scheduledTask.message_context} at ${scheduledTask.time} on ${scheduledTask.date}`);
                        await dataStore.addDiscordScheduledTask({
                            time: scheduledTask.time,
                            date: scheduledTask.date,
                            message_context: scheduledTask.message_context,
                            silent: scheduledTask.silent,
                            reason: scheduledTask.reason,
                            channelId: m.channel.id
                        });
                        if (!scheduledTask.silent) {
                            // If it's not silent, the bot might have already mentioned it in the response,
                            // but we can add an internal log.
                            await dataStore.addInternalLog("task_scheduled", scheduledTask);
                        }
                    }
                }
            } catch (e) {
                console.error('[DiscordService] Error in messageCreate:', e);
            } finally {
                if (isAdmin) this.isProcessingAdminRequest = false;
            }
        });
    }

    async _send(target, content, options = {}) {
        const sanitized = sanitizeThinkingTags(content);
        const chunks = sanitized ? splitTextForDiscord(sanitized) : [""];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const sendOptions = (i === chunks.length - 1) ? { content: chunk || undefined, ...options } : { content: chunk };

            // If content is empty and we have files, Discord requires content to be null or a string
            if (!sendOptions.content && !sendOptions.files) continue;

            const sent = await (target.send ? target.send(sendOptions) : target.channel.send(sendOptions));
            const normId = target.channel ? (target.channel.type === ChannelType.DM ? `dm_${target.author.id}` : target.channel.id) : target.id;
            if (chunk) await dataStore.saveDiscordInteraction(normId, 'assistant', chunk);
        }
    }

    async getAdminUser() {
        if (!this.client?.isReady()) return null;
        const guilds = this.client.guilds.cache;
        for (const [id, guild] of guilds) {
            const members = await guild.members.fetch({ query: this.adminName, limit: 100 }).catch(() => null);
            if (members?.first()) return members.first().user;
        }
        return null;
    }

    async fetchAdminHistory(limit = 100) {
        const admin = await this.getAdminUser();
        if (!admin) return [];
        try {
            const dm = await admin.createDM();
            const msgs = await dm.messages.fetch({ limit });
            return msgs.map(m => ({ role: m.author.id === this.client.user.id ? 'assistant' : 'user', content: m.content }));
        } catch (e) { return []; }
    }

    async sendSpontaneousMessage(content) {
        const admin = await this.getAdminUser();
        if (admin) await this._send(admin, content);
    }
}

export const discordService = new DiscordService();

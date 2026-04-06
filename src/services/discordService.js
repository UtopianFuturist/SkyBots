import { Client, GatewayIntentBits, Partials, ActivityType } from 'discord.js';
import config from '../../config.js';
import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import { imageService } from './imageService.js';
import { memoryService } from './memoryService.js';
import { newsroomService } from './newsroomService.js';
import { introspectionService } from './introspectionService.js';
import { socialHistoryService } from './socialHistoryService.js';
import { moltbookService } from './moltbookService.js';
import { checkSimilarity, isSlop } from '../utils/textUtils.js';
import * as prompts from '../prompts/index.js';
import { temporalService } from './temporalService.js';

class DiscordService {
    constructor() {
        console.log('[DiscordService] Constructor starting...');
        this.isEnabled = !!config.DISCORD_BOT_TOKEN;
        this.token = config.DISCORD_BOT_TOKEN;
        this.adminName = config.ADMIN_NAME;
        this.adminId = null;
        this.nickname = config.BOT_NAME;
        this.isResponding = false;
        this.botInstance = null;
        this.client = null;
        this._lastHeavyAdminSearch = 0;
        this._lastMessageFetch = {};
        console.log(`[DiscordService] Constructor finished. isEnabled: ${this.isEnabled}, Admin: ${this.adminName}, Token length: ${this.token?.length || 0}`);
    }

    setBotInstance(bot) {
        this.botInstance = bot;
    }

    async init() {
        if (!this.isEnabled) {
            console.log('[DiscordService] Discord token not configured or invalid. Service disabled.');
            return;
        }

        this.isInitializing = true;
        console.log('[DiscordService] Initial 10s cooldown before starting initialization...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        if (this.client) {
            try { this.client.destroy(); } catch (e) {}
        }

        console.log('[DiscordService] Creating client with intents and partials...');
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.GuildPresences,
                GatewayIntentBits.GuildMembers
            ],
            partials: [Partials.Channel, Partials.Message]
        });

        this.client.once('ready', async () => {
            console.log(`[DiscordService] Logged in as ${this.client.user.tag}`);
            this.client.user.setActivity('the currents', { type: ActivityType.Listening });
        });

        this.client.on('messageCreate', async (message) => {
            try {
                await this.handleMessage(message);
            } catch (err) {
                console.error('[DiscordService] Error in messageCreate listener:', err);
            }
        });

        let attempts = 0;
        const maxAttempts = 5;
        while (attempts < maxAttempts) {
            attempts++;
            try {
                console.log(`[DiscordService] Login attempt ${attempts}/${maxAttempts}...`);
                await this.client.login(this.token);
                console.log('[DiscordService] SUCCESS: Client is ready!');
                this.isInitializing = false;
                return;
            } catch (err) {
                console.error(`[DiscordService] Login attempt ${attempts} failed:`, err.message);
                if (attempts < maxAttempts) await new Promise(r => setTimeout(r, 60000));
            }
        }
    }

    async handleMessage(message) {
        if (message.author.bot) return;
        const isDM = !message.guild;
        const isMentioned = message.mentions.has(this.client.user) || message.content.toLowerCase().includes(this.nickname.toLowerCase());
        const isReplyToMe = message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === this.client.user.id;

        if (isDM || isMentioned || isReplyToMe) {
            await this.respond(message);
        }
    }

    async _send(channel, content, options = {}) {
        if (!channel) return;
        try {
            await channel.send({ content, ...options });
        } catch (err) {
            console.error('[DiscordService] Error sending message:', err);
        }
    }

    _startTypingLoop(channel) {
        if (!channel) return null;
        channel.sendTyping().catch(() => {});
        return setInterval(() => {
            channel.sendTyping().catch(() => {});
        }, 5000);
    }

    _stopTypingLoop(interval) {
        if (interval) clearInterval(interval);
    }

    getNormalizedChannelId(message) {
        if (!message.guild) return `dm-${message.author.id}`;
        return message.channel.id;
    }

    async respond(message) {
        const text = message.content.toLowerCase();
        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
        this.isResponding = true;

        const normChannelId = this.getNormalizedChannelId(message);
        let imageAnalysisResult = '';
        if (message.attachments.size > 0) {
            for (const [id, attachment] of message.attachments) {
                if (attachment.contentType?.startsWith('image/')) {
                    try {
                        const analysis = await llmService.analyzeImage(attachment.url);
                        if (analysis) imageAnalysisResult += `[Image attached by user: ${analysis}] `;
                    } catch (err) {}
                }
            }
        }

        let history = dataStore.getDiscordConversation(normChannelId);
        if (history.length === 0) {
            try {
                const fetchedMessages = await message.channel.messages.fetch({ limit: 50 });
                history = fetchedMessages.reverse()
                    .filter(m => (m.content || m.attachments.size > 0) && !m.content.startsWith('/'))
                    .map(m => ({
                        role: m.author.id === this.client.user.id ? 'assistant' : 'user',
                        author: m.author.username,
                        content: m.content,
                        timestamp: m.createdTimestamp,
                        attachments: m.attachments
                    }));
            } catch (err) {}
        }

        await dataStore.saveDiscordInteraction(normChannelId, 'user', message.content);

        const hierarchicalSummary = await socialHistoryService.getHierarchicalSummary();
        const temporalContext = await temporalService.getEnhancedTemporalContext();
        const dynamicBlurbs = dataStore.getPersonaBlurbs();
        const personaUpdates = dataStore.getPersonaUpdates();

        // Detect Creative Session
        const isCreative = text.includes("imagine") || text.includes("paint") || text.includes("draw") || text.includes("story") || text.includes("creative");

        const systemPrompt = `
You are talking to ${isAdmin ? `your admin (${this.adminName})` : `@${message.author.username}`} on Discord.
Persona: ${config.TEXT_SYSTEM_PROMPT}
${temporalContext}
${dynamicBlurbs.length > 0 ? `\nDynamic Persona: \n${dynamicBlurbs.map(b => '- ' + b.text).join('\n')}` : ''}
${personaUpdates ? `\nPersona Updates: \n${personaUpdates}` : ''}

--- SOCIAL NARRATIVE ---
${hierarchicalSummary.dailyNarrative}
${hierarchicalSummary.shortTerm}
---

IMAGE ANALYSIS: ${imageAnalysisResult || 'No images.'}
`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.slice(-20).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
            { role: 'user', content: message.content }
        ];

        let typingInterval = this._startTypingLoop(message.channel);
        try {
            let responseText;
            if (isAdmin) {
                const prePlan = await llmService.performPrePlanning(message.content, history, imageAnalysisResult, "discord", dataStore.getMood(), {});
                let plan = await llmService.performAgenticPlanning(message.content, history, imageAnalysisResult, true, 'discord', dataStore.getExhaustedThemes(), {}, {}, {}, {}, null, prePlan);
                const evaluation = await llmService.evaluateAndRefinePlan(plan, { platform: 'discord', isAdmin: true });
                if (evaluation.decision === 'proceed') {
                    for (const action of (evaluation.refined_actions || plan.actions)) {
                        await this.botInstance.executeAction(action, { ...message, platform: 'discord' });
                    }
                }
            }

            // Generate final conversational response
            responseText = await llmService.generateResponse(messages, { platform: 'discord', useStep: true });

            if (responseText) {
                // Reality & Variety Audit
                const realityAudit = await llmService.performRealityAudit(responseText, {}, {
                    history: history.map(h => ({ content: h.content })),
                    isCreative
                });
                if (realityAudit.hallucination_detected || realityAudit.repetition_detected) {
                    console.warn(`[DiscordService] Audit flagged response. Refining...`);
                    responseText = realityAudit.refined_text;
                }

                const rawChunks = responseText.split("\n").filter(m => m.trim().length > 0);
                for (const chunk of rawChunks.slice(0, 5)) {
                    await this._send(message.channel, chunk);
                    if (rawChunks.length > 1) await new Promise(r => setTimeout(r, 1500));
                }
                await dataStore.saveDiscordInteraction(normChannelId, 'assistant', responseText);
            }
        } catch (error) {
            console.error('[DiscordService] Error:', error);
        } finally {
            this._stopTypingLoop(typingInterval);
            this.isResponding = false;
        }
    }

    async sendSpontaneousMessage(message = null, messageCount = 1) {
        if (!this.isEnabled || !this.client?.isReady()) return;
        try {
            const admin = await this.getAdminUser();
            if (!admin) return;
            const dmChannel = admin.dmChannel || await admin.createDM();

            if (message) {
                await this._send(dmChannel, message);
                return;
            }

            const history = await this.fetchAdminHistory(20);
            const spontaneityPrompt = `Reach out to your admin spontaneously. Persona: ${config.TEXT_SYSTEM_PROMPT}`;
            let response = await llmService.generateResponse([{ role: "system", content: spontaneityPrompt }], { platform: "discord", useStep: true });

            if (response) {
                const realityAudit = await llmService.performRealityAudit(response, {}, { history });
                if (realityAudit.hallucination_detected || realityAudit.repetition_detected) response = realityAudit.refined_text;
                await this._send(dmChannel, response);
            }
        } catch (err) {
            console.error("[DiscordService] Spontaneous error:", err);
        }
    }

    async getAdminUser() {
        if (!this.client?.isReady()) return null;
        if (this.adminId) return await this.client.users.fetch(this.adminId);
        const guilds = this.client.guilds.cache;
        for (const [id, guild] of guilds) {
            try {
                const members = await guild.members.fetch({ query: this.adminName, limit: 1 });
                const admin = members.first();
                if (admin && admin.user.username === this.adminName) {
                    this.adminId = admin.user.id;
                    return admin.user;
                }
            } catch (e) {}
        }
        return null;
    }

    async fetchAdminHistory(limit = 50) {
        const admin = await this.getAdminUser();
        if (!admin) return [];
        try {
            const dmChannel = admin.dmChannel || await admin.createDM();
            const messages = await dmChannel.messages.fetch({ limit });
            return messages.map(m => ({
                role: m.author.id === this.client.user.id ? 'assistant' : 'user',
                content: m.content,
                timestamp: m.createdTimestamp
            })).reverse();
        } catch (e) { return []; }
    }

    get status() { return this.isEnabled && this.client?.isReady() ? "online" : "offline"; }
}

export const discordService = new DiscordService();

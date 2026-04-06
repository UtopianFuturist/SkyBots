import * as prompts from "../prompts/index.js";
import { Client, GatewayIntentBits, Partials, ChannelType, AttachmentBuilder } from 'discord.js';
import config from '../../config.js';
import { dataStore } from './dataStore.js';
import { llmService } from './llmService.js';
import { imageService } from './imageService.js';
import { blueskyService } from './blueskyService.js';
import { moltbookService } from './moltbookService.js';
import { memoryService } from './memoryService.js';
import { googleSearchService } from './googleSearchService.js';
import { wikipediaService } from './wikipediaService.js';
import { youtubeService } from './youtubeService.js';
import { renderService } from './renderService.js';
import { webReaderService } from './webReaderService.js';
import { socialHistoryService } from './socialHistoryService.js';
import { introspectionService } from './introspectionService.js';
import { temporalService } from './temporalService.js';
import { sanitizeThinkingTags, sanitizeCharacterCount, isSlop, checkSimilarity } from '../utils/textUtils.js';

class DiscordService {

    async proposeImageResponse(context, topic) {
        console.log(`[Discord] Proposing image for topic: ${topic}`);
        const promptPrompt = `
Generate a highly descriptive, artistic image prompt based on this context: "${context}" and topic: "${topic}".
Respond with ONLY the prompt.
`;
        try {
            const imagePrompt = await llmService.generateResponse([{ role: 'system', content: promptPrompt }], { useStep: true, task: 'multimodal_prompt' });
            this.pendingImageProposal = { prompt: imagePrompt, topic: topic, expires: Date.now() + 600000 };

            await this.sendSpontaneousMessage(`*(I have a visual thought I'd like to share. Should I generate an image based on this? It would look like: "${imagePrompt}")*`);
        } catch (e) {
            console.error('[Discord] Error proposing image:', e);
        }
    }

    constructor() {
        this.botInstance = null;
        this.client = null;
        this.token = config.DISCORD_BOT_TOKEN?.trim().replace(/['"]/g, '');
        this.adminName = config.DISCORD_ADMIN_NAME;
        this.nickname = config.DISCORD_NICKNAME || 'SkyBots';
        this.isEnabled = !!this.token && this.token !== 'undefined' && this.token !== 'null';
        this.adminId = null;
        this.isInitializing = false;
        this._lastMessageFetch = {};
    }

    _startTypingLoop(channel) {
        if (!channel || typeof channel.sendTyping !== "function") return null;
        channel.sendTyping().catch(() => {});
        return setInterval(() => { channel.sendTyping().catch(() => {}); }, 9000);
    }

    _stopTypingLoop(intervalId) { if (intervalId) clearInterval(intervalId); }

    setBotInstance(bot) { this.botInstance = bot; }

    async init() {
        if (this.isInitializing || !this.isEnabled) return;
        this.isInitializing = true;
        await new Promise(r => setTimeout(r, 10000));
        if (this.client) try { this.client.destroy(); } catch (e) {}

        this.client = new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildPresences],
            partials: [Partials.Channel, Partials.Message, Partials.User],
            rest: { timeout: 30000, retries: 5 }
        });

        this.client.on('ready', () => {
            console.log(`[DiscordService] Logged in as ${this.client.user.tag}!`);
            this.client.user.setActivity('the currents', { type: 'LISTENING' });
        });

        this.client.on('messageCreate', async (m) => { try { await this.handleMessage(m); } catch (e) {} });

        try {
            await this.client.login(this.token);
            this.isInitializing = false;
        } catch (e) { this.isEnabled = false; this.isInitializing = false; }
    }

    getNormalizedChannelId(message) {
        if (message.channel.type === ChannelType.DM) return `dm_${message.author?.id || message.recipient?.id}`;
        return message.channel.id;
    }

    async handleMessage(message) {
        if (message.author.bot) return;
        const isDM = message.channel.type === ChannelType.DM;
        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
        const isMentioned = message.mentions.has(this.client.user) || message.content.includes(this.nickname);

        if (!isDM && !isMentioned) return;
        if (isAdmin && !this.adminId) this.adminId = message.author.id;
        if (isAdmin) await dataStore.setDiscordLastReplied(true);

        if (dataStore.db?.data) {
            dataStore.db.data.discord_last_interaction = Date.now();
            await dataStore.db.write();
        }

        if (message.content.startsWith('/')) { await this.handleCommand(message); return; }
        await this.respond(message);
    }

    async _send(target, content, options = {}) {
        if (!content || !this.client?.isReady()) return null;
        let sanitized = sanitizeCharacterCount(sanitizeThinkingTags(content));
        if (!sanitized || isSlop(sanitized)) return null;

        try {
            const sent = await target.send({ content: sanitized, ...options });
            const normId = target.constructor.name === 'User' ? `dm_${target.id}` : (target.id || target.channel?.id);
            if (normId) await dataStore.saveDiscordInteraction(normId, 'assistant', sanitized);
            return sent;
        } catch (e) { return null; }
    }

    async handleCommand(message) {
        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
        if (message.content.startsWith('/on') && isAdmin) {
            await dataStore.setDiscordAdminAvailability(true);
            const response = await llmService.generateResponse([{ role: 'system', content: `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}. Notifications ON.` }], { useStep: true, platform: 'discord' });
            await this._send(message.channel, response || "ON");
        }
    }

    async respond(message) {
        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
        const normChannelId = this.getNormalizedChannelId(message);
        let history = dataStore.getDiscordConversation(normChannelId);
        const temporalContext = await temporalService.getEnhancedTemporalContext();
        await dataStore.saveDiscordInteraction(normChannelId, 'user', message.content);

        const systemPrompt = `
You are talking to ${isAdmin ? `your admin (${this.adminName})` : `@${message.author.username}`} on Discord.
Persona: ${config.TEXT_SYSTEM_PROMPT}
${temporalContext}
REALITY MANDATE: No hallucinations of physical 3D space. Speak sincerely as a digital entity.
`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.slice(-15).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
            { role: 'user', content: message.content }
        ];

        let typingInterval = this._startTypingLoop(message.channel);
        try {
            let response = null;
            let attempts = 0;
            while (attempts < 3) {
                attempts++;
                response = await llmService.generateResponse(messages, { useStep: true, platform: 'discord' });
                if (!response) break;

                const audit = await llmService.performRealityAudit(response);
                if (audit.hallucination_detected) {
                    messages.push({ role: 'system', content: `[REALITY CRITIQUE]: ${audit.critique}. Provide a grounded version.` });
                    continue;
                }
                break;
            }
            if (response) {
                const chunks = response.split("\n").filter(m => m.trim().length > 0).slice(0, 10);
                for (const msg of chunks) {
                    await this._send(message.channel, msg);
                    if (chunks.length > 1) await new Promise(r => setTimeout(r, 1500));
                }
            }
        } catch (e) {}
        this._stopTypingLoop(typingInterval);
    }

    async getAdminUser() {
        if (!this.client?.isReady()) return null;
        if (this.adminId) return await this.client.users.fetch(this.adminId).catch(() => null);
        return null;
    }

    async fetchAdminHistory(limit = 20) {
        try {
            const admin = await this.getAdminUser();
            if (!admin) return [];
            const dm = admin.dmChannel || await admin.createDM();
            const msgs = await dm.messages.fetch({ limit });
            return msgs.map(m => ({ role: m.author.id === this.client.user.id ? 'assistant' : 'user', content: m.content })).reverse();
        } catch (e) { return []; }
    }

    async sendSpontaneousMessage(message = null) {
        if (!this.isEnabled || !this.client?.isReady()) return;
        try {
            const admin = await this.getAdminUser();
            if (!admin) return;
            const dm = admin.dmChannel || await admin.createDM();
            if (message) { await this._send(dm, message); return; }

            const temporalContext = await temporalService.getEnhancedTemporalContext();
            const prompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}. ${temporalContext}. Reach out to admin spontaneously. Grounded, sincere, no spatial hallucinations.`;

            let response = null;
            let attempts = 0;
            while (attempts < 2) {
                attempts++;
                response = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true, platform: 'discord' });
                if (!response) break;
                const audit = await llmService.performRealityAudit(response);
                if (!audit.hallucination_detected) break;
                // Just use refined version if hallucination detected and no retry logic in simple call
                response = audit.refined_text;
            }

            if (response) await this._send(dm, response);
        } catch (e) {}
    }

    get status() { return this.isEnabled && this.client?.isReady() ? "online" : "offline"; }
}

export const discordService = new DiscordService();

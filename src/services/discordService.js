import { Client, GatewayIntentBits, Partials, ChannelType } from 'discord.js';
import fetch from 'node-fetch';
import config from '../../config.js';
import { dataStore } from './dataStore.js';
import { llmService } from './llmService.js';
import { sanitizeThinkingTags, splitTextForDiscord } from '../utils/textUtils.js';

class DiscordService {
    constructor() {
        this.client = null;
        this.token = config.DISCORD_BOT_TOKEN?.trim().replace(/['"]/g, '');
        this.adminName = config.DISCORD_ADMIN_NAME;
        this.nickname = config.DISCORD_NICKNAME || 'SkyBots';
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
        this.client.on('ready', () => {
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
                const response = await llmService.generateResponse([{ role: 'user', content: m.content }], { platform: 'discord' });
                if (response) await this._send(m, response);
            } finally {
                if (isAdmin) this.isProcessingAdminRequest = false;
            }
        });
    }

    async _send(target, content, options = {}) {
        const sanitized = sanitizeThinkingTags(content);
        if (!sanitized) return;
        const chunks = splitTextForDiscord(sanitized);
        for (const chunk of chunks) {
            const sent = await (target.send ? target.send(chunk) : target.channel.send(chunk));
            const normId = target.channel ? (target.channel.type === ChannelType.DM ? `dm_${target.author.id}` : target.channel.id) : target.id;
            await dataStore.saveDiscordInteraction(normId, 'assistant', chunk);
        }
    }

    async getAdminUser() {
        if (!this.client?.isReady()) return null;
        const guilds = this.client.guilds.cache;
        for (const [id, guild] of guilds) {
            const members = await guild.members.fetch({ query: this.adminName, limit: 1 }).catch(() => null);
            if (members?.first()) return members.first().user;
        }
        return null;
    }

    async fetchAdminHistory(limit = 50) {
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

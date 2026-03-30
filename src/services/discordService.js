import { Client, GatewayIntentBits, Partials } from 'discord.js';
import config from '../../config.js';
import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';

class DiscordService {
    constructor() {
        this.client = null;
        this.isEnabled = !!config.DISCORD_BOT_TOKEN;
        this.adminName = config.DISCORD_ADMIN_NAME || 'Admin';
        this.isResponding = false;
    }
    setBotInstance(bot) { this.bot = bot; }

    async init() {
        if (!this.isEnabled) return;
        this.client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent], partials: [Partials.Channel, Partials.Message] });
        this.client.on('ready', () => console.log('[DiscordService] Connected.'));
        this.client.on('messageCreate', async (m) => {
            if (!m.author.bot && !m.guild && m.author.username === this.adminName) await this.respond(m);
        });
        await this.client.login(config.DISCORD_BOT_TOKEN);
    }

    async respond(message) {
        if (this.isResponding) return;
        this.isResponding = true;
        try {
            await message.channel.sendTyping();
            const inputLen = message.content.split(' ').length;
            const targetWords = Math.max(10, Math.floor(inputLen * 1.2));

            const response = await llmService.generateResponse([
                { role: 'system', content: config.TEXT_SYSTEM_PROMPT + `\nTARGET LENGTH: Around ${targetWords} words.` },
                { role: 'user', content: message.content }
            ], { useStep: true, platform: 'discord' });

            if (response) {
                await message.channel.send(response);
                await dataStore.addInternalLog('discord_reply', response);
            }
        } catch (e) { console.error('[DiscordService] Response error:', e); }
        this.isResponding = false;
    }
}
export const discordService = new DiscordService();

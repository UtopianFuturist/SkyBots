import { Client, GatewayIntentBits, Partials } from 'discord.js';
import config from '../../config.js';
import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';

class DiscordService {
    constructor() {
        this.client = null;
        this.isEnabled = !!config.DISCORD_BOT_TOKEN;
        this.adminName = config.DISCORD_ADMIN_NAME || 'Admin';
    }
    setBotInstance(bot) { this.bot = bot; }
    async init() {
        if (!this.isEnabled) return;
        this.client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent], partials: [Partials.Channel, Partials.Message] });
        this.client.on('ready', () => console.log('Discord Ready'));
        this.client.on('messageCreate', async (m) => {
            if (!m.author.bot && !m.guild && m.author.username === this.adminName) await this.respond(m);
        });
        await this.client.login(config.DISCORD_BOT_TOKEN);
    }
    async respond(m) {
        const inputLen = m.content.split(' ').length;
        const targetWords = Math.max(10, Math.floor(inputLen * 1.2));
        const res = await llmService.generateResponse([{ role: 'system', content: config.TEXT_SYSTEM_PROMPT + `\nTARGET: ${targetWords} words.` }, { role: 'user', content: m.content }], { useStep: true });
        if (res) await m.channel.send(res);
    }
    async fetchAdminHistory() { return []; }
}
export const discordService = new DiscordService();

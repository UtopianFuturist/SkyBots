import sys

file_path = 'src/services/discordService.js'

content = """import { Client, GatewayIntentBits, Partials, AttachmentBuilder } from 'discord.js';
import config from '../../config.js';
import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import { socialHistoryService } from './socialHistoryService.js';
import { temporalService } from './temporalService.js';
import { introspectionService } from './introspectionService.js';
import { isSlop, checkSimilarity } from '../utils/textUtils.js';

class DiscordService {
    constructor() {
        this.isEnabled = !!config.DISCORD_BOT_TOKEN;
        this.token = config.DISCORD_BOT_TOKEN?.trim().replace(/['"]/g, '').replace(/[\\\\u200B-\\\\u200D\\\\uFEFF]/g, '');
        this.adminName = config.DISCORD_ADMIN_NAME;
        this.adminId = null;
        this.nickname = config.BOT_NAME || 'Bot';
        this.respondingChannels = new Set();
        this.client = null;
        this.botInstance = null;
        this.isInitializing = false;
    }

    async init(botInstance) {
        if (!this.isEnabled || this.isInitializing) return;
        this.isInitializing = true;
        this.botInstance = botInstance;
        console.log('[DiscordService] Starting initialization...');
        this.loginLoop();
    }

    _createClient() {
        const client = new Client({
            partials: [Partials.Channel, Partials.Message],
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMessages
            ],
            rest: { timeout: 60000, retries: 5 }
        });

        client.on('ready', () => {
            console.log(`[DiscordService] SUCCESS: Logged in as ${client.user.tag}`);
            client.user.setActivity('the currents', { type: 'LISTENING' });
        });

        client.on('error', e => console.error(`[DiscordService] [ERROR] ${e.message}`));
        client.on('warn', w => console.warn(`[DiscordService] [WARN] ${w}`));

        client.on('invalidated', () => {
            console.error('[DiscordService] Session invalidated. Retrying...');
            if (!this.isInitializing) {
                this.isInitializing = true;
                setTimeout(() => this.loginLoop(), 5000);
            }
        });

        client.on('messageCreate', async (message) => {
            try { await this.handleMessage(message); } catch (err) { console.error('[DiscordService] Error:', err); }
        });

        return client;
    }

    async _checkConnectivity() {
        try {
            console.log('[DiscordService] Pre-flight connectivity check...');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const response = await fetch('https://discord.com', { method: 'HEAD', signal: controller.signal });
            clearTimeout(timeoutId);
            return response.ok || response.status === 429;
        } catch (err) { return false; }
    }

    async _checkInternalServices() {
        try {
            const llmHealth = await llmService.generateResponse([{ role: 'user', content: 'healthcheck' }], { temperature: 0, max_tokens: 1, useStep: true }).catch(() => null);
            return !!llmHealth;
        } catch (err) { return false; }
    }

    async loginLoop() {
        if (!this.token) return;
        while (true) {
            const attemptWindowMs = 10 * 60 * 1000;
            const startTime = Date.now();
            let attemptCount = 0;

            const hasConnectivity = await this._checkConnectivity();
            if (!hasConnectivity) {
                await new Promise(r => setTimeout(r, 5 * 60 * 1000));
                continue;
            }

            this._checkInternalServices().then(h => { if(!h) console.warn("[DiscordService] Internal services slow."); });

            while (Date.now() - startTime < attemptWindowMs) {
                attemptCount++;
                try {
                    if (this.client) {
                        this.client.removeAllListeners();
                        try { await this.client.destroy(); } catch (e) {}
                    }
                    console.log(`[DiscordService] Login attempt \${attemptCount}...`);
                    this.client = this._createClient();
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error("Timeout")), 300000);
                        this.client.once('ready', () => { clearTimeout(timeout); resolve(); });
                        this.client.login(this.token).catch(err => { clearTimeout(timeout); reject(err); });
                    });
                    this.isInitializing = false;
                    return;
                } catch (err) {
                    const backoff = Math.min(30000 * attemptCount, 60000);
                    if (attemptWindowMs - (Date.now() - startTime) > backoff) {
                        await new Promise(r => setTimeout(r, backoff));
                    } else break;
                }
            }
            await new Promise(r => setTimeout(r, 15 * 60 * 1000));
        }
    }

    async handleMessage(message) {
        if (message.author.bot) return;
        const isDM = !message.guild;
        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
        const text = message.content.trim();

        if (text.startsWith("!")) {
            if (!isAdmin) return;
            const { handleCommand } = await import("../utils/commandHandler.js");
            const response = await handleCommand(this.botInstance, { author: { handle: message.author.username }, platform: "discord" }, text);
            if (response) await this._send(message.channel, response);
            return;
        }

        const isMentioned = message.mentions.has(this.client.user) || message.content.toLowerCase().includes(this.nickname.toLowerCase());
        let isReplyToMe = false;
        if (message.reference) {
            try {
                const referenced = await message.channel.messages.fetch(message.reference.messageId);
                if (referenced.author.id === this.client.user.id) isReplyToMe = true;
            } catch (e) {}
        }

        if (isDM || isMentioned || isReplyToMe) {
            await this.respond(message);
        }
    }

    async _send(channel, content, options = {}) {
        if (!channel) return;
        try { return await channel.send({ content, ...options }); } catch (err) { return null; }
    }

    _startTypingLoop(channel) {
        if (!channel) return null;
        channel.sendTyping().catch(() => {});
        return setInterval(() => { channel.sendTyping().catch(() => {}); }, 5000);
    }

    _stopTypingLoop(interval) { if (interval) clearInterval(interval); }

    async respond(message) {
        const channelId = message.channel.id;
        if (this.respondingChannels.has(channelId)) return;

        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
        this.respondingChannels.add(channelId);
        const typingInterval = this._startTypingLoop(message.channel);

        try {
            let imageAnalysisResult = "";
            if (message.attachments.size > 0) {
                for (const [id, attachment] of message.attachments) {
                    try {
                        const analysis = await llmService.analyzeImage(attachment.url, "User attachment");
                        if (analysis) imageAnalysisResult += `[Image attached by user: \${analysis}] `;
                    } catch (err) {}
                }
            }

            const history = await this.fetchChannelHistory(message.channel, 15);
            const temporalContext = await temporalService.getEnhancedTemporalContext();
            const dynamicBlurbs = dataStore.getPersonaBlurbs();
            const hierarchicalSummary = await socialHistoryService.getHierarchicalSummary();

            const systemPrompt = `You are talking to \${isAdmin ? "your admin (" + this.adminName + ")" : "@" + message.author.username} on Discord.
Persona: \${config.TEXT_SYSTEM_PROMPT}
\${temporalContext}\${dynamicBlurbs.length > 0 ? "\\nDynamic Persona: \\n" + dynamicBlurbs.map(b => '- ' + b.text).join('\\n') : ''}

--- SOCIAL NARRATIVE ---
\${hierarchicalSummary.dailyNarrative || ""}
\${hierarchicalSummary.shortTerm || ""}
---

IMAGE ANALYSIS: \${imageAnalysisResult || 'No images.'}`;

            const messages = [
                { role: 'system', content: systemPrompt },
                ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
                { role: 'user', content: message.content }
            ];

            const plan = await llmService.performPrePlanning(messages, { platform: "discord", isAdmin });
            const evaluation = await llmService.evaluateAndRefinePlan(plan, { platform: "discord", isAdmin });
            const actions = (evaluation.decision === "proceed" ? (evaluation.refined_actions || plan.actions) : []) || [];
            const responseAction = actions.find(a => a.tool === 'respond_to_user');

            for (const action of actions.filter(a => a.tool !== 'respond_to_user')) {
                await this.botInstance.executeAction(action, { channel: message.channel, author: message.author, platform: "discord" });
            }

            let finalResponse = responseAction?.parameters?.text || await llmService.generateResponse(messages, { platform: "discord" });

            if (finalResponse) {
                const mainMsg = await this._send(message.channel, finalResponse);
                if (mainMsg && isAdmin && (finalResponse.toLowerCase().includes("remember") || finalResponse.toLowerCase().includes("important"))) {
                    try { await mainMsg.pin(); } catch (e) {}
                }
            }
        } catch (error) { console.error("[DiscordService] Error:", error); }
        finally {
            this._stopTypingLoop(typingInterval);
            this.respondingChannels.delete(channelId);
        }
    }

    async performStartupCatchup() {
        if (!this.client?.isReady()) return;
        try {
            const admin = await this.getAdminUser();
            if (!admin) return;
            const dmChannel = admin.dmChannel || await admin.createDM();
            const messages = await dmChannel.messages.fetch({ limit: 10 });
            const unread = messages.filter(m => !m.author.bot && m.createdTimestamp > (Date.now() - 3600000)).first();
            if (unread) await this.respond(unread);
        } catch (e) {}
    }

    async sendSpontaneousMessage(message = null, messageCount = 1) {
        if (!this.isEnabled || !this.client?.isReady()) return;
        try {
            const admin = await this.getAdminUser();
            if (!admin) return;
            const dmChannel = admin.dmChannel || await admin.createDM();
            if (message) { await this._send(dmChannel, message); return; }

            const history = await this.fetchAdminHistory(50);
            const contextData = {
                mood: dataStore.getMood().label,
                warmth: dataStore.getRelationshipWarmth(),
                energy: dataStore.getAdminEnergy()
            };

            let rawResponse = await llmService.generateResponse([{ role: "user", content: "Adopt persona: " + config.TEXT_SYSTEM_PROMPT + ". Recent: " + JSON.stringify(history.slice(-20)) + ". Spontaneous messages?" }], { useStep: true, platform: "discord" });
            if (!rawResponse) return;

            let candidateMessages = rawResponse.split('\\n').filter(m => m.trim().length > 0).slice(0, messageCount);
            for (const msg of candidateMessages) {
                const audit = await llmService.performRealityAudit(msg, {}, { history });
                const readyMsg = audit.refined_text;
                const edit = await llmService.performEditorReview(readyMsg, "discord");
                const finalMsg = edit.refined_text || readyMsg;
                await this._send(dmChannel, finalMsg);
                await dataStore.saveDiscordInteraction("dm-" + admin.id, 'assistant', finalMsg);
                if (candidateMessages.length > 1) await new Promise(r => setTimeout(r, 2000));
            }
        } catch (err) {}
    }

    async getAdminUser() {
        if (!this.client?.isReady()) return null;
        if (this.adminId) { try { return await this.client.users.fetch(this.adminId); } catch (e) { this.adminId = null; } }
        const cachedUser = this.client.users.cache.find(u => u.username === this.adminName);
        if (cachedUser) { this.adminId = cachedUser.id; return cachedUser; }
        for (const guild of this.client.guilds.cache.values()) {
            const member = guild.members.cache.find(m => m.user.username === this.adminName);
            if (member) { this.adminId = member.user.id; return member.user; }
        }
        return null;
    }

    async fetchAdminHistory(limit = 50) {
        const admin = await this.getAdminUser();
        if (!admin) return [];
        try {
            const dmChannel = admin.dmChannel || await admin.createDM();
            return await this.fetchChannelHistory(dmChannel, limit);
        } catch (e) { return []; }
    }

    async fetchChannelHistory(channel, limit = 50) {
        try {
            const messages = await channel.messages.fetch({ limit });
            return messages.map(m => ({
                role: m.author.id === this.client.user.id ? 'assistant' : 'user',
                content: m.content,
                author: m.author.username,
                timestamp: m.createdTimestamp
            })).reverse();
        } catch (e) { return []; }
    }

    get status() { return this.isEnabled && this.client?.isReady() ? "online" : "offline"; }
}

export const discordService = new DiscordService();"""

# Helper to write and fix template literals
def write_fixed(path, content):
    content = content.replace('\\${', '${')
    with open(path, 'w') as f:
        f.write(content)

write_fixed('src/services/discordService.js', content)
print("DiscordService restored cleanly")

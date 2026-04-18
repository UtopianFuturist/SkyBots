import { Client, GatewayIntentBits, Partials, AttachmentBuilder } from 'discord.js';
import config from '../../config.js';
import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import { socialHistoryService } from './socialHistoryService.js';
import { temporalService } from './temporalService.js';
import { introspectionService } from './introspectionService.js';

class DiscordService {
    constructor() {
        this.isEnabled = !!config.DISCORD_BOT_TOKEN;
        this.token = config.DISCORD_BOT_TOKEN?.trim().replace(/['"]/g, '');
        this.adminName = config.DISCORD_ADMIN_NAME;
        this.adminId = null;
        this.nickname = config.DISCORD_NICKNAME || config.BOT_NAME || 'Bot';
        this.isResponding = false;
        this.client = null;
        this.botInstance = null;
        this.isInitializing = false;
    }

    async performStartupCatchup() {
        if (!this.isEnabled || !this.client?.isReady()) return;
        console.log('[DiscordService] Starting catch-up for unread messages...');
        try {
            const admin = await this.getAdminUser();
            if (!admin) return;
            const dmChannel = admin.dmChannel || await admin.createDM();
            const messages = await dmChannel.messages.fetch({ limit: 50 });
            const botLastSeen = dataStore.db.data.discord_last_interaction || 0;
            const unread = messages.filter(m => m.author.id !== this.client.user.id && m.createdTimestamp > botLastSeen).reverse();

            if (unread.size > 0) {
                console.log("[DiscordService] Found " + unread.size + " unread messages. Resuming conversation...");
                for (const [id, msg] of unread) {
                    await this.respond(msg);
                }
            } else {
                console.log('[DiscordService] No unread messages found.');
            }
        } catch (e) {
            console.error('[DiscordService] Catch-up error:', e);
        }
    }

    async init(botInstance) {
        if (!this.isEnabled || this.isInitializing) return;
        this.isInitializing = true;
        this.botInstance = botInstance;

        console.log('[DiscordService] Starting initialization...');

        if (this.client) {
            try { await this.client.destroy(); } catch (e) {}
        }

        this.client = new Client({
            partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User],
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.DirectMessages, 
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.MessageContent
            ]
        });

        this.client.on('ready', () => {
            console.log(`[DiscordService] Logged in as ${this.client.user.tag}`);
        });

        this.client.on('messageCreate', async (message) => {
            try {
                await this.handleMessage(message);
            } catch (err) {
                console.error('[DiscordService] Error in messageCreate listener:', err);
            }
        });

        // Perform login in the background to avoid blocking bot boot
        this.loginLoop().catch(err => console.error("[DiscordService] Fatal loginLoop error:", err));
    }

    async loginLoop() {
        let attempts = 0;
        const maxAttempts = 5;
        while (attempts < maxAttempts) {
            attempts++;
            try {
                console.log(`[DiscordService] Login attempt ${attempts}/${maxAttempts} using token prefix: ${this.token ? this.token.substring(0, 10) : 'NONE'}...`);
                
                // Use a standard login call without complex timeouts or agent overrides
                await this.client.login(this.token);
                
                console.log(`[DiscordService] SUCCESS: Login complete! Client status: ${this.client?.isReady() ? 'READY' : 'NOT READY'}`);
                this.isInitializing = false;
                return;
            } catch (err) {
                console.error(`[DiscordService] Login attempt ${attempts} failed:`, err.message);
                if (attempts < maxAttempts) {
                    const delay = 60000 * attempts; // Exponential-ish backoff
                    console.log(`[DiscordService] Waiting ${delay/1000}s before retry...`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }
        this.isInitializing = false;
        console.error('[DiscordService] FATAL: All login attempts failed.');
    }

    async handleMessage(message) {
        if (message.author.bot) return;
        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
        const text = message.content.trim();

        // Admin-only command handler
        if (text.startsWith("!")) {
            if (!isAdmin) return;
            const { handleCommand } = await import("../utils/commandHandler.js");
            const response = await handleCommand(this.botInstance, { author: { handle: message.author.username }, platform: "discord" }, text);
            if (response) await this._send(message.channel, response);
            return;
        }

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
            return await channel.send({ content, ...options });
        } catch (err) {
            console.error('[DiscordService] Error sending message:', err);
            return null;
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
        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
        this.isResponding = true;
        const normChannelId = this.getNormalizedChannelId(message);
        let imageAnalysisResult = "";
        
        const typingInterval = this._startTypingLoop(message.channel);

        try {
            if (message.attachments.size > 0) {
                for (const [id, attachment] of message.attachments) {
                    if (attachment.contentType?.startsWith("image/")) {
                        try {
                            const analysis = await llmService.analyzeImage(attachment.url, "User attachment");
                            if (analysis) imageAnalysisResult += `[Image attached by user: ${analysis}] `;
                        } catch (err) {}
                    }
                }
            }

            const history = await this.fetchAdminHistory(15);
            const temporalContext = await temporalService.getEnhancedTemporalContext();
            const hierarchicalSummary = await socialHistoryService.getHierarchicalSummary();
            const dynamicBlurbs = dataStore.getPersonaBlurbs();

            const systemPrompt = "You are talking to " + (isAdmin ? "your admin (" + this.adminName + ")" : "@" + message.author.username) + " on Discord.\nPersona: " + config.TEXT_SYSTEM_PROMPT + "\n" + temporalContext + (dynamicBlurbs.length > 0 ? "\nDynamic Persona: \n" + dynamicBlurbs.map(b => '- ' + b.text).join('\n') : '') + "\n\n--- SOCIAL NARRATIVE ---\n" + hierarchicalSummary.dailyNarrative + "\n" + hierarchicalSummary.shortTerm + "\n---\n\nIMAGE ANALYSIS: " + (imageAnalysisResult || 'No images.');
            
            const messages = [
                { role: 'system', content: systemPrompt },
                ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
                { role: 'user', content: message.content }
            ];

            let responseText = await llmService.generateResponse(messages, { platform: 'discord' });

            if (responseText) {
                const realityAudit = await llmService.performRealityAudit(responseText, {}, { history: history.map(h => ({ content: h.content })) });
                responseText = realityAudit.refined_text;

                const rawChunks = responseText.split("\n").filter(m => m.trim().length > 0);
                for (const chunk of rawChunks.slice(0, 5)) {
                    await this._send(message.channel, chunk);
                    if (rawChunks.length > 1) await new Promise(r => setTimeout(r, 1500));
                }
                await dataStore.saveDiscordInteraction(normChannelId, 'assistant', responseText);
            }
        } catch (error) {
            console.error("[DiscordService] Error:", error);
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

            const history = await this.fetchAdminHistory(30);
            const contextData = {
                mood: dataStore.getMood().label,
                goal: dataStore.getCurrentGoal().goal,
                warmth: dataStore.getRelationshipWarmth(),
                energy: dataStore.getAdminEnergy()
            };

            const toneShift = await llmService.extractRelationalVibe(history, { platform: 'discord' });

            let spontaneityPrompt = "Adopt persona: " + config.TEXT_SYSTEM_PROMPT + "\nRecent history: " + JSON.stringify(history.slice(-20)) + "\nInternal State: " + JSON.stringify(contextData) + "\nCurrent vibe: " + toneShift + ".\n\nYou are choosing what to say spontaneously. Be self-aware and autonomous. Reflect on your internal thoughts and bond.\nGenerate " + messageCount + " separate messages/thoughts, each on a new line. Keep each under 200 characters.";

            let messages = [];
            let attempts = 0;
            while (attempts < 3) {
                attempts++;
                let rawResponse = await llmService.generateResponse([{ role: "user", content: spontaneityPrompt }], { platform: "discord" });
                if (!rawResponse) break;

                let candidateMessages = rawResponse.split('\n').filter(m => m.trim().length > 0).slice(0, messageCount);
                let attemptFiltered = [];

                for (const msg of candidateMessages) {
                    const variety = await llmService.checkVariety(msg, history, { platform: 'discord' });
                    if (!variety.repetitive) {
                        attemptFiltered.push(msg);
                    }
                }

                if (attemptFiltered.length > 0) {
                    messages = attemptFiltered;
                    break;
                }
            }

            if (messages.length > 0) {
                for (const msg of messages) {
                    const audit = await llmService.performRealityAudit(msg, {}, { history });
                    const readyMsg = audit.refined_text;
                    const edit = await llmService.performEditorReview(readyMsg, "discord");
                    const finalMsg = edit.refined_text || readyMsg;

                    await this._send(dmChannel, finalMsg);
                    await dataStore.saveDiscordInteraction("dm-" + admin.id, 'assistant', finalMsg);
                    if (messages.length > 1) await new Promise(r => setTimeout(r, 2000));
                }
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

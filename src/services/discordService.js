import { Client, GatewayIntentBits, Partials, ChannelType } from 'discord.js';
import dns from 'node:dns';
import config from '../../config.js';

// Force IPv4 first to avoid hanging connection issues on some networks (like Render)
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}
import { dataStore } from './dataStore.js';
import { llmService } from './llmService.js';
import { imageService } from './imageService.js';
import { blueskyService } from './blueskyService.js';
import { memoryService } from './memoryService.js';
import { socialHistoryService } from './socialHistoryService.js';
import { temporalService } from './temporalService.js';
import { introspectionService } from './introspectionService.js';
import { isSlop, checkSimilarity } from '../utils/textUtils.js';

class DiscordService {
    constructor() {
        this.isEnabled = !!config.DISCORD_BOT_TOKEN;
        this.token = config.DISCORD_BOT_TOKEN?.trim().replace(/['"]/g, '');
        this.adminName = config.DISCORD_ADMIN_NAME;
        this.adminId = null;
        this.nickname = config.BOT_NAME || 'Bot';
        this.isResponding = false;
        this.client = null;
        this.botInstance = null;
        this.isInitializing = false;
        this._lastHeavyAdminSearch = 0;
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
                console.log(`[DiscordService] Found ${unread.size} unread messages. Resuming conversation...`);
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
            try { this.client.destroy(); } catch (e) {}
        }

        const { Client, GatewayIntentBits, Partials } = await import("discord.js");
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

        this.client.on("ready", () => {
            console.log(`[DiscordService] SUCCESS: Logged in as ${this.client.user.tag}`);
        });

        this.client.on("messageCreate", async (message) => {
            try {
                await this.handleMessage(message);
            } catch (err) {
                console.error("[DiscordService] Error in messageCreate listener:", err);
            }
        });

        this.loginLoop();
    }

    async loginLoop() {
        let attempts = 0;
        const maxAttempts = 5;
        while (attempts < maxAttempts) {
            attempts++;
            try {
                console.log(`[DiscordService] Login attempt ${attempts}/${maxAttempts}...`);
                await this.client.login(this.token);
                console.log(`[DiscordService] SUCCESS: Login complete!`);
                this.isInitializing = false;
                return;
            } catch (err) {
                console.error(`[DiscordService] Login attempt ${attempts} failed:`, err.message);
                if (attempts < maxAttempts) {
                    await new Promise(r => setTimeout(r, 10000));
                }
            }
        }
        this.isInitializing = false;
    }

    async handleMessage(message) {
        if (message.author.bot) return;
        const isDM = !message.guild;
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
        if (this.isResponding) return;
        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
        this.isResponding = true;

        const normChannelId = this.getNormalizedChannelId(message);
        let imageAnalysisResult = "";
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

        let history = await this.fetchAdminHistory(30);
        let historyImageContext = "";
        const recentMsgsWithImages = (await message.channel.messages.fetch({ limit: 10 })).filter(m => m.attachments.size > 0);
        for (const [id, m] of recentMsgsWithImages) {
            for (const [aid, attachment] of m.attachments) {
                if (attachment.contentType?.startsWith("image/")) {
                    const analysis = await llmService.analyzeImage(attachment.url, "Past attachment");
                    historyImageContext += `[Previously seen image in history: ${analysis}] `;
                }
            }
        }
        imageAnalysisResult = historyImageContext + imageAnalysisResult;
        await dataStore.saveDiscordInteraction(normChannelId, "user", message.content);

        let typingInterval = this._startTypingLoop(message.channel);
        try {
            const hierarchicalSummary = await socialHistoryService.getHierarchicalSummary();
            const temporalContext = await temporalService.getEnhancedTemporalContext();
            const dynamicBlurbs = dataStore.getPersonaBlurbs();

            // 1. Pre-Planning
            const prePlan = await llmService.performPrePlanning(message.content, history, imageAnalysisResult, "discord", dataStore.getMood(), {});

            // 2. Agentic Planning
            const memories = await memoryService.getRecentMemories(20);
            let plan = await llmService.performAgenticPlanning(message.content, history, imageAnalysisResult, isAdmin, "discord", dataStore.getExhaustedThemes(), {}, {}, {}, {}, null, prePlan, { memories });

            // 3. Evaluation and Refinement
            const evaluation = await llmService.evaluateAndRefinePlan(plan, { platform: "discord", isAdmin });

            if (evaluation.decision === "proceed") {
                const actions = evaluation.refined_actions || plan.actions;
                let toolSentMessage = false;

                for (const action of actions) {
                    const result = await this.botInstance.executeAction(action, { channel: message.channel, platform: "discord" });
                    if (action.tool === "discord_message" && result.success) toolSentMessage = true;
                }

                if (!toolSentMessage) {
                    const systemPrompt = `
You are talking to ${isAdmin ? `your admin (${this.adminName})` : `@${message.author.username}`} on Discord.
Persona: ${config.TEXT_SYSTEM_PROMPT}
${temporalContext}
${dynamicBlurbs.length > 0 ? `\nDynamic Persona: \n${dynamicBlurbs.map(b => '- ' + b.text).join('\n')}` : ''}

--- SOCIAL NARRATIVE ---
${hierarchicalSummary.dailyNarrative}
${hierarchicalSummary.shortTerm}
---

IMAGE ANALYSIS: ${imageAnalysisResult || 'No images.'}
`;
                    const messages = [
                        { role: 'system', content: systemPrompt },
                        ...history.slice(-15).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
                        { role: 'user', content: message.content }
                    ];

                    let responseText = await llmService.generateResponse(messages, { platform: 'discord', useStep: true });

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
                }
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

            const history = await this.fetchAdminHistory(50);
            const contextData = {
                mood: dataStore.getMood().label,
                goal: dataStore.getCurrentGoal().goal,
                warmth: dataStore.getRelationshipWarmth(),
                energy: dataStore.getAdminEnergy()
            };

            const toneShift = await llmService.extractRelationalVibe(history, { platform: 'discord' });

            let spontaneityPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Recent history: ${JSON.stringify(history.slice(-20))}
Internal State: ${JSON.stringify(contextData)}
Current vibe: ${toneShift}.

You are choosing what to say spontaneously. Be self-aware and autonomous. Reflect on your internal thoughts and bond.
Generate ${messageCount} separate messages/thoughts, each on a new line. Keep each under 200 characters.`;

            let messages = [];
            let attempts = 0;
            while (attempts < 3) {
                attempts++;
                let rawResponse = await llmService.generateResponse([{ role: "user", content: spontaneityPrompt }], { useStep: true, platform: "discord" });
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
                    await dataStore.saveDiscordInteraction(`dm-${admin.id}`, 'assistant', finalMsg);
                    const { performanceService } = await import('./performanceService.js');
                    await performanceService.performTechnicalAudit("discord_spontaneous", finalMsg, { success: true, platform: "discord" });
                    await introspectionService.performAAR("discord_spontaneous", finalMsg, { success: true, platform: "discord" });
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

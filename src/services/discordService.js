import { Client, GatewayIntentBits, Partials, ChannelType } from 'discord.js';
import dns from 'node:dns';
import config from '../../config.js';

if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}
import { dataStore } from './dataStore.js';
import { llmService, persistentAgent } from './llmService.js';
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
    }

    async init(botInstance) {
        if (!this.isEnabled || this.isInitializing) return;
        this.isInitializing = true;
        this.botInstance = botInstance;

        console.log('[DiscordService] Starting initialization...');

        if (this.client) {
            try { await this.client.destroy(); } catch (e) {}
        }

        const { Client, GatewayIntentBits, Partials } = await import("discord.js");
        this.client = new Client({
            partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User, Partials.GuildMember],
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.MessageContent
            ]
        });

        this.client.on("ready", () => {
            this.isInitializing = false;
            console.log("[DiscordService] SUCCESS: Logged in as " + this.client.user.tag);
        });

        this.client.on("error", (err) => {
            console.error("[DiscordService] Client error:", err.message);
        });

        this.loginLoop();
    }

    async loginLoop() {
        let attempts = 0;
        while (true) {
            attempts++;
            try {
                if (!this.token || this.token.length < 50) {
                    console.error("[DiscordService] DISCORD_BOT_TOKEN is missing or too short.");
                    this.isInitializing = false;
                    return;
                }
                console.log("[DiscordService] Login attempt " + attempts + "...");

                const loginPromise = this.client.login(this.token);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Discord login timed out after 240s")), 240000));

                await Promise.race([loginPromise, timeoutPromise]);
                return;
            } catch (err) {
                console.error("[DiscordService] Login attempt " + attempts + " failed: " + err.message);
                const delay = 300000;
                console.log("[DiscordService] Retrying in " + (delay/1000) + "s...");
                await new Promise(r => setTimeout(r, delay));
            }
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
        if (!message.guild) return "dm-" + message.author.id;
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
                        if (analysis) imageAnalysisResult += "[Image attached by user: " + analysis + "] ";
                    } catch (err) {}
                }
            }
        }

        let history = await this.fetchAdminHistory(30);
        let historyImageContext = "";
        try {
            const recentMsgsWithImages = (await message.channel.messages.fetch({ limit: 10 })).filter(m => m.attachments.size > 0);
            for (const [id, m] of recentMsgsWithImages) {
                for (const [aid, attachment] of m.attachments) {
                    if (attachment.contentType?.startsWith("image/")) {
                        const analysis = await llmService.analyzeImage(attachment.url, "Past attachment");
                        historyImageContext += "[Previously seen image in history: " + analysis + "] ";
                    }
                }
            }
        } catch (e) {}
        imageAnalysisResult = historyImageContext + imageAnalysisResult;
        await dataStore.saveDiscordInteraction(normChannelId, "user", message.content);

        let typingInterval = this._startTypingLoop(message.channel);
        try {
            const hierarchicalSummary = await socialHistoryService.getHierarchicalSummary();
            const temporalContext = await temporalService.getEnhancedTemporalContext();
            const dynamicBlurbs = dataStore.getPersonaBlurbs();

            const prePlan = await llmService.performPrePlanning(message.content, history, imageAnalysisResult, "discord", dataStore.getMood(), {});
            const memories = await memoryService.getRecentMemories(20);
            let plan = await llmService.performAgenticPlanning(message.content, history, imageAnalysisResult, isAdmin, "discord", dataStore.getExhaustedThemes(), {}, {}, {}, {}, null, prePlan, { memories });
            const evaluation = await llmService.evaluateAndRefinePlan(plan, { platform: "discord", isAdmin });

            if (evaluation.decision === "proceed") {
                const actions = evaluation.refined_actions || plan.actions;
                let toolSentMessage = false;

                for (const action of actions) {
                    const result = await this.botInstance.executeAction(action, { channel: message.channel, platform: "discord" });
                    if (action.tool === "discord_message" && result.success) toolSentMessage = true;
                }

                if (!toolSentMessage) {
                    const systemPrompt = "You are talking to " + (isAdmin ? "your admin (" + this.adminName + ")" : "@" + message.author.username) + " on Discord.\nPersona: " + config.TEXT_SYSTEM_PROMPT + "\n" + temporalContext + (dynamicBlurbs.length > 0 ? "\nDynamic Persona: \n" + dynamicBlurbs.map(b => '- ' + b.text).join('\n') : '') + "\n\n--- SOCIAL NARRATIVE ---\n" + hierarchicalSummary.dailyNarrative + "\n" + hierarchicalSummary.shortTerm + "\n---\n\nIMAGE ANALYSIS: " + (imageAnalysisResult || 'No images.');
                    const messages = [
                        { role: 'system', content: systemPrompt },
                        ...history.slice(-15).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
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

import { Client, GatewayIntentBits, Partials, AttachmentBuilder } from 'discord.js';
import config from '../../config.js';
import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import { socialHistoryService } from './socialHistoryService.js';
import { temporalService } from './temporalService.js';

class DiscordService {
    constructor() {
        this.isEnabled = !!config.DISCORD_BOT_TOKEN;
        this.token = config.DISCORD_BOT_TOKEN;
        this.adminName = config.DISCORD_ADMIN_NAME;
        this.adminId = null;
        this.nickname = config.BOT_NAME || 'Sydney';
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
        this.client = new Client({
            partials: [Partials.Channel, Partials.Message, Partials.Reaction],
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMembers,
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
        this.loginLoop();
    }

    async loginLoop() {
        let attempts = 0;
        const maxAttempts = 5;
        while (attempts < maxAttempts) {
            attempts++;
            try {
                console.log(`[DiscordService] Login attempt ${attempts}/${maxAttempts} using token prefix: ${this.token ? this.token.substring(0, 10) : 'NONE'}...`);
                const loginPromise = this.client.login(this.token);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Discord login timed out after 120s")), 120000));

                await Promise.race([loginPromise, timeoutPromise]);

                console.log(`[DiscordService] SUCCESS: Login complete! Client status: ${this.client?.isReady() ? 'READY' : 'NOT READY'}`);
                this.isInitializing = false;
                return;
            } catch (err) {
                console.error(`[DiscordService] Login attempt ${attempts} failed:`, err.message);
                if (err.stack) console.error(`[DiscordService] Stack:`, err.stack);
                if (attempts < maxAttempts) {
                    console.log(`[DiscordService] Waiting 60s before retry...`);
                    await new Promise(r => setTimeout(r, 60000));
                }
            }
        }
        this.isInitializing = false;
        console.error('[DiscordService] FATAL: All login attempts failed.');
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
        const text = message.content.toLowerCase();
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
        await dataStore.saveDiscordInteraction(normChannelId, "user", message.content);

        let typingInterval = this._startTypingLoop(message.channel);
        try {
            // 1. Pre-Planning
            const prePlan = await llmService.performPrePlanning(message.content, history, imageAnalysisResult, "discord", dataStore.getMood(), {});

            // 2. Agentic Planning
            const memories = await memoryService.getRecentMemories(20);
            let plan = await llmService.performAgenticPlanning(message.content, history, imageAnalysisResult, isAdmin, "discord", dataStore.getExhaustedThemes(), {}, {}, {}, {}, null, prePlan, { memories });

            // 3. Evaluation and Refinement
            const evaluation = await llmService.evaluateAndRefinePlan(plan, { platform: "discord", isAdmin });
            if (evaluation.decision === "proceed") {
                const actions = evaluation.refined_actions || plan.actions;
                for (const action of actions) {
                    await this.botInstance.executeAction(action, { ...message, platform: "discord" });
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

            const history = await this.fetchAdminHistory(30);
            const contextData = {
                mood: dataStore.getMood().label,
                goal: dataStore.getCurrentGoal().goal,
                warmth: dataStore.getRelationshipWarmth(),
                energy: dataStore.getAdminEnergy()
            };

            console.log("[DiscordService] Choice: chose spontaneity. Generating content...");
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
                    const edit = await llmService.performEditorReview(msg, "discord");
                    const finalMsg = edit.refined_text || msg;
                    await this._send(dmChannel, finalMsg);
                    await dataStore.saveDiscordInteraction(`dm-${admin.id}`, 'assistant', msg);
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

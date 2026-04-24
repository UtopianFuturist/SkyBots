import sys

file_path = 'src/services/discordService.js'

# The goal is to ensure the respond() method is fully implemented and correctly called.
# I will rewrite the respond method to ensure it has all the requested features.

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
        this.token = config.DISCORD_BOT_TOKEN?.trim().replace(/['"]/g, '').replace(/[\\u200B-\\u200D\\uFEFF]/g, '');
        this.adminName = config.DISCORD_ADMIN_NAME;
        this.adminId = null;
        this.nickname = config.BOT_NAME || 'Bot';
        this.respondingChannels = new Set();
        this.client = null;
        this.botInstance = null;
        this.isInitializing = false;
        this._lastHeavyAdminSearch = 0;
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
            rest: {
                timeout: 60000,
                retries: 5
            }
        });

        client.on('ready', () => {
            console.log(`[DiscordService] SUCCESS: Logged in as ${client.user.tag}`);
            client.user.setActivity('the currents', { type: 'LISTENING' });
        });

        client.on('debug', m => {
            if (m.includes('Session Limit') || m.includes('Heartbeat') || m.includes('Identified') || m.includes('Ready') || m.includes('gateway')) {
                console.log(`[DiscordService] [DEBUG] ${m}`);
            }
        });

        client.on('error', e => console.error(`[DiscordService] [ERROR] ${e.message}`, e));
        client.on('warn', w => console.warn(`[DiscordService] [WARN] ${w}`));

        client.on('shardReady', (id) => console.log(`[DiscordService] [SHARD ${id}] READY`));
        client.on('shardError', (e, id) => console.error(`[DiscordService] [SHARD ${id} ERROR] ${e.message}`));
        client.on('shardDisconnect', (e, id) => {
            console.warn(`[DiscordService] [SHARD ${id} DISCONNECT] \${e?.message || 'Unknown'}`);
            if (this.isInitializing) {
                console.log('[DiscordService] Disconnected during initialization. Will retry...');
            }
        });
        client.on('shardReconnecting', id => console.log(`[DiscordService] [SHARD ${id} RECONNECTING...]`));
        client.on('shardResume', (id, replayed) => console.log(`[DiscordService] [SHARD ${id}] RESUMED (replayed \${replayed} events)`));

        client.on('invalidated', () => {
            console.error('[DiscordService] Session invalidated. Triggering re-initialization...');
            if (!this.isInitializing) {
                this.isInitializing = true;
                setTimeout(() => this.loginLoop(), 5000);
            }
        });

        client.on('messageCreate', async (message) => {
            try {
                await this.handleMessage(message);
            } catch (err) {
                console.error('[DiscordService] Error in messageCreate listener:', err);
            }
        });

        return client;
    }

    async _checkConnectivity() {
        try {
            console.log('[DiscordService] Pre-flight connectivity check...');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch('https://discord.com', { method: 'HEAD',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok || response.status === 429) {
                console.log(`[DiscordService] Connectivity check PASSED (Status: \${response.status})`);
                return true;
            } else {
                console.warn(`[DiscordService] Connectivity check returned status: \${response.status}`);
                return false;
            }
        } catch (err) {
            console.error('[DiscordService] Connectivity check FAILED:', err.message);
            return false;
        }
    }

    async _checkInternalServices() {
        try {
            console.log('[DiscordService] Checking internal service health...');
            const llmHealth = await llmService.generateResponse([{ role: 'user', content: 'healthcheck' }], { temperature: 0, max_tokens: 1, useStep: true }).catch(() => null);
            const dbHealth = dataStore.getMood() ? true : false;
            if (llmHealth && dbHealth) {
                console.log('[DiscordService] Internal services are HEALTHY');
                return true;
            } else {
                console.warn('[DiscordService] Internal services check FAILED', { llm: !!llmHealth, db: dbHealth });
                return false;
            }
        } catch (err) {
            console.error('[DiscordService] Health check error:', err.message);
            return false;
        }
    }

    async loginLoop() {
        if (!this.token) {
            console.error('[DiscordService] No token found in config.');
            this.isInitializing = false;
            return;
        }

        while (true) {
            const attemptWindowMs = 10 * 60 * 1000;
            const startTime = Date.now();
            let attemptCount = 0;

            console.log(`[DiscordService] Starting a new 10-minute login window...`);

            const hasConnectivity = await this._checkConnectivity();
            if (hasConnectivity) {
                const servicesHealthy = await this._checkInternalServices();
                if (!servicesHealthy) {
                    console.error('[DiscordService] Internal services not ready. Waiting...');
                    await new Promise(r => setTimeout(r, 60000));
                    continue;
                }
            }
            if (!hasConnectivity) {
                console.error('[DiscordService] No connectivity to Discord API. Waiting for cooldown...');
                await new Promise(r => setTimeout(r, 5 * 60 * 1000));
                continue;
            }

            while (Date.now() - startTime < attemptWindowMs) {
                attemptCount++;
                try {
                    if (this.client) {
                        try {
                            console.log('[DiscordService] Hard-resetting client state...');
                            this.client.removeAllListeners();
                            await this.client.destroy();
                        } catch (e) {
                            console.warn('[DiscordService] Error during client cleanup:', e.message);
                        }
                        this.client = null;
                    }

                    console.log(`[DiscordService] Login attempt \${attemptCount} (Elapsed: \${Math.round((Date.now() - startTime) / 1000)}s)...`);
                    this.client = this._createClient();

                    await new Promise((resolve, reject) => {
                        const individualTimeout = setTimeout(() => {
                            reject(new Error("Individual login attempt timed out after 300s"));
                        }, 300000);

                        this.client.once('ready', () => {
                            clearTimeout(individualTimeout);
                            resolve();
                        });

                        this.client.login(this.token).catch(err => {
                            clearTimeout(individualTimeout);
                            reject(err);
                        });
                    });

                    console.log(`[DiscordService] SUCCESS: Login complete! Bot User: \${this.client.user.tag}`);
                    this.isInitializing = false;
                    return;
                } catch (err) {
                    console.error(`[DiscordService] Login attempt \${attemptCount} failed with error:`, err);
                    if (err.message && err.message.includes('TOKEN_INVALID')) {
                        console.error('[DiscordService] FATAL: Invalid token provided. Stopping login loop.');
                        this.isInitializing = false;
                        return;
                    }
                    if (err.code) console.log(`[DiscordService] Error Code: \${err.code}`);
                    if (err.status) console.log(`[DiscordService] HTTP Status: \${err.status}`);

                    const backoff = Math.min(30000 * attemptCount, 60000);
                    const remainingWindow = attemptWindowMs - (Date.now() - startTime);
                    if (remainingWindow > backoff) {
                        console.log(`[DiscordService] Waiting \${backoff / 1000}s before next attempt within window...`);
                        await new Promise(r => setTimeout(r, backoff));
                    } else {
                        break;
                    }
                }
            }

            console.error(`[DiscordService] 10-minute login window exhausted. Waiting 15 minutes before restarting loop...`);
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
            console.log(`[DiscordService] Triggering response for message from \${message.author.username}: \${text.substring(0, 50)}...`);
            await this.respond(message);
        } else {
            console.log(`[DiscordService] Ignoring message from \${message.author.username} (not mentioned/DM)`);
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
        if (!message.guild) return `dm-\${message.author.id}`;
        return message.channel.id;
    }

    async respond(message) {
        const channelId = message.channel.id;
        if (this.respondingChannels.has(channelId)) {
            console.log(`[DiscordService] Already responding in channel \${channelId}. Skipping.`);
            return;
        }

        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
        this.respondingChannels.add(channelId);
        const typingInterval = this._startTypingLoop(message.channel);

        try {
            let imageAnalysisResult = "";
            if (message.attachments.size > 0) {
                console.log(`[DiscordService] Processing \${message.attachments.size} attachments...`);
                for (const [id, attachment] of message.attachments) {
                    try {
                        const analysis = await llmService.analyzeImage(attachment.url, "User attachment");
                        if (analysis) {
                            console.log(`[DiscordService] Vision Analysis: \${analysis.substring(0, 100)}...`);
                            imageAnalysisResult += `[Image attached by user: \${analysis}] `;
                        }
                    } catch (err) {
                        console.error("[DiscordService] Vision analysis failed:", err.message);
                    }
                }
            }

            const history = await this.fetchChannelHistory(message.channel, 15);
            const temporalContext = await temporalService.getEnhancedTemporalContext();
            const dynamicBlurbs = dataStore.getPersonaBlurbs();

            const systemPrompt = "You are talking to " + (isAdmin ? "your admin (" + this.adminName + ")" : "@" + message.author.username) + " on Discord.\\nPersona: " + config.TEXT_SYSTEM_PROMPT + "\\n" + temporalContext + (dynamicBlurbs.length > 0 ? "\\nDynamic Persona: \\n" + dynamicBlurbs.map(b => '- ' + b.text).join('\\n') : '') + "\\n\\nIMAGE ANALYSIS: " + (imageAnalysisResult || 'No images.');

            const messages = [
                { role: 'system', content: systemPrompt },
                ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
                { role: 'user', content: message.content }
            ];

            console.log("[DiscordService] Generating plan...");
            const plan = await llmService.performPrePlanning(messages, { platform: "discord", isAdmin });

            console.log("[DiscordService] Evaluating plan...");
            const evaluation = await llmService.evaluateAndRefinePlan(plan, { platform: "discord", isAdmin });

            const actions = (evaluation.decision === "proceed" ? (evaluation.refined_actions || plan.actions) : []) || [];
            const toolActions = actions.filter(a => a.tool !== 'respond_to_user');
            const responseAction = actions.find(a => a.tool === 'respond_to_user');

            if (toolActions.length > 0) {
                console.log(`[DiscordService] Executing \${toolActions.length} tool actions.`);
                for (const action of toolActions) {
                    await this.botInstance.executeAction(action, { channel: message.channel, author: message.author, platform: "discord" });
                }
            }

            let finalResponse = "";
            if (responseAction?.parameters?.text) {
                finalResponse = responseAction.parameters.text;
            } else {
                console.log("[DiscordService] No explicit response tool found. Generating conversational reply...");
                finalResponse = await llmService.generateResponse(messages, { platform: "discord" });
            }

            if (finalResponse) {
                const mainMsg = await this._send(message.channel, finalResponse);
                if (mainMsg && isAdmin && (finalResponse.toLowerCase().includes("remember") || finalResponse.toLowerCase().includes("important"))) {
                    try { await mainMsg.pin(); } catch (e) {}
                }
            } else {
                console.log("[DiscordService] Failed to generate any response.");
            }
        } catch (error) {
            console.error("[DiscordService] Error in respond():", error);
        } finally {
            this._stopTypingLoop(typingInterval);
            this.respondingChannels.delete(channelId);
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

            let spontaneityPrompt = "Adopt persona: " + config.TEXT_SYSTEM_PROMPT + "\\nRecent history: " + JSON.stringify(history.slice(-20)) + "\\nInternal State: " + JSON.stringify(contextData) + ".\\n\\nYou are choosing what to say spontaneously. Be self-aware and autonomous.\\nGenerate " + messageCount + " separate messages/thoughts, each on a new line. Keep each under 200 characters.";

            let rawResponse = await llmService.generateResponse([{ role: "user", content: spontaneityPrompt }], { useStep: true, platform: "discord" });
            if (!rawResponse) return;

            let candidateMessages = rawResponse.split('\\n').filter(m => m.trim().length > 0).slice(0, messageCount);
            for (const msg of candidateMessages) {
                const audit = await llmService.performRealityAudit(msg, {}, { history });
                const readyMsg = audit.refined_text;
                const edit = await llmService.performEditorReview(readyMsg, "discord");
                const finalMsg = edit.refined_text || readyMsg;

                await this._send(dmChannel, finalMsg);
                await dataStore.saveDiscordInteraction("dm-" + admin.id, 'assistant', finalMsg);
                await introspectionService.performAAR("discord_spontaneous", finalMsg, { success: true, platform: "discord" });

                if (candidateMessages.length > 1) await new Promise(r => setTimeout(r, 2000));
            }
        } catch (err) {
            console.error("[DiscordService] Spontaneous error:", err);
        }
    }

    async getAdminUser() {
        if (!this.client?.isReady()) return null;
        if (this.adminId) {
            try {
                return await this.client.users.fetch(this.adminId);
            } catch (e) {
                this.adminId = null;
            }
        }

        const cachedUser = this.client.users.cache.find(u => u.username === this.adminName);
        if (cachedUser) {
            this.adminId = cachedUser.id;
            return cachedUser;
        }

        for (const guild of this.client.guilds.cache.values()) {
            const member = guild.members.cache.find(m => m.user.username === this.adminName);
            if (member) {
                this.adminId = member.user.id;
                return member.user;
            }
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
        } catch (e) {
            console.error(`[DiscordService] Error fetching history for channel \${channel.id}:`, e.message);
            return [];
        }
    }

    get status() { return this.isEnabled && this.client?.isReady() ? "online" : "offline"; }
}

export const discordService = new DiscordService();"""

with open(file_path, 'w') as f:
    f.write(content)
print("Restored DiscordService with full respond() implementation and all requested features")

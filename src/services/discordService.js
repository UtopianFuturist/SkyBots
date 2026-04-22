import { Client, GatewayIntentBits, Partials, AttachmentBuilder } from 'discord.js';
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
        this.token = config.DISCORD_BOT_TOKEN?.trim().replace(/['"]/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '');
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
        // Most stable config for Render environments
        const client = new Client({
            partials: [Partials.Channel, Partials.Message],
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.MessageContent
            ],
            // Hardcode some rest options that help with proxy/timeout issues
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
            console.warn(`[DiscordService] [SHARD ${id} DISCONNECT] ${e?.message || 'Unknown'}`);
            // If we disconnect during init, we might need a push
            if (this.isInitializing) {
                console.log('[DiscordService] Disconnected during initialization. Will retry...');
            }
        });
        client.on('shardReconnecting', id => console.log(`[DiscordService] [SHARD ${id} RECONNECTING...]`));
        client.on('shardResume', (id, replayed) => console.log(`[DiscordService] [SHARD ${id}] RESUMED (replayed ${replayed} events)`));

        client.on('invalidated', () => {
            console.error('[DiscordService] Session invalidated. Token might be compromised or session was forcefully closed.');
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

    async loginLoop() {
        if (!this.token) {
            console.error('[DiscordService] No token found in config.');
            this.isInitializing = false;
            return;
        }

        while (true) {
            const attemptWindowMs = 10 * 60 * 1000; // 10 minutes
            const startTime = Date.now();
            let attemptCount = 0;

            console.log(`[DiscordService] Starting a new 10-minute login window...`);

            while (Date.now() - startTime < attemptWindowMs) {
                attemptCount++;
                try {
                    if (this.client) {
                        try {
                            console.log('[DiscordService] Destroying existing client before retry...');
                            await this.client.destroy();
                        } catch (e) {
                            console.warn('[DiscordService] Error destroying client:', e.message);
                        }
                        this.client = null;
                    }

                    console.log(`[DiscordService] Login attempt ${attemptCount} (Elapsed: ${Math.round((Date.now() - startTime) / 1000)}s)...`);
                    this.client = this._createClient();

                    // Wrap login in a promise with a 2-minute individual timeout
                    await new Promise((resolve, reject) => {
                        const individualTimeout = setTimeout(() => {
                            reject(new Error("Individual login attempt timed out after 120s"));
                        }, 120000);

                        this.client.once('ready', () => {
                            clearTimeout(individualTimeout);
                            resolve();
                        });

                        this.client.login(this.token).catch(err => {
                            clearTimeout(individualTimeout);
                            reject(err);
                        });
                    });

                    console.log(`[DiscordService] SUCCESS: Login complete! Bot User: ${this.client.user.tag}`);
                    this.isInitializing = false;
                    return;
                } catch (err) {
                    console.error(`[DiscordService] Login attempt ${attemptCount} failed with error:`, err);

                    if (err.message && err.message.includes('TOKEN_INVALID')) {
                        console.error('[DiscordService] FATAL: Invalid token provided. Stopping login loop.');
                        this.isInitializing = false;
                        return;
                    }

                    // Log more context if it's a common error
                    if (err.code) console.log(`[DiscordService] Error Code: ${err.code}`);
                    if (err.status) console.log(`[DiscordService] HTTP Status: ${err.status}`);

                    const backoff = Math.min(30000 * attemptCount, 60000); // Backoff up to 1 min
                    const remainingWindow = attemptWindowMs - (Date.now() - startTime);

                    if (remainingWindow > backoff) {
                        console.log(`[DiscordService] Waiting ${backoff / 1000}s before next attempt within window...`);
                        await new Promise(r => setTimeout(r, backoff));
                    } else {
                        break; // Not enough time left in window for another attempt
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
            console.log(`[DiscordService] Triggering response for message from ${message.author.username}: ${text.substring(0, 50)}...`);
            await this.respond(message);
        } else {
            console.log(`[DiscordService] Ignoring message from ${message.author.username} (not mentioned/DM)`);
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
        const channelId = message.channel.id;
        if (this.respondingChannels.has(channelId)) {
            console.log(`[DiscordService] Already responding in channel ${channelId}. Skipping.`);
            return;
        }
        
        const text = message.content.toLowerCase();
        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
        this.respondingChannels.add(channelId);
        const normChannelId = this.getNormalizedChannelId(message);
        let imageAnalysisResult = "";
        
        const typingInterval = this._startTypingLoop(message.channel);

        try {
            if (message.attachments.size > 0) {
                console.log(`[DiscordService] Processing ${message.attachments.size} attachments...`);
                for (const [id, attachment] of message.attachments) {
                    try {
                        const analysis = await llmService.analyzeImage(attachment.url, "User attachment");
                        if (analysis) {
                            console.log(`[DiscordService] Vision Analysis: ${analysis.substring(0, 100)}...`);
                            imageAnalysisResult += `[Image attached by user: ${analysis}] `;
                        }
                    } catch (err) {
                        console.error("[DiscordService] Vision analysis failed:", err.message);
                    }
                }
            }

            const history = await this.fetchChannelHistory(message.channel, 15);
            const temporalContext = await temporalService.getEnhancedTemporalContext();
            const hierarchicalSummary = await socialHistoryService.getHierarchicalSummary();
            const dynamicBlurbs = dataStore.getPersonaBlurbs();

            const systemPrompt = "You are talking to " + (isAdmin ? "your admin (" + this.adminName + ")" : "@" + message.author.username) + " on Discord.\nPersona: " + config.TEXT_SYSTEM_PROMPT + "\n" + temporalContext + (dynamicBlurbs.length > 0 ? "\nDynamic Persona: \n" + dynamicBlurbs.map(b => '- ' + b.text).join('\n') : '') + "\n\n--- SOCIAL NARRATIVE ---\n" + (hierarchicalSummary.dailyNarrative || "") + "\n" + (hierarchicalSummary.shortTerm || "") + "\n---\n\nIMAGE ANALYSIS: " + (imageAnalysisResult || 'No images.');
            
            const messages = [
                { role: 'system', content: systemPrompt },
                ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
                { role: 'user', content: message.content }
            ];

            console.log("[DiscordService] Generating plan...");
            const plan = await llmService.performPrePlanning(messages, { platform: "discord", isAdmin });
            
            console.log("[DiscordService] Evaluating plan...");
            const evaluation = await llmService.evaluateAndRefinePlan(plan, { platform: "discord", isAdmin });
            
            // Check if there are any specific tool-based actions planned
            const actions = (evaluation.decision === "proceed" ? (evaluation.refined_actions || plan.actions) : []) || [];
            
            // Filter out 'respond_to_user' from the tool execution if it's the only action, 
            // or handle it explicitly.
            const toolActions = actions.filter(a => a.tool !== 'respond_to_user');
            const responseAction = actions.find(a => a.tool === 'respond_to_user');

            if (toolActions.length > 0) {
                console.log(`[DiscordService] Executing ${toolActions.length} tool actions.`);
                for (const action of toolActions) {
                    await this.botInstance.executeAction(action, { channel: message.channel, author: message.author, platform: "discord" });
                }
            }

            // Always ensure a text response is sent
            let finalResponse = "";
            if (responseAction?.parameters?.text) {
                finalResponse = responseAction.parameters.text;
            } else {
                console.log("[DiscordService] No explicit response tool found. Generating conversational reply...");
                finalResponse = await llmService.generateResponse(messages, { platform: "discord" });
            }

            if (finalResponse) {
                await this._send(message.channel, finalResponse);
            } else {
                console.log("[DiscordService] Failed to generate any response.");
            }
        } catch (error) {
            console.error("[DiscordService] Error in respond():", error);
            // Attempt a simple fallback response on error
            try {
                const fallbackRes = await llmService.generateResponse([{ role: 'user', content: message.content }], { platform: "discord" });
                if (fallbackRes) await this._send(message.channel, fallbackRes);
            } catch (e) {}
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

            const toneShift = await llmService.extractRelationalVibe(history, { platform: 'discord' });

            let spontaneityPrompt = "Adopt persona: " + config.TEXT_SYSTEM_PROMPT + "\nRecent history: " + JSON.stringify(history.slice(-20)) + "\nInternal State: " + JSON.stringify(contextData) + "\nCurrent vibe: " + toneShift + ".\n\nYou are choosing what to say spontaneously. Be self-aware and autonomous. Reflect on your internal thoughts and bond.\nGenerate " + messageCount + " separate messages/thoughts, each on a new line. Keep each under 200 characters.";

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
        if (this.adminId) {
            try {
                return await this.client.users.fetch(this.adminId);
            } catch (e) {
                this.adminId = null;
            }
        }

        // Search in cache first
        const cachedUser = this.client.users.cache.find(u => u.username === this.adminName);
        if (cachedUser) {
            this.adminId = cachedUser.id;
            return cachedUser;
        }

        // If not in cache, we might have to wait for them to message us or find them in a guild we can access
        // Since we don't have GuildMembers intent, we can't fetch all members.
        // We will try to find the admin by iterating through visible users in guilds
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
            console.error(`[DiscordService] Error fetching history for channel ${channel.id}:`, e.message);
            return [];
        }
    }

    get status() { return this.isEnabled && this.client?.isReady() ? "online" : "offline"; }
}

export const discordService = new DiscordService();

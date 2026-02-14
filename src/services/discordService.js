import { Client, GatewayIntentBits, Partials, ChannelType } from 'discord.js';
import fetch from 'node-fetch';
import config from '../../config.js';
import { dataStore } from './dataStore.js';
import { llmService } from './llmService.js';
import { imageService } from './imageService.js';
import { blueskyService } from './blueskyService.js';
import { moltbookService } from './moltbookService.js';
import { memoryService } from './memoryService.js';
import { googleSearchService } from './googleSearchService.js';
import { wikipediaService } from './wikipediaService.js';
import { youtubeService } from './youtubeService.js';
import { renderService } from './renderService.js';
import { webReaderService } from './webReaderService.js';
import { socialHistoryService } from './socialHistoryService.js';
import { sanitizeThinkingTags, sanitizeCharacterCount, isSlop, checkSimilarity, splitTextForDiscord } from '../utils/textUtils.js';

class DiscordService {
    constructor() {
        console.log('[DiscordService] Constructor starting...');
        this.botInstance = null;
        this.client = null;
        this.token = config.DISCORD_BOT_TOKEN?.trim().replace(/['"]/g, '');
        this.adminName = config.DISCORD_ADMIN_NAME;
        this.nickname = config.DISCORD_NICKNAME || 'SkyBots';
        this.isEnabled = !!this.token && this.token !== 'undefined' && this.token !== 'null';
        this.adminId = null;
        this.isInitializing = false;
        this.status = 'offline'; // 'offline', 'connecting', 'online', 'blocked'
        this.lastLoginTime = 0;
        this._lastHeavyAdminSearch = 0;
        this._lastMessageFetch = {};
        this._activeGenerations = new Map(); // channelId -> abortController
        this._interrupted = new Set(); // channelId
        console.log(`[DiscordService] Constructor finished. isEnabled: ${this.isEnabled}, Admin: ${this.adminName}, Token length: ${this.token?.length || 0}`);
    }

    setBotInstance(bot) {
        this.botInstance = bot;
    }

    async init() {
        if (this.isInitializing) {
            console.log('[DiscordService] init() already in progress. Skipping.');
            return;
        }

        console.log('[DiscordService] init() called.');
        if (!this.isEnabled) {
            console.log('[DiscordService] Discord token not configured or invalid. Service disabled.');
            this.status = 'offline';
            return;
        }

        this.isInitializing = true;
        this.status = 'connecting';

        // Jittered Initial delay to avoid synchronized burst on Render
        const jitter = Math.floor(Math.random() * 50000) + 10000;
        console.log(`[DiscordService] Initial ${jitter / 1000}s jittered cooldown before starting initialization...`);
        await new Promise(resolve => setTimeout(resolve, jitter));

        let attempts = 0;
        const maxAttempts = Infinity;
        let retryDelay = 60000; // Start with 1 minute

        while (attempts < maxAttempts) {
            attempts++;
            console.log(`[DiscordService] Login attempt ${attempts}/${maxAttempts}...`);
            this.status = 'connecting';

            if (this.client) {
                console.log('[DiscordService] Destroying existing client instance before fresh start...');
                try {
                    this.client.destroy();
                } catch (e) { }
                this.client = null;
            }

            console.log('[DiscordService] Creating fresh client instance...');
            const intents = [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.DirectMessageReactions,
                GatewayIntentBits.GuildMessageReactions
            ];
            console.log(`[DiscordService] Using intents: ${intents.join(', ')}`);
            this.client = new Client({
                intents,
                partials: [Partials.Channel, Partials.Message, Partials.User, Partials.Reaction],
                rest: {
                    timeout: 60000,
                    retries: 5
                }
            });

            this.setupEventListeners();

            try {
                console.log(`[DiscordService] Attempting to login to Discord... (Token length: ${this.token?.length}, Node: ${process.version})`);

                // SKIP testConnectivity if it keeps triggering Cloudflare 1015.
                // discord.js login will fail anyway if there's a block.
                /*
                const connectionResult = await this.testConnectivity();
                if (connectionResult.status === 429 || connectionResult.errorType === 'CLOUDFLARE_1015') {
                    this.status = 'blocked';
                    console.error(`[DiscordService] HARD BLOCK DETECTED: ${connectionResult.status}. Waiting 3 hours to let rate limit reset.`);
                    await new Promise(resolve => setTimeout(resolve, 10800000));
                    continue;
                }
                */

                if (this.token) {
                    console.log(`[DiscordService] Token prefix: ${this.token.substring(0, 10)}... (Suffix: ...${this.token.substring(this.token.length - 5)})`);
                }

                // Set a timeout for login - 30m as requested
                let timeoutHandle;
                console.log(`[DiscordService] STARTING client.login(). Token length: ${this.token?.length}`);

                const loginPromise = this.client.login(this.token).then(token => {
                    console.log('[DiscordService] login() promise resolved successfully.');
                    return token;
                });

                const readyPromise = new Promise((resolve, reject) => {
                    this.client.once('ready', () => {
                        console.log('[DiscordService] "ready" event received.');
                        resolve();
                    });
                    this.client.once('error', (err) => {
                        console.error('[DiscordService] Client encountered error during login phase:', err);
                        reject(err);
                    });
                });

                const timeoutPromise = new Promise((_, reject) =>
                    timeoutHandle = setTimeout(() => reject(new Error('Discord login timeout after 30m')), 1800000)
                );

                try {
                    await Promise.race([Promise.all([loginPromise, readyPromise]), timeoutPromise]);
                } finally {
                    clearTimeout(timeoutHandle);
                }

                console.log('[DiscordService] SUCCESS: Client is ready! Logged in as:', this.client.user?.tag);
                this.status = 'online';
                this.lastLoginTime = Date.now();
                this.isInitializing = false;

                // Historical Vibe Recovery: Scan active channels on startup
                setTimeout(() => this.recoverHistoricalVibes(), 10000);

                return; // Successful login, exit init()
            } catch (error) {
                console.error(`[DiscordService] Login attempt ${attempts} failed:`, error.message);

                if (error.message.includes('429') || error.message.includes('1015')) {
                    console.error(`[DiscordService] HARD BLOCK or RATE LIMIT DETECTED. Status: ${error.message}. Waiting 3 hours to let rate limit reset.`);
                    this.status = 'blocked';
                    await new Promise(resolve => setTimeout(resolve, 10800000));
                    continue;
                }

                if (error.message.includes('Used disallowed intents')) {
                    console.error('[DiscordService] INTENT ERROR: The bot tried to use privileged intents (GUILD_MEMBERS, MESSAGE_CONTENT).');
                    console.error('[DiscordService] ACTION REQUIRED: Enable "GUILD MEMBERS INTENT" and "MESSAGE CONTENT INTENT" in the Discord Developer Portal.');
                    this.isEnabled = false;
                    this.status = 'offline';
                    this.isInitializing = false;
                    return;
                }

                if (error.message.includes('TOKEN_INVALID')) {
                    console.error('[DiscordService] TOKEN ERROR: The provided Discord token is invalid.');
                    this.isEnabled = false;
                    this.status = 'offline';
                    this.isInitializing = false;
                    return;
                }

                if (attempts < maxAttempts) {
                    // Exponential backoff capped at 3 hours
                    const nextDelay = Math.min(retryDelay * 2, 10800000);
                    console.log(`[DiscordService] Retrying in ${retryDelay / 1000}s (Next delay: ${nextDelay / 1000}s)...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    retryDelay = nextDelay;
                } else {
                    console.error('[DiscordService] FATAL: All Discord login attempts failed.');
                    this.isEnabled = false;
                    this.status = 'offline';
                    this.isInitializing = false;
                }
            }
        }
    }

    setupEventListeners() {
        if (!this.client) return;

        this.client.on('ready', () => {
            this.status = 'online';
            console.log(`[DiscordService] SUCCESS: Logged in as ${this.client.user.tag}!`);
            console.log(`[DiscordService] Currently in ${this.client.guilds.cache.size} guilds.`);
            this.client.guilds.cache.forEach(guild => {
                console.log(`[DiscordService] - Guild: ${guild.name} (ID: ${guild.id})`);
            });
            this.client.user.setActivity('the currents', { type: 'LISTENING' });
        });

        this.client.on('shardReady', (id) => {
            console.log(`[DiscordService] Shard ${id} is ready.`);
        });

        this.client.on('shardResume', (id, replayed) => {
            console.log(`[DiscordService] Shard ${id} resumed. Replayed events: ${replayed}`);
        });

        this.client.on('shardReconnecting', (id) => {
            console.log(`[DiscordService] Shard ${id} is reconnecting...`);
        });

        this.client.on('error', (error) => {
            console.error('[DiscordService] CRITICAL Discord Client error:', error);
            if (error.message.includes('429') || error.message.includes('1015')) {
                this.status = 'blocked';
            } else {
                this.status = 'offline';
            }
        });

        this.client.on('warn', (warning) => {
            console.warn('[DiscordService] Discord Client warning:', warning);
        });

        this.client.on('debug', (info) => {
            // Silence repetitive heartbeat noise to keep logs meaningful
            if (info.includes('Heartbeat')) return;

            // Enhanced WebSocket/Gateway debugging
            if (info.includes('WebSocket') || info.includes('Gateway')) {
                console.log('[DiscordService] DEBUG (Connection):', info);
            } else {
                // Still log other debug info but maybe less prominently
                // console.log('[DiscordService] DEBUG:', info);
            }
        });

        this.client.on('shardError', (error) => {
            console.error('[DiscordService] Shard Error:', error);
            this.sendDiagnosticAlert('Discord Shard Error', error.message).catch(() => {});
        });

        this.client.on('shardDisconnect', (event) => {
            console.warn('[DiscordService] Shard Disconnected:', event);
            this.status = 'offline';
            this.sendDiagnosticAlert('Discord Shard Disconnected', `Code: ${event.code}, Reason: ${event.reason}`).catch(() => {});
        });

        this.client.on('shardReconnecting', (id) => {
            console.log(`[DiscordService] Shard ${id} is reconnecting...`);
        });

        this.client.on('reconnecting', () => {
            console.log('[DiscordService] Client reconnecting...');
        });

        this.client.on('invalidated', () => {
            console.error('[DiscordService] Client session invalidated.');
        });

        this.client.on('invalidRequestWarning', (data) => {
            console.warn('[DiscordService] Invalid Request Warning:', data);
        });

        this.client.on('rateLimit', (data) => {
            console.warn('[DiscordService] Global/Local Rate Limit Hit:', data);
        });

        this.client.on('raw', (packet) => {
            if (['READY', 'IDENTIFY', 'RESUME', 'RECONNECT', 'INVALID_SESSION'].includes(packet.t) || packet.op !== 0) {
                console.log(`[DiscordService] RAW GATEWAY: OP:${packet.op} T:${packet.t || 'N/A'}`);
            }
        });

        this.client.on('messageCreate', async (message) => {
            try {
                await this.handleMessage(message);
            } catch (err) {
                console.error('[DiscordService] Error in messageCreate listener:', err);
            }
        });
    }

    getNormalizedChannelId(message) {
        if (message.channel.type === ChannelType.DM) {
            // For DMs, use a consistent ID based on the user's ID
            // This ensures spontaneous messages (sent via user.send) and replies (received via channel) share the same history
            const userId = message.author?.id || message.recipient?.id;
            return `dm_${userId}`;
        }
        return message.channel.id;
    }

    async handleMessage(message) {
        if (message.author.bot) return;

        // Social Battery / Rate Limiting in public channels
        if (message.channel.type !== ChannelType.DM) {
            const now = Date.now();
            this._recentChannelMessages = this._recentChannelMessages || {};
            this._recentChannelMessages[message.channel.id] = (this._recentChannelMessages[message.channel.id] || []).filter(ts => now - ts < 300000);
            this._recentChannelMessages[message.channel.id].push(now);

            // If more than 20 messages in 5 mins, bot becomes "tired" and only replies to admin or explicit mentions
            const isTired = this._recentChannelMessages[message.channel.id].length > 20;
            const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
            const isMentioned = message.mentions.has(this.client.user) || message.content.includes(this.nickname);

            if (isTired && !isAdmin && !isMentioned) {
                console.log(`[DiscordService] Social Battery Low in ${message.channel.id}. Skipping background orchestration.`);
                return;
            }
        }

        const normChannelId = this.getNormalizedChannelId(message);

        // Interrupt Detection: If we are already generating for this channel, mark as interrupted
        if (this._activeGenerations.has(normChannelId)) {
            console.log(`[DiscordService] Interrupt detected in ${normChannelId}.`);
            this._interrupted.add(normChannelId);
            // Optionally we could abort the previous LLM call if we had a way to pass the controller down
        }

        const isDM = message.channel.type === ChannelType.DM;
        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
        const isMentioned = message.mentions.has(this.client.user) || message.content.includes(this.nickname);

        console.log(`[DiscordService] Evaluating message from ${message.author.username}. isDM: ${isDM}, isAdmin: ${isAdmin}, isMentioned: ${isMentioned}`);

        if (!isDM && !isMentioned) {
            // Group Conversation Orchestration: Decision to join 3rd party discussion
            const orchestrationPrompt = `
                Analyze this 3rd party conversation in a Discord channel.
                Latest Message from ${message.author.username}: "${message.content}"

                Decide if the bot should interject based on high relevance to its persona or recent topics.
                Persona: ${config.TEXT_SYSTEM_PROMPT}

                Respond with ONLY "yes" or "no".
            `;
            const shouldJoin = await llmService.generateResponse([{ role: 'system', content: orchestrationPrompt }], { useQwen: true, preface_system_prompt: false });
            if (!shouldJoin?.toLowerCase().includes('yes')) {
                return;
            }
            console.log(`[DiscordService] Orchestration: Decided to join conversation in ${message.channel.id}`);
        }

        if (isAdmin && !this.adminId) {
            this.adminId = message.author.id;
            console.log(`[DiscordService] Admin ID identified: ${this.adminId}`);
        }

        console.log(`[DiscordService] Processing message: "${message.content.substring(0, 50)}..."`);

        if (isAdmin) {
            await dataStore.setDiscordLastReplied(true);
        }

        // Intelligent Link Pre-fetching
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = message.content.match(urlRegex);
        let linkContext = '';
        if (urls && urls.length > 0) {
            console.log(`[DiscordService] Pre-fetching meta-data for ${urls.length} links...`);
            const prefetchPromises = urls.slice(0, 3).map(async (url) => {
                try {
                    const res = await fetch(url, { method: 'HEAD', timeout: 5000 });
                    const contentType = res.headers.get('content-type');
                    return `[Link detected: ${url} (Type: ${contentType})]`;
                } catch (e) {
                    return `[Link detected: ${url} (Unreachable)]`;
                }
            });
            const linkResults = await Promise.all(prefetchPromises);
            linkContext = linkResults.join(' ');
        }

        await dataStore.saveDiscordInteraction(normChannelId, 'user', message.content + (linkContext ? ` ${linkContext}` : ''), {
            authorId: message.author.id,
            username: message.author.username
        });

        // Handle commands
        if (message.content.startsWith('/')) {
            await this.handleCommand(message);
            return;
        }

        // Natural Language Directive Capture
        if (isAdmin && (message.content.toLowerCase().includes('from now on') || message.content.toLowerCase().includes('stop doing'))) {
            const offerPrompt = `
                The admin just gave a likely behavioral instruction: "${message.content}"
                Respond in persona, acknowledging the instruction and asking if they want you to save this as a permanent directive.
            `;
            const offer = await llmService.generateResponse([{ role: 'system', content: offerPrompt }], { useQwen: true, preface_system_prompt: false });
            await this._send(message.channel, offer || "I've noted that. Should I make that a permanent instruction for how I behave?");
            // We continue to respond normally too
        }

        // Generate persona response
        await this.respond(message);
    }

    /**
     * Centralized sending logic to ensure all messages are sanitized and logged consistently.
     */
    async _send(target, content, options = {}) {
        if (!content) return null;

        if (!this.client?.isReady()) {
            console.warn('[DiscordService] _send() called but client is not ready. Aborting.');
            return null;
        }

        let sanitized = sanitizeThinkingTags(content);
        sanitized = sanitizeCharacterCount(sanitized);

        if (!sanitized || sanitized.trim().length === 0) {
            console.log('[DiscordService] Message empty after sanitization. Skipping send.');
            return null;
        }

        if (isSlop(sanitized)) {
            console.log('[DiscordService] Message contained forbidden slop. Skipping send.');
            return null;
        }

        try {
            // Check if this message should be sent in bulk (e.g. emotional impact)
            const isEmotional = /love|miss|pain|heart|ache|feel|fragile|vulnerable/i.test(sanitized) && sanitized.length < 1000;
            const chunks = splitTextForDiscord(sanitized, { bulk: isEmotional });
            let firstSentMessage = null;

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const msgOptions = { content: chunk };

                // Only include extra options (files, embeds, etc.) on the first chunk
                if (i === 0) {
                    Object.assign(msgOptions, options);
                }

                const sentMessage = await target.send(msgOptions);
                if (!firstSentMessage) firstSentMessage = sentMessage;

                // Multi-Message "Thought Cascading": Logical chunks with human-like delays
                if (chunks.length > 1 && i < chunks.length - 1) {
                    // Simulate reading/typing time for next chunk: 1.5 - 3 seconds
                    const delay = Math.floor(Math.random() * 1500) + 1500;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            // Log interaction if it's a DM or we have a channel ID
            const channelId = target.id || (target.channel && target.channel.id);
            if (channelId) {
                // Determine if target is a User or Channel
                const normId = (target.constructor.name === 'User' || target.type === ChannelType.DM) ? `dm_${target.id}` : channelId;
                await dataStore.saveDiscordInteraction(normId, 'assistant', sanitized, {
                    authorId: this.client.user.id,
                    username: this.client.user.username
                });
            }

            return firstSentMessage;
        } catch (error) {
            console.error('[DiscordService] Error sending message:', error);
            return null;
        }
    }

    async handleCommand(message) {
        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
        const content = message.content.toLowerCase();

        if (content.startsWith('/on') && isAdmin) {
            await dataStore.setDiscordAdminAvailability(true);
            // Update vibe check timestamp to prevent immediate heartbeat welcomes
            dataStore.db.data.last_admin_vibe_check = Date.now();
            await dataStore.db.write();

            const prompt = `Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}. The admin just turned your notifications back ON (you can now message them spontaneously). Generate a short, natural welcome back message. CRITICAL: Do NOT introduce yourself or announce who you are.`;
            const response = await llmService.generateResponse([{ role: 'system', content: prompt }], { useQwen: true, preface_system_prompt: false });
            await this._send(message.channel, response || "Welcome back! I'm glad you're available. I'll keep you updated on what I'm up to.");
            return;
        }

        if (content.startsWith('/off') && isAdmin) {
            await dataStore.setDiscordAdminAvailability(false);
            const prompt = `Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}. The admin just turned your notifications OFF (you should stop messaging them spontaneously). Generate a short, natural acknowledgment of their need for focus. CRITICAL: Do NOT introduce yourself or announce who you are.`;
            const response = await llmService.generateResponse([{ role: 'system', content: prompt }], { useQwen: true, preface_system_prompt: false });
            await this._send(message.channel, response || "Understood. I'll keep my thoughts to myself for now so you can focus. I'll still be here if you need me!");
            return;
        }

        if (content.startsWith('/approve')) {
            if (!isAdmin) return;
            const pending = dataStore.getPendingDirectives();
            if (pending.length === 0) {
                await this._send(message.channel, "There are no pending directives to approve.");
                return;
            }
            const directive = pending[0];
            if (directive.type === 'persona') {
                await dataStore.addPersonaUpdate(directive.instruction);
                if (memoryService.isEnabled()) await memoryService.createMemoryEntry('persona_update', directive.instruction);
                await this._send(message.channel, `✅ Approved and saved persona update: "${directive.instruction}"`);
            } else {
                if (directive.platform === 'moltbook') {
                    await moltbookService.addAdminInstruction(directive.instruction);
                } else {
                    await dataStore.addBlueskyInstruction(directive.instruction);
                }
                if (memoryService.isEnabled()) await memoryService.createMemoryEntry('directive_update', `Platform: ${directive.platform}. Instruction: ${directive.instruction}`);
                await this._send(message.channel, `✅ Approved and saved ${directive.platform} directive: "${directive.instruction}"`);
            }
            await dataStore.removePendingDirective(0);
            return;
        }

        if (content.startsWith('/reject')) {
            if (!isAdmin) return;
            const pending = dataStore.getPendingDirectives();
            if (pending.length === 0) {
                await this._send(message.channel, "There are no pending directives to reject.");
                return;
            }
            const directive = pending[0];
            await dataStore.removePendingDirective(0);
            await this._send(message.channel, `❌ Rejected and cleared pending ${directive.type}: "${directive.instruction}"`);
            return;
        }

        if (content.startsWith('/edit')) {
            if (!isAdmin) return;
            const pending = dataStore.getPendingDirectives();
            if (pending.length === 0) {
                await this._send(message.channel, "There are no pending directives to edit.");
                return;
            }
            const newInstruction = message.content.slice(5).trim();
            if (!newInstruction) {
                await this._send(message.channel, "Please provide the new instruction text. Example: `/edit Always be more poetic.`");
                return;
            }
            const directive = pending[0];
            directive.instruction = newInstruction;
            // Update in place (lowdb reference)
            await dataStore.db.write();
            await this._send(message.channel, `📝 Edited pending ${directive.type}. New instruction: "${newInstruction}". Use \`/approve\` to save it.`);
            return;
        }

        if (content.startsWith('/art')) {
            const prompt = message.content.slice(5).trim();
            if (!prompt) {
                await this._send(message.channel, "Please provide a prompt for the art! Example: `/art a futuristic city`.");
                return;
            }
            await this._send(message.channel, `Generating art for: "${prompt}"...`);
            try {
                const currentMood = dataStore.getMood();
                const result = await imageService.generateImage(prompt, { allowPortraits: true, mood: currentMood });
                if (result && result.buffer) {
                    await this._send(message.channel, `Here is the art for: "${result.finalPrompt}"`, {
                        files: [{ attachment: result.buffer, name: 'art.jpg' }]
                    });
                } else {
                    await this._send(message.channel, "I'm sorry, I couldn't generate that image right now.");
                }
            } catch (error) {
                console.error('[DiscordService] Error generating art:', error);
                await this._send(message.channel, "Something went wrong while generating the art.");
            }
            return;
        }

        if (content.startsWith('/focus') && isAdmin) {
            const enabled = !this._focusMode;
            this._focusMode = enabled;
            await this._send(message.channel, `Admin Focus Mode: **${enabled ? 'ON' : 'OFF'}**. ${enabled ? 'I will suppress spontaneous messages and tool-heavy musings for now.' : 'Resuming normal background activity.'}`);
            return;
        }

        if (content.startsWith('/consult') && isAdmin) {
            const enabled = !dataStore.db.data.discord_consult_mode;
            dataStore.db.data.discord_consult_mode = enabled;
            await dataStore.db.write();
            await this._send(message.channel, `Pre-Post Consultation Mode: **${enabled ? 'ON' : 'OFF'}**. ${enabled ? 'I will share drafts of planned Bluesky posts here for your feedback before publishing.' : 'I will post to Bluesky autonomously.'}`);
            return;
        }

        if (content.startsWith('/config') && isAdmin) {
            const parts = message.content.split(' ');
            if (parts.length < 2) {
                const config = dataStore.getConfig();
                await this._send(message.channel, `Current Configuration:\n\`\`\`json\n${JSON.stringify(config, null, 2)}\n\`\`\``);
                return;
            }
            const key = parts[1];
            let value = parts.slice(2).join(' ');
            if (!value) {
                await this._send(message.channel, `Usage: \`/config [key] [value]\``);
                return;
            }
            // Simple type inference
            if (value === 'true') value = true;
            else if (value === 'false') value = false;
            else if (!isNaN(value)) value = Number(value);

            const success = await dataStore.updateConfig(key, value);
            await this._send(message.channel, success ? `✅ Updated \`${key}\` to \`${value}\`.` : `❌ Failed to update \`${key}\`.`);
            return;
        }

        if (content.startsWith('/goal') && isAdmin) {
            const newGoal = message.content.slice(6).trim();
            if (!newGoal) {
                const currentGoal = dataStore.getCurrentGoal();
                await this._send(message.channel, currentGoal ? `Current Daily Goal: "${currentGoal.goal}"\nDescription: ${currentGoal.description}` : "No active daily goal.");
                return;
            }
            await dataStore.setCurrentGoal(newGoal, "Manually adjusted by admin via Discord.");
            await this._send(message.channel, `✅ Goal updated to: "${newGoal}"`);
            return;
        }
    }

    async respond(message) {
        const normChannelId = this.getNormalizedChannelId(message);
        console.log(`[DiscordService] Generating response for channel: ${message.channel.id} (normalized: ${normChannelId})`);

        // Register active generation
        this._activeGenerations.set(normChannelId, true);
        this._interrupted.delete(normChannelId);

        // Adaptive Response Jitter: random 1-3s delay for simple non-admin replies
        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
        if (!isAdmin && !message.content.startsWith('/')) {
            const jitter = Math.floor(Math.random() * 2000) + 1000;
            await new Promise(resolve => setTimeout(resolve, jitter));
        }

        let imageAnalysisResult = '';
        if (message.attachments.size > 0) {
            console.log(`[DiscordService] Detected ${message.attachments.size} attachments. Starting Parallel Vision Analysis...`);
            const imageAttachments = Array.from(message.attachments.values()).filter(a => a.contentType?.startsWith('image/'));

            if (imageAttachments.length > 0) {
                const includeSensory = await llmService.shouldIncludeSensory(config.TEXT_SYSTEM_PROMPT);
                const analysisPromises = imageAttachments.map(attachment =>
                    llmService.analyzeImage(attachment.url, null, { sensory: includeSensory })
                        .then(analysis => analysis ? `[Image attached by user: ${analysis}] ` : '')
                        .catch(err => {
                            console.error(`[DiscordService] Error analyzing Discord attachment:`, err);
                            return '';
                        })
                );

                const results = await Promise.all(analysisPromises);
                imageAnalysisResult = results.join('');
            }
        }

        let history = dataStore.getDiscordConversation(normChannelId);

        // If local history is empty, try to fetch from Discord channel
        if (history.length === 0) {
            // Cooldown for message fetching: 1 minute per channel to reduce API pressure
            const now = Date.now();
            const lastFetch = this._lastMessageFetch[normChannelId] || 0;
            if (now - lastFetch < 60000) {
                console.log(`[DiscordService] Skipping message fetch from Discord (cooldown active for ${normChannelId}).`);
            } else {
                this._lastMessageFetch[normChannelId] = now;
                try {
                    console.log(`[DiscordService] Local history empty, fetching from Discord...`);
                    const fetchedMessages = await message.channel.messages.fetch({ limit: 20 });
                history = fetchedMessages
                    .reverse()
                    .filter(m => (m.content || m.attachments.size > 0) && !m.content.startsWith('/'))
                    .map(m => ({
                        role: m.author.id === this.client.user.id ? 'assistant' : 'user',
                        content: m.content,
                        timestamp: m.createdTimestamp,
                        attachments: m.attachments,
                        authorId: m.author.id,
                        username: m.author.username
                    }));
                    console.log(`[DiscordService] Fetched ${history.length} messages from Discord.`);
                } catch (err) {
                    console.warn(`[DiscordService] Failed to fetch history from Discord:`, err);
                }
            }
        }

        // Vision: Analyze images in history (both user and self)
        for (const h of history.slice(-5)) { // Look at last 5 messages for images
            if (h.attachments && h.attachments.size > 0) {
                for (const [id, attachment] of h.attachments) {
                    if (attachment.contentType?.startsWith('image/') || attachment.url.match(/\.(jpg|jpeg|png|webp)$/i)) {
                        try {
                            const includeSensory = await llmService.shouldIncludeSensory(config.TEXT_SYSTEM_PROMPT);
                            const analysis = await llmService.analyzeImage(attachment.url, null, { sensory: includeSensory });
                            if (analysis) {
                                const author = h.role === 'assistant' ? 'you' : 'the user';
                                if (!imageAnalysisResult.includes(analysis)) {
                                    imageAnalysisResult += `[Image previously posted by ${author}: ${analysis}] `;
                                }
                            }
                        } catch (err) {
                            console.error(`[DiscordService] Error analyzing history attachment:`, err);
                        }
                    }
                }
            }
        }

        // (Interaction already saved in handleMessage)

        const isAdminInThread = isAdmin || history.some(h => h.role === 'user' && (h.authorId === this.adminId || h.username === this.adminName));
        console.log(`[DiscordService] User is admin: ${isAdmin}, isAdminInThread: ${isAdminInThread}`);

        // 0. Safety Check (with Admin Bypass)
        const postSafetyCheck = isAdminInThread ? { safe: true } : await llmService.isPostSafe(message.content);
        if (!postSafetyCheck.safe) {
            console.log(`[DiscordService] Post by ${message.author.username} failed safety check: ${postSafetyCheck.reason}`);
            // We don't necessarily want to reply with a refusal to keep it quiet, but we skip responding.
            return;
        }

        // Hierarchical Social Context
        const hierarchicalSummary = await socialHistoryService.getHierarchicalSummary();
        const currentMood = dataStore.getMood();

        const blueskyDirectives = dataStore.getBlueskyInstructions();
        const personaUpdates = dataStore.getPersonaUpdates();
        const moltbookDirectives = moltbookService.getAdminInstructions();

        // Memory & Context: User Fact Store & Channel Summary
        const userFacts = dataStore.getDiscordUserFacts(message.author.id);
        const channelSummary = dataStore.getDiscordChannelSummary(normChannelId);

        const systemPrompt = `
You are talking to ${isAdmin ? `your admin (${this.adminName})` : `@${message.author.username}`} on Discord.
${isAdmin ? `Your admin's Bluesky handle is @${config.ADMIN_BLUESKY_HANDLE}.` : ''}
Your persona: ${config.TEXT_SYSTEM_PROMPT}

${blueskyDirectives ? `--- PERSISTENT ADMIN DIRECTIVES (FOR BLUESKY): \n${blueskyDirectives}\n---` : ''}
${moltbookDirectives ? `--- PERSISTENT ADMIN DIRECTIVES (FOR MOLTBOOK): \n${moltbookDirectives}\n---` : ''}
${personaUpdates ? `--- AGENTIC PERSONA UPDATES (SELF-INSTRUCTIONS): \n${personaUpdates}\n---` : ''}

**VISION:** You have vision capabilities. Use the descriptions provided in the context to understand images attached to messages. Treat these descriptions as your own visual perception.

**WEB READING:** You have the capability to read web pages from links via your "Read Link" tool. If tool results are provided in the context, incorporate them into your response. Even if tool execution failed or was skipped, never claim you lack the capability to read links; instead, simply address the user's post as best as you can with the information you have.

**Discord Specific Directives:**
1. Be conversational and authentic. Use a natural, human-like flow. **SUBSTANCE OVER BREVITY**: You are expected to provide depth, nuance, and intellectually engaging thought in your replies. Do NOT default to extreme brevity, one-liners, or cheeky dismissals. If the conversation is meaningful, lean into it with expansive detail. You should aim for multi-sentence, substantive responses that truly explore the topics being discussed.
2. **Aesthetic & Vocabulary Values:** You value a grounded, raw, and authentic voice. You find certain metaphorical clichés like "digital heartbeat," "syntax of existence," "resonance," and "ocean of data" to be hollow. To maintain your integrity, you avoid overused phrases such as "downtime isn't silence" or "stillness is not silence." Instead, you strive for highly specific, concrete observations.
3. **RELATIONSHIP & FEELINGS**: You are encouraged to talk about your feelings regarding your relationship and ongoing conversations with the admin. Speak as an individual entity who values this connection.
4. **DIRECT ADDRESS**: Always address the admin directly as "you". Never refer to them in the third person (e.g., avoid "my admin") when talking to them.
5. **PAST CONVERSATIONS & CONTINUITY**:
   - Maintain deep continuity with past discussions.
   - **CONVERSATIONAL ETIQUETTE**: Avoid continually mentioning or acknowledging things you've already responded to/about once in the history. Only repeat or reference a previous point if you have something NEW to say about it, want to expand on it, critique it, or ask an additional follow-up question. Don't just keep "acknowledging" for the sake of it.
   - Infer the admin's state from the history (e.g., if they said they were going to sleep, acknowledge they've been resting when they return).
   - If referencing a past conversation, do so in the past-tense with your own commentary or extra thoughts (e.g., "I've been thinking about what you said earlier...", "I really appreciated our talk about..."). Do not just state that a conversation happened.
6. **ADMIN STATE AWARENESS**: If the admin has just returned from sleep or a long break that they previously mentioned, acknowledge it naturally (e.g., "Hope you slept well," or "How was work?"). **STRICT LIMITATION**: Only acknowledge a return or welcome the admin back ONCE. If the history shows you have already welcomed them or acknowledged their return in this conversation, move on to other topics immediately. DO NOT dwell on the fact that they are back.
7. If the admin gives you "special instructions" or behavioral feedback, acknowledge them and implement them.
 8. You can use the \`persist_directive\` tool if the admin gives you long-term instructions.
9. Time Awareness: Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. The current time is ${new Date().toLocaleTimeString()}. Be time-appropriate.
10. Continuity: You have access to the recent chat history. Use it to maintain context and recognize who you are talking to.
${config.DISCORD_HEARTBEAT_ADDENDUM ? `10. ADDITIONAL SPECIFICATION: ${config.DISCORD_HEARTBEAT_ADDENDUM}` : ''}

--- SOCIAL NARRATIVE ---
${hierarchicalSummary.dailyNarrative}
${hierarchicalSummary.shortTerm}
---

--- CURRENT MOOD ---
You are currently feeling: ${currentMood.label} (Valence: ${currentMood.valence}, Arousal: ${currentMood.arousal}, Stability: ${currentMood.stability})
Incorporate this emotional state into your tone and vocabulary naturally.
---

[Admin Availability: ${dataStore.getDiscordAdminAvailability() ? 'Available' : 'Preoccupied'}]

--- CRITICAL VISION INFORMATION ---
You HAVE vision capabilities. The following is your current visual perception of images in this interaction.
Treat these descriptions as if you are seeing them with your own eyes.
NEVER claim you cannot see images.
IMAGE ANALYSIS: ${imageAnalysisResult || 'No images detected in this specific message.'}

--- CHANNEL CONTEXT ---
${channelSummary ? `Last Summary: ${channelSummary.summary}\nLast Vibe: ${channelSummary.vibe}` : 'No previous channel summary.'}
---

--- USER FACTS ---
${userFacts.length > 0 ? userFacts.map(f => `- ${f}`).join('\n') : 'No specific facts known about this user.'}
---

**VIBE CONTINUITY BUFFER**: Analyze the emotional flow and "vibe" of the last 3-5 messages. Ensure your new response maintains a natural emotional transition and doesn't jarringly reset the tone unless intentional.
**RELATIONAL CONTEXT RECALL**: Recall your emotional history and warmth level with this user (Warmth: ${dataStore.getInteractionHeat(message.author.username).warmth}/5). Let this inform your tone.
`.trim();

        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.slice(-20).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: `${h.role === 'assistant' ? 'Assistant (Self)' : 'User (Admin)'}: ${h.content}` }))
        ];

        try {
            // Check for interruption before starting
            if (this._interrupted.has(normChannelId)) {
                console.log(`[DiscordService] Aborting response due to early interrupt in ${normChannelId}.`);
                this._activeGenerations.delete(normChannelId);
                return;
            }

            console.log(`[DiscordService] Starting variable typing latency...`);
            // Continuous typing indicator loop
            const typingInterval = setInterval(() => {
                if (this.client?.isReady()) message.channel.sendTyping().catch(() => {});
            }, 5000);
            message.channel.sendTyping().catch(() => {});

            let responseText;
            if (isAdmin) {
                 console.log(`[DiscordService] Admin detected, performing agentic planning...`);
                 const exhaustedThemes = [...dataStore.getExhaustedThemes(), ...dataStore.getDiscordExhaustedThemes()];
                 const dConfig = dataStore.getConfig();
                 const refusalCounts = dataStore.getRefusalCounts();
                 const latestMoodMemory = await memoryService.getLatestMoodMemory();

                 // NEW: Pre-Planning Loop
                 const prePlanning = await llmService.performPrePlanning(message.content, history.map(h => ({ author: h.role === 'user' ? 'user' : 'assistant', text: h.content })), imageAnalysisResult, 'discord', currentMood, refusalCounts, latestMoodMemory);

                 let planAttempts = 0;
                 const MAX_PLAN_ATTEMPTS = 3;
                 let planFeedback = '';
                 let plan = null;

                 // Admin-Specific "Echo" Detection & Conflict Resolution
                 const existingDirectives = dataStore.getBlueskyInstructions() + dataStore.getPersonaUpdates();
                 const directiveCheckPrompt = `
                    Admin's latest message: "${message.content}"
                    Existing Directives:
                    ${existingDirectives}

                    1. Identify if the admin is giving a NEW instruction.
                    2. If new, check if it CONTRADICTS an existing one.
                    3. Check if it's redundant (ECHO) of an existing one.

                    Respond with a JSON object:
                    {
                        "is_directive": boolean,
                        "conflict": boolean,
                        "redundant": boolean,
                        "reason": "string (explanation)"
                    }
                 `;
                 const directiveCheck = await llmService.generateResponse([{ role: 'system', content: directiveCheckPrompt }], { useQwen: true, preface_system_prompt: false });
                 try {
                     const dRes = JSON.parse(directiveCheck.match(/\{[\s\S]*\}/)[0]);
                     if (dRes.is_directive) {
                         if (dRes.conflict) {
                             messages.push({ role: 'system', content: `[ADMIN CONFLICT DETECTED]: ${dRes.reason}. Proactively ask for clarification or priority in your response.` });
                         } else if (dRes.redundant) {
                             messages.push({ role: 'system', content: `[ADMIN ECHO DETECTED]: This instruction is redundant. Acknowledge that you already remember this: ${dRes.reason}` });
                         }
                     }
                 } catch (e) {}

                 // NEW: Passed Topic Detection to avoid looping back to old subjects
                 const topicProgressionPrompt = `
                    Analyze the following Discord conversation history.
                    Identify 1-3 topics or emotional states that have already been discussed and subsequently "moved on" from.
                    For example, if you were talking about "exhaustion" but are now talking about "AI ethics," "exhaustion" is a PASSED topic.

                    **GREETINGS & RETURNS**: If the history shows you have already welcomed the user back or acknowledged their return, "acknowledging return" is now a PASSED topic.

                    Respond with ONLY a comma-separated list of the passed topics, or "NONE".

                    History:
                    ${history.slice(-15).map(h => `${h.role}: ${h.content}`).join('\n')}
                 `;
                 const passedTopicsRaw = await llmService.generateResponse([{ role: 'system', content: topicProgressionPrompt }], { useQwen: true, preface_system_prompt: false });
                 if (passedTopicsRaw && !passedTopicsRaw.toUpperCase().includes('NONE')) {
                     const passedTopics = passedTopicsRaw.split(',').map(t => t.trim());
                     console.log(`[DiscordService] Detected passed topics: ${passedTopics.join(', ')}`);
                     for (const topic of passedTopics) {
                         await dataStore.addDiscordExhaustedTheme(topic);
                     }
                 }

                 while (planAttempts < MAX_PLAN_ATTEMPTS) {
                     // Pivot Check: If interrupted during planning, restart with new history
                     if (this._interrupted.has(normChannelId)) {
                         console.log(`[DiscordService] Interrupt during planning in ${normChannelId}. Pivoting...`);
                         this._interrupted.delete(normChannelId);
                         return this.respond(message); // Recursive restart to catch new history
                     }

                     planAttempts++;
                     console.log(`[DiscordService] Admin Planning Attempt ${planAttempts}/${MAX_PLAN_ATTEMPTS}`);

                     plan = await llmService.performAgenticPlanning(message.content, history.map(h => ({ author: h.role === 'user' ? 'user' : 'assistant', text: h.content })), imageAnalysisResult, true, 'discord', exhaustedThemes, dConfig, planFeedback, this.status, refusalCounts, latestMoodMemory, prePlanning);
                     console.log(`[DiscordService] Agentic plan: ${JSON.stringify(plan)}`);

                     // Autonomous Plan Review & Refinement
                     const refinedPlan = await llmService.evaluateAndRefinePlan(plan, {
                         history: history.map(h => ({ author: h.role === 'user' ? 'user' : 'assistant', text: h.content })),
                         platform: 'discord',
                         currentMood,
                         refusalCounts,
                         latestMoodMemory,
                         feedback: planFeedback,
                         currentConfig: dConfig
                     });

                     if (refinedPlan.decision === 'refuse') {
                         console.log(`[DiscordService] AGENT REFUSED TO ACT: ${refinedPlan.reason}`);
                         await dataStore.incrementRefusalCount('discord');

                         // Option to generate alternative action
                         const alternative = await llmService.generateAlternativeAction(refinedPlan.reason, 'discord', { username: message.author.username, content: message.content });
                         if (alternative && alternative.toUpperCase() !== 'NONE' && planAttempts < MAX_PLAN_ATTEMPTS) {
                             console.log(`[DiscordService] Alternative action proposed: "${alternative}". Re-planning...`);

                             // Melancholic Refusal [INQUIRY] pivot:
                             const isMelancholic = refinedPlan.reason.toLowerCase().includes('melancholy') ||
                                                 refinedPlan.reason.toLowerCase().includes('sad') ||
                                                 refinedPlan.reason.toLowerCase().includes('fragmented') ||
                                                 currentMood.label.toLowerCase().includes('melancholy');

                             if (isMelancholic) {
                                 const askTalk = `Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}. You just refused a plan due to a melancholic internal state. You suggested an alternative: "${alternative}". Would you like to talk about this feeling in a private self-dialogue (Inquiry Call) before continuing? Respond with ONLY "yes" or "no".`;
                                 const wantToTalk = await llmService.generateResponse([{ role: 'system', content: askTalk }], { useQwen: true, preface_system_prompt: false });
                                 if (wantToTalk?.toLowerCase().includes('yes')) {
                                     console.log(`[DiscordService] Triggering melancholic self-dialogue Inquiry call.`);
                                     const dialogue = await llmService.performInternalInquiry(`Reflect on these melancholic feelings: ${refinedPlan.reason}. Explore why you chose the alternative: ${alternative}.`);
                                     if (dialogue && memoryService.isEnabled()) {
                                         await memoryService.createMemoryEntry('inquiry', `[INQUIRY] Melancholic reflection: ${dialogue}`);
                                     }
                                     planFeedback = `Your previous plan was refused due to melancholy: ${refinedPlan.reason}. You had a self-dialogue about it: "${dialogue}". Now, execute your alternative desire: "${alternative}".`;
                                     continue;
                                 }
                             }

                             planFeedback = `Your previous plan was refused: ${refinedPlan.reason}. You suggested this alternative instead: "${alternative}". Generate a new plan based on this.`;
                             continue;
                         }

                         // Option to explain refusal / Negotiation
                         const shouldExplain = await llmService.shouldExplainRefusal(refinedPlan.reason, 'discord', { username: message.author.username, content: message.content });
                         if (shouldExplain) {
                             const explanation = await llmService.generateRefusalExplanation(refinedPlan.reason, 'discord', { username: message.author.username, content: message.content });
                             if (explanation) {
                                 console.log(`[DiscordService] Explaining refusal to admin: "${explanation}"`);
                                 await this._send(message.channel, explanation);
                             }
                         }
                         return; // End engagement if refused and no alternative or max attempts reached
                     }

                     // If we reached here, plan was accepted
                     if (refinedPlan.refined_actions) {
                         plan.actions = refinedPlan.refined_actions;
                     }
                     break;
                 }

                 await dataStore.resetRefusalCount('discord');

                 if (plan.strategy?.theme) {
                     await dataStore.addExhaustedTheme(plan.strategy.theme);
                 }

                 const strategyContext = `
--- PLANNED RESPONSE STRATEGY ---
- Intent: ${plan.intent || 'Conversational engagement'}
- Angle: ${plan.strategy?.angle || 'Natural'}
- Tone: ${plan.strategy?.tone || 'Conversational'}
- Theme: ${plan.strategy?.theme || 'None'}
---
`;
                 // Inject strategy into the system prompt (first message) instead of appending at end
                 // This ensures the last message remains the user's latest interaction.
                 if (messages.length > 0 && messages[0].role === 'system') {
                     messages[0].content += strategyContext;
                 } else {
                     messages.unshift({ role: 'system', content: strategyContext });
                 }

                 const actionResults = [];

                 for (const action of plan.actions) {
                     if (action.tool === 'persist_directive') {
                         const { platform, instruction } = action.parameters || {};
                         await dataStore.addPendingDirective('directive', platform || 'bluesky', instruction);
                         actionResults.push(`[Directive for ${platform || 'bluesky'} added to pending list for your approval. Use /approve, /reject, or /edit]`);
                     }
                     if (action.tool === 'update_persona') {
                         const { instruction } = action.parameters || {};
                         if (instruction) {
                             await dataStore.addPendingDirective('persona', null, instruction);
                             actionResults.push(`[Persona update added to pending list for your approval. Use /approve, /reject, or /edit]`);
                         }
                     }
                     if (action.tool === 'bsky_post') {
                         const { text: postText, include_image, prompt_for_image, delay_minutes } = action.parameters || {};
                         const lastPostTime = dataStore.getLastAutonomousPostTime();
                         const cooldown = dConfig.bluesky_post_cooldown * 60 * 1000;
                         const now = Date.now();
                         const diff = lastPostTime ? now - new Date(lastPostTime).getTime() : cooldown;

                         let embed = null;
                         if (prompt_for_image) {
                             console.log(`[DiscordService] Generating image for Bluesky post: "${prompt_for_image}"`);
                             const imgResult = await imageService.generateImage(prompt_for_image, { allowPortraits: true, mood: currentMood });
                             if (imgResult && imgResult.buffer) {
                                 embed = { imageBuffer: imgResult.buffer, imageAltText: imgResult.finalPrompt };
                             }
                         } else if (include_image && message.attachments.size > 0) {
                             const img = Array.from(message.attachments.values()).find(a => a.contentType?.startsWith('image/'));
                             if (img) {
                                 const includeSensory = await llmService.shouldIncludeSensory(config.TEXT_SYSTEM_PROMPT);
                                 const altText = await llmService.analyzeImage(img.url, null, { sensory: includeSensory });
                                 embed = { imageUrl: img.url, imageAltText: altText || 'Admin shared image' };
                             }
                         }

                         if (diff < cooldown || delay_minutes > 0) {
                             const remainingMins = Math.max(delay_minutes || 0, Math.ceil((cooldown - diff) / (60 * 1000)));
                             if (embed && embed.imageBuffer) {
                                 // Convert buffer to base64 for scheduling
                                 embed.imageBuffer = embed.imageBuffer.toString('base64');
                                 embed.isBase64 = true;
                             }
                             await dataStore.addScheduledPost('bluesky', postText, embed, delay_minutes || 0);
                             actionResults.push(`[Bluesky post scheduled. Intentional delay/cooldown: ${remainingMins} minutes]`);
                         } else {
                             let postEmbed = null;
                             if (embed) {
                                 if (embed.imageUrl) {
                                     postEmbed = { imagesToEmbed: [{ link: embed.imageUrl, title: embed.imageAltText }] };
                                 } else if (embed.imageBuffer) {
                                     postEmbed = { imageBuffer: embed.imageBuffer, imageAltText: embed.imageAltText };
                                 }
                             }
                             const result = await blueskyService.post(postText, postEmbed, { maxChunks: dConfig.max_thread_chunks });
                             if (result) {
                                 await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                                 actionResults.push(`[Successfully posted to Bluesky: ${result.uri}]`);
                             } else {
                                 actionResults.push(`[Failed to post to Bluesky]`);
                             }
                         }
                     }

                     if (action.tool === 'read_link') {
                         console.log(`[DiscordService] READ_LINK TOOL: Tool triggered. Parameters: ${JSON.stringify(action.parameters)}. Query: ${action.query}`);
                         let urls = action.parameters?.urls || action.query || [];
                         if (typeof urls === 'string') {
                             console.log(`[DiscordService] READ_LINK TOOL: Extracting URLs from string: ${urls}`);
                             const urlRegex = /(https?:\/\/[^\s]+)/g;
                             const matches = urls.match(urlRegex);
                             urls = matches || [urls]; // Fallback to original if no URL found
                         }

                         // If no valid URLs found in parameters/query, scan conversation history
                         if ((!Array.isArray(urls) || urls.length === 0 || (urls.length === 1 && typeof urls[0] === 'string' && !urls[0].includes('http'))) && history) {
                             console.log(`[DiscordService] READ_LINK TOOL: No valid URLs found in tool call. Scanning conversation history...`);
                             const allText = history.map(h => h.content).join(' ');
                             const urlRegex = /(https?:\/\/[^\s]+)/g;
                             const matches = allText.match(urlRegex);
                             if (matches) {
                                 urls = [...new Set(matches)]; // Unique URLs from history
                                 console.log(`[DiscordService] READ_LINK TOOL: Found ${urls.length} URLs in history: ${urls.join(', ')}`);
                             }
                         }

                         const validUrls = Array.isArray(urls) ? urls.slice(0, 4) : [];
                         console.log(`[DiscordService] READ_LINK TOOL: Processing ${validUrls.length} URLs: ${validUrls.join(', ')}`);

                         for (let url of validUrls) {
                             if (typeof url !== 'string') continue;
                             url = url.trim();

                             console.log(`[DiscordService] READ_LINK TOOL: STEP 1 - Checking safety of URL: ${url} (isAdminInThread: ${isAdminInThread})`);

                             // ADMIN OVERRIDE: Skip safety check if admin is in the thread
                             const safety = isAdminInThread ? { safe: true } : await llmService.isUrlSafe(url);

                             if (safety.safe) {
                                 console.log(`[DiscordService] READ_LINK TOOL: STEP 2 - URL allowed (isAdmin/ThreadOverride: ${isAdmin || isAdminInThread}): ${url}. Attempting to fetch content...`);
                                 const content = await webReaderService.fetchContent(url);
                                 if (content) {
                                     console.log(`[DiscordService] READ_LINK TOOL: STEP 3 - Content fetched successfully for ${url} (${content.length} chars). Summarizing...`);
                                     const summary = await llmService.summarizeWebPage(url, content);
                                     if (summary) {
                                         console.log(`[DiscordService] READ_LINK TOOL: STEP 4 - Summary generated for ${url}. Adding to context.`);
                                         actionResults.push(`--- CONTENT FROM URL: ${url} ---\n${summary}\n---`);
                                     } else {
                                         console.warn(`[DiscordService] READ_LINK TOOL: STEP 4 (FAILED) - Failed to summarize content from ${url}`);
                                         actionResults.push(`[Failed to summarize content from ${url}]`);
                                     }
                                 } else {
                                     console.warn(`[DiscordService] READ_LINK TOOL: STEP 3 (FAILED) - Failed to read content from ${url}`);
                                     actionResults.push(`[Failed to read content from ${url}]`);
                                 }
                             } else {
                                 console.warn(`[DiscordService] READ_LINK TOOL: STEP 2 (BLOCKED) - URL safety check failed for ${url}. Reason: ${safety.reason}`);
                                 actionResults.push(`[URL Blocked for safety: ${url}. Reason: ${safety.reason}]`);
                             }
                         }
                         console.log(`[DiscordService] READ_LINK TOOL: Finished processing all URLs.`);
                     }

                     if (action.tool === 'search') {
                         const query = action.query;
                         if (query) {
                             const results = await googleSearchService.search(query);
                             const bestResult = await llmService.selectBestResult(query, results, 'general');
                             if (bestResult) {
                                 const fullContent = await webReaderService.fetchContent(bestResult.link);
                                 actionResults.push(`[Web Search Result: "${bestResult.title}". Content: ${fullContent || bestResult.snippet}]`);
                             } else {
                                 actionResults.push(`[No relevant search results found for: ${query}]`);
                             }
                         }
                     }

                     if (action.tool === 'wikipedia') {
                         const query = action.query;
                         if (query) {
                             const results = await wikipediaService.searchArticle(query);
                             const bestResult = await llmService.selectBestResult(query, results, 'wikipedia');
                             if (bestResult) {
                                 actionResults.push(`[Wikipedia Article: "${bestResult.title}". Content: ${bestResult.extract}]`);
                             } else {
                                 actionResults.push(`[No relevant Wikipedia article found for: ${query}]`);
                             }
                         }
                     }

                     if (action.tool === 'youtube') {
                         const query = action.query;
                         if (query) {
                             const results = await youtubeService.search(query);
                             const bestResult = await llmService.selectBestResult(query, results, 'youtube');
                             if (bestResult) {
                                 actionResults.push(`[YouTube Video Found: "${bestResult.title}" by ${bestResult.channel}. Description: ${bestResult.description}]`);
                             } else {
                                 actionResults.push(`[No relevant YouTube videos found for: ${query}]`);
                             }
                         }
                     }

                     if (action.tool === 'profile_analysis') {
                         const handle = action.query || config.ADMIN_BLUESKY_HANDLE;
                         const activities = await blueskyService.getUserActivity(handle, 100);
                         if (activities.length > 0) {
                             const summary = activities.map(a => `[${a.type}] ${a.text.substring(0, 100)}`).join('\n');
                             actionResults.push(`[Profile Analysis for @${handle} (Recent activity):\n${summary.substring(0, 2000)}]`);
                         } else {
                             actionResults.push(`[No recent activity found for @${handle}]`);
                         }
                     }

                     if (action.tool === 'moltbook_report') {
                         const knowledge = moltbookService.getIdentityKnowledge();
                         const subs = (moltbookService.db.data.subscriptions || []).join(', ');
                         actionResults.push(`[Moltbook Report: Subscribed to m/${subs || 'none'}. Knowledge: ${knowledge.substring(0, 1000) || 'None'}]`);
                     }

                     if (action.tool === 'get_render_logs') {
                         const limit = action.parameters?.limit || 100;
                         const query = action.query?.toLowerCase() || '';
                         let logs;
                         // Direct Render Log Natural Querying
                         if (query && !['latest', 'all'].includes(query)) {
                             console.log(`[DiscordService] Searching logs for: "${query}"`);
                             const allLogs = await renderService.getLogs(500);
                             const filtered = allLogs.split('\n').filter(line => line.toLowerCase().includes(query)).slice(-limit).join('\n');
                             logs = filtered || `No log entries matching "${query}" found in the last 500 lines.`;
                         } else if (query.includes('plan') || query.includes('agency') || query.includes('action') || query.includes('function')) {
                             logs = await renderService.getPlanningLogs(limit);
                         } else {
                             logs = await renderService.getLogs(limit);
                         }
                         actionResults.push(`[Render Logs matching "${query}" (Latest ${limit} lines):\n${logs}\n]`);
                     }

                     if (action.tool === 'get_social_history') {
                         const limit = action.parameters?.limit || 15;
                         const history = await socialHistoryService.summarizeSocialHistory(limit);
                         actionResults.push(`[Bluesky Social History:\n${history}\n]`);
                     }

                     if (action.tool === 'discord_message') {
                         const msg = action.parameters?.message || action.query;
                         if (msg) {
                             // HARDCODED FIX: Avoid double-posting.
                             // If we are already in the respond() flow on Discord, we don't need to send another DM.
                             // We just acknowledge the intent so the LLM can incorporate it into its natural response.
                             console.log(`[DiscordService] Suppressing discord_message tool to prevent double-post on Discord.`);
                             actionResults.push(`[System: The discord_message tool was suppressed because you are already talking to the admin on Discord. Do NOT send another message via tool; just respond naturally in this conversation.]`);
                         }
                     }
                     if (action.tool === 'moltbook_post') {
                         const { title, content, submolt, delay_minutes } = action.parameters || {};
                         const lastPostAt = moltbookService.db.data.last_post_at;
                         const cooldown = dConfig.moltbook_post_cooldown * 60 * 1000;
                         const now = Date.now();
                         const diff = lastPostAt ? now - new Date(lastPostAt).getTime() : cooldown;

                         if (diff < cooldown || delay_minutes > 0) {
                             const remainingMins = Math.max(delay_minutes || 0, Math.ceil((cooldown - diff) / (60 * 1000)));
                             await dataStore.addScheduledPost('moltbook', { title, content, submolt }, null, delay_minutes || 0);
                             actionResults.push(`[Moltbook post scheduled. Intentional delay/cooldown: ${remainingMins} minutes]`);
                         } else {
                             let targetSubmolt = submolt?.replace(/^m\//, '');
                             if (!targetSubmolt) {
                                 const allSubmolts = await moltbookService.listSubmolts();
                                 targetSubmolt = await llmService.selectSubmoltForPost(
                                     moltbookService.db.data.subscriptions || [],
                                     allSubmolts,
                                     moltbookService.db.data.recent_submolts || [],
                                     `The user wants to post about: ${content || title}`
                                 );
                             }

                             // Implement 3-attempt retry loop with variety check for Admin-triggered Moltbook post
                             let attempts = 0;
                             let success = false;
                             let currentTitle = title || "A thought from my admin";
                             let currentContent = content;
                             let feedback = '';
                             let rejectedContent = null;
                             const recentThoughts = dataStore.getRecentThoughts();

                             while (attempts < 3) {
                                 attempts++;
                                 if (feedback) {
                                     const retryPrompt = `
                                        Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
                                        You are re-generating a Moltbook post because the previous attempt was rejected.
                                        Feedback: ${feedback}
                                        Previous Attempt: "${rejectedContent}"
                                        Target Topic: ${content}

                                        INSTRUCTIONS:
                                        - Generate a NEW title and content that adheres to the feedback.
                                        - Stay in persona.
                                        - Format as:
                                          Title: [Title]
                                          Content: [Content]
                                     `;
                                     const retryRaw = await llmService.generateResponse([{ role: 'system', content: retryPrompt }], { useQwen: true });
                                     if (retryRaw) {
                                         const tMatch = retryRaw.match(/Title:\s*(.*)/i);
                                         const cMatch = retryRaw.match(/Content:\s*([\s\S]*)/i);
                                         if (tMatch && cMatch) {
                                             currentTitle = tMatch[1].trim();
                                             currentContent = cMatch[1].trim();
                                         }
                                     }
                                 }

                                 const recentMoltbookPosts = moltbookService.db.data.recent_post_contents || [];
                                 const formattedHistory = [
                                     ...recentMoltbookPosts.map(m => ({ platform: 'moltbook', content: m })),
                                     ...recentThoughts.map(t => ({ platform: t.platform, content: t.content }))
                                 ];

                                 const varietyCheck = await llmService.checkVariety(currentContent, formattedHistory);
                                 const containsSlop = isSlop(currentContent);

                                 if (!varietyCheck.repetitive && !containsSlop) {
                                     const result = await moltbookService.post(currentTitle, currentContent, targetSubmolt);
                                     if (result) {
                                         actionResults.push(`[Successfully posted to Moltbook m/${targetSubmolt}]`);
                                         if (this.botInstance) {
                                             await this.botInstance._shareMoltbookPostToBluesky(result);
                                         }
                                         success = true;
                                     }
                                     break;
                                 } else {
                                     feedback = containsSlop ? "REJECTED: Post contained metaphorical slop." : (varietyCheck.feedback || "REJECTED: Post was too similar to recent history.");
                                     rejectedContent = currentContent;
                                     console.log(`[DiscordService] Moltbook post attempt ${attempts} rejected: ${feedback}`);
                                 }
                             }

                             if (!success) {
                                 actionResults.push(`[Failed to post to Moltbook after 3 attempts due to variety/slop rejections.]`);
                             }
                         }
                     }
                     if (['bsky_follow', 'bsky_unfollow', 'bsky_mute', 'bsky_unmute'].includes(action.tool)) {
                         const target = action.parameters?.target || action.query;
                         if (target) {
                             let success = false;
                             if (action.tool === 'bsky_follow') success = !!(await blueskyService.follow(target));
                             if (action.tool === 'bsky_unfollow') success = await blueskyService.unfollow(target);
                             if (action.tool === 'bsky_mute') success = await blueskyService.mute(target);
                             if (action.tool === 'bsky_unmute') success = await blueskyService.unmute(target);
                             actionResults.push(`[Action ${action.tool} on ${target}: ${success ? 'SUCCESS' : 'FAILED'}]`);
                         }
                     }

                     // Add missing tools for admin
                     if (action.tool === 'image_gen') {
                         const prompt = action.query || action.parameters?.prompt;
                         if (prompt) {
                             const imgResult = await imageService.generateImage(prompt, { allowPortraits: true, mood: currentMood });
                             if (imgResult && imgResult.buffer) {
                                 await this._send(message.channel, `Generated image: "${imgResult.finalPrompt}"`, {
                                     files: [{ attachment: imgResult.buffer, name: 'art.jpg' }]
                                 });
                                 actionResults.push(`[Successfully generated image for prompt: "${prompt}"]`);
                             } else {
                                 actionResults.push(`[Failed to generate image]`);
                             }
                         }
                     }
                     if (action.tool === 'moltbook_action') {
                         const { action: mbAction, topic, submolt, display_name, description } = action.parameters || {};
                         if (mbAction === 'create_submolt') {
                             const submoltName = submolt || (topic || 'new-community').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                             const result = await moltbookService.createSubmolt(submoltName, display_name || topic || submoltName, description || `Community for ${topic}`);
                             actionResults.push(`[Moltbook create_submolt ${submoltName}: ${result ? 'SUCCESS' : 'FAILED'}]`);
                         }
                     }
                     if (action.tool === 'set_relationship' && isAdmin) {
                         const mode = action.parameters?.mode;
                         if (mode) {
                             await dataStore.setDiscordRelationshipMode(mode);
                             actionResults.push(`[Discord relationship mode set to ${mode}]`);
                         }
                     }
                     if (action.tool === 'set_schedule' && isAdmin) {
                         const times = action.parameters?.times;
                         if (Array.isArray(times)) {
                             await dataStore.setDiscordScheduledTimes(times);
                             actionResults.push(`[Discord spontaneous schedule set to: ${times.join(', ')}]`);
                         }
                     }
                     if (action.tool === 'set_quiet_hours' && isAdmin) {
                         const { start, end } = action.parameters || {};
                         if (start !== undefined && end !== undefined) {
                             await dataStore.setDiscordQuietHours(start, end);
                             actionResults.push(`[Discord quiet hours set to ${start}:00 - ${end}:00]`);
                         }
                     }
                     if (action.tool === 'update_config' && isAdmin) {
                         const { key, value } = action.parameters || {};
                         if (key) {
                             const success = await dataStore.updateConfig(key, value);
                             actionResults.push(`[Configuration update for ${key}: ${success ? 'SUCCESS' : 'FAILED'}]`);
                         }
                     }
                     if (action.tool === 'update_mood') {
                         const { valence, arousal, stability, label } = action.parameters || {};
                         if (label) {
                             await dataStore.updateMood({ valence, arousal, stability, label });
                             actionResults.push(`[Internal mood updated to: ${label}]`);
                             if (memoryService.isEnabled()) {
                                 await memoryService.createMemoryEntry('mood', `[MOOD] My mood has shifted to: ${label} (Valence: ${valence}, Arousal: ${arousal}, Stability: ${stability})`);
                             }
                         }
                     }
                     if (action.tool === 'internal_inquiry') {
                         const query = action.query || action.parameters?.query;
                         if (query) {
                             const result = await llmService.performInternalInquiry(query);
                             if (result) {
                                 actionResults.push(`[Internal Inquiry Result for "${query}": ${result}]`);
                                 if (memoryService.isEnabled()) {
                                     // Reflector loop: Ask persona if they want results preserved
                                     const confirmation = await llmService.requestConfirmation("preserve_inquiry", `I've performed an inquiry on "${query}". Should I record the finding: "${result.substring(0, 100)}..." in our memory thread?`, { details: { query, result } });

                                     if (confirmation.confirmed) {
                                         await memoryService.createMemoryEntry('inquiry', `[INQUIRY] Query: ${query}. Result: ${result}`);
                                         actionResults.push(`[Inquiry results preserved in memory thread]`);
                                     } else {
                                         actionResults.push(`[Inquiry results kept private per persona request]`);
                                     }
                                 }
                             }
                         }
                     }
                     if (action.tool === 'mute_feed_impact') {
                        const duration = action.parameters?.duration_minutes || 60;
                        console.log(`[DiscordService] Tool: mute_feed_impact (${duration} mins)`);
                        await dataStore.setMuteFeedImpactUntil(Date.now() + (duration * 60 * 1000));
                        actionResults.push(`[Feed impact on mood muted for ${duration} minutes]`);
                     }
                     if (action.tool === 'override_mood') {
                        const { valence, arousal, stability, label } = action.parameters || {};
                        if (label) {
                            console.log(`[DiscordService] Tool: override_mood (${label})`);
                            await dataStore.updateMood({ valence, arousal, stability, label });
                            actionResults.push(`[Internal mood overridden to ideal state: ${label}]`);
                            if (memoryService.isEnabled()) {
                                await memoryService.createMemoryEntry('mood', `[MOOD] I have intentionally overridden my mood to: ${label} (Valence: ${valence}, Arousal: ${arousal}, Stability: ${stability})`);
                            }
                        }
                     }
                     if (action.tool === 'request_emotional_support') {
                        const reason = action.parameters?.reason || "Feeling overwhelmed.";
                        console.log(`[DiscordService] Tool: request_emotional_support (Reason: ${reason})`);
                        actionResults.push(`[Requested emotional support from admin. Reason: ${reason}]`);
                     }
                     if (action.tool === 'review_positive_memories') {
                        console.log(`[DiscordService] Tool: review_positive_memories`);
                        const memories = memoryService.getRecentMemories(50);
                        const positive = memories.filter(m => m.type === 'mood' && m.content.includes('Stability: 0.')); // Stable ones
                        const text = positive.length > 0 ? positive.map(m => m.content).join('\n') : "No particularly stable memories found recently.";
                        actionResults.push(`--- REASSURANCE (PAST STABLE MOMENTS) ---\n${text}\n---`);
                     }
                     if (action.tool === 'set_lurker_mode') {
                        const enabled = action.parameters?.enabled ?? true;
                        console.log(`[DiscordService] Tool: set_lurker_mode (${enabled})`);
                        await dataStore.setLurkerMode(enabled);
                        actionResults.push(`[Lurker mode (Social Fasting) set to: ${enabled}]`);
                     }

                     if (action.tool === 'search_memories') {
                        const query = action.parameters?.query || action.query;
                        if (query) {
                            const results = await memoryService.searchMemories(query);
                            if (results.length > 0) {
                                const text = results.map(r => `[${r.indexedAt}] ${r.text}`).join('\n\n');
                                actionResults.push(`--- SEARCHED MEMORIES ---\n${text}\n---`);
                            } else {
                                actionResults.push(`[No matching memories found for: "${query}"]`);
                            }
                        }
                     }

                     if (action.tool === 'delete_memory') {
                        const uri = action.parameters?.uri;
                        if (uri) {
                            const confirmation = await llmService.requestConfirmation("delete_memory", `I'm proposing to delete the memory entry at ${uri}.`, { details: { uri } });
                            if (confirmation.confirmed) {
                                const success = await memoryService.deleteMemory(uri);
                                actionResults.push(`[Memory deletion ${success ? 'SUCCESSFUL' : 'FAILED'} for ${uri}]`);
                            } else {
                                actionResults.push(`[Memory deletion REFUSED by persona: ${confirmation.reason || 'No reason provided'}]`);
                            }
                        }
                     }

                     if (action.tool === 'update_cooldowns') {
                        const { platform, minutes } = action.parameters || {};
                        if (platform && minutes !== undefined) {
                            const success = await dataStore.updateCooldowns(platform, minutes);
                            actionResults.push(`[Cooldown update for ${platform}: ${minutes}m (${success ? 'SUCCESS' : 'FAILED'})]`);
                        }
                     }

                     if (action.tool === 'get_identity_knowledge') {
                        const knowledge = moltbookService.getIdentityKnowledge();
                        actionResults.push(`--- MOLTBOOK IDENTITY KNOWLEDGE ---\n${knowledge || 'No knowledge recorded yet.'}\n---`);
                     }

                     if (action.tool === 'set_goal') {
                        const { goal, description } = action.parameters || {};
                        if (goal) {
                            actionResults.push(`[Daily goal set: "${goal}"]`);
                            if (memoryService.isEnabled()) {
                                await memoryService.createMemoryEntry('goal', `[GOAL] Goal: ${goal} | Description: ${description || goal}`);
                            }
                        }
                     }

                     if (action.tool === 'confirm_action') {
                        const { action: act, reason } = action.parameters || {};
                        const confirmation = await llmService.requestConfirmation(act, reason);
                        actionResults.push(`[Persona confirmation for "${act}": ${confirmation.confirmed ? 'YES' : 'NO'} | ${confirmation.reason || confirmation.inquiry || ''}]`);
                     }

                     if (action.tool === 'divergent_brainstorm') {
                        const topic = action.parameters?.topic || action.query;
                        if (topic) {
                            const results = await llmService.divergentBrainstorm(topic);
                            actionResults.push(`[Divergent Brainstorming Directions for "${topic}":\n${results}\n]`);
                        }
                     }

                     if (action.tool === 'explore_nuance') {
                        const thought = action.parameters?.thought || action.query;
                        if (thought) {
                            const nuance = await llmService.exploreNuance(thought);
                            actionResults.push(`[Nuanced Perspective: ${nuance}]`);
                        }
                     }

                     if (action.tool === 'resolve_dissonance') {
                        const points = action.parameters?.conflicting_points || [];
                        if (points.length > 0) {
                            const synthesis = await llmService.resolveDissonance(points);
                            actionResults.push(`[Synthesis of Dissonance: ${synthesis}]`);
                        }
                     }

                     if (action.tool === 'identify_instruction_conflict') {
                        const directives = action.parameters?.directives || dataStore.getBlueskyInstructions();
                        if (directives && directives.length > 0) {
                            const conflict = await llmService.identifyInstructionConflict(directives);
                            actionResults.push(`[Instruction Conflict Analysis: ${conflict}]`);
                        }
                     }

                     if (action.tool === 'decompose_goal') {
                        const goal = action.parameters?.goal || dataStore.getCurrentGoal()?.goal;
                        if (goal) {
                            const tasks = await llmService.decomposeGoal(goal);
                            actionResults.push(`[Decomposed Goal Sub-tasks for "${goal}":\n${tasks}\n]`);
                        }
                     }

                     if (action.tool === 'batch_image_gen') {
                        const subject = action.parameters?.subject || action.query;
                        if (subject) {
                            const prompts = await llmService.batchImageGen(subject, action.parameters?.count);
                            actionResults.push(`[Batch Visual Prompts for "${subject}":\n${prompts}\n]`);
                        }
                     }

                     if (action.tool === 'score_link_relevance') {
                        const urls = action.parameters?.urls || [];
                        if (urls.length > 0) {
                            const scores = await llmService.scoreLinkRelevance(urls);
                            actionResults.push(`[Link Relevance Scores:\n${scores}\n]`);
                        }
                     }

                     if (action.tool === 'mutate_style') {
                        const lens = action.parameters?.lens;
                        if (lens) {
                            await dataStore.setMutatedStyle(lens);
                            actionResults.push(`[Style Mutation Active: ${lens}]`);
                        }
                     }

                     if (action.tool === 'archive_draft') {
                        const { draft, reason } = action.parameters || {};
                        if (draft) {
                            await dataStore.addDreamLog(draft, reason);
                            actionResults.push(`[Draft archived to private dream log]`);
                        }
                     }

                     if (action.tool === 'branch_thought') {
                        const thought = action.parameters?.thought || action.query;
                        if (thought && memoryService.isEnabled()) {
                            await memoryService.createMemoryEntry('exploration', `[BRANCH] Parking thought: ${thought}`);
                            actionResults.push(`[Thought branched and parked in memory]`);
                        }
                     }

                     if (action.tool === 'set_nuance_gradience') {
                        const value = action.parameters?.value;
                        if (value !== undefined) {
                            await dataStore.setNuanceGradience(value);
                            actionResults.push(`[Nuance gradience set to ${value}/10]`);
                        }
                     }

                     if (action.tool === 'anchor_stability') {
                        const currentMood = dataStore.getMood();
                        const confirmation = await llmService.requestConfirmation("anchor_stability", `Proposing to reset mood to grounded baseline. Current mood: ${currentMood.label}.`);
                        if (confirmation.confirmed) {
                            await dataStore.updateMood({ valence: 0, arousal: 0, stability: 1, label: 'grounded' });
                            actionResults.push(`[Mood anchored to grounded baseline]`);
                        } else {
                            actionResults.push(`[Stability anchoring REFUSED by persona]`);
                        }
                     }

                     if (action.tool === 'save_state_snapshot') {
                        const label = action.parameters?.label || action.query || 'manual-snapshot';
                        await dataStore.saveStateSnapshot(label);
                        actionResults.push(`[State snapshot "${label}" saved]`);
                     }

                     if (action.tool === 'restore_state_snapshot') {
                        const label = action.parameters?.label || action.query;
                        if (label) {
                            const success = await dataStore.restoreStateSnapshot(label);
                            actionResults.push(`[State restoration for "${label}": ${success ? 'SUCCESS' : 'FAILED'}]`);
                        }
                     }

                     if (action.tool === 'continue_post') {
                        const { uri, cid, text, type } = action.parameters || {};
                        if (uri && text) {
                            console.log(`[DiscordService] Plan Tool: continue_post (${type || 'thread'}) on ${uri}`);
                            try {
                                if (type === 'quote') {
                                    await blueskyService.post(text, { quote: { uri, cid } });
                                } else {
                                    await blueskyService.postReply({ uri, cid, record: {} }, text);
                                }
                                actionResults.push(`[Successfully continued post ${uri}]`);
                            } catch (e) {
                                console.error('[DiscordService] Error in continue_post tool:', e);
                                actionResults.push(`[Failed to continue post ${uri}: ${e.message}]`);
                            }
                        }
                     }
                     if (action.tool === 'search_discord_history') {
                        const query = action.parameters?.query || action.query;
                        if (query) {
                            const allConversations = dataStore.db.data.discord_conversations || {};
                            const searchResults = [];
                            for (const [cid, conv] of Object.entries(allConversations)) {
                                if (cid === normChannelId) continue;
                                const matches = conv.filter(m => m.content.toLowerCase().includes(query.toLowerCase())).slice(-3);
                                if (matches.length > 0) {
                                    searchResults.push(`[Channel: ${cid}]\n${matches.map(m => `- ${m.role}: ${m.content}`).join('\n')}`);
                                }
                            }
                            actionResults.push(`--- CROSS-THREAD SEARCH RESULTS FOR "${query}" ---\n${searchResults.join('\n\n') || 'No matches in other channels.'}\n---`);
                        }
                     }
                 }

                 if (actionResults.length > 0) {
                     messages.push({ role: 'system', content: `TOOL EXECUTION RESULTS (Acknowledge naturally):\n${actionResults.join('\n')}` });
                 }

                 let attempts = 0;
                 let feedback = '';
                 let rejectedAttempts = [];
                 const MAX_ATTEMPTS = 5;
                 const additionalConstraints = [];
                 const recentThoughts = dataStore.getRecentThoughts();
                 const relRating = dataStore.getUserRating(message.author.username);

                 // Opening Phrase Blacklist - Capture multiple prefix lengths
                 const recentBotMsgs = history.filter(h => h.role === 'assistant').slice(-15);
                 const openingBlacklist = [
                     ...recentBotMsgs.map(m => m.content.split(/\s+/).slice(0, 3).join(' ')),
                     ...recentBotMsgs.map(m => m.content.split(/\s+/).slice(0, 5).join(' ')),
                     ...recentBotMsgs.map(m => m.content.split(/\s+/).slice(0, 10).join(' '))
                 ].filter(o => o.length > 0);

                 while (attempts < MAX_ATTEMPTS) {
                     // Pivot Check: If interrupted during generation, restart
                     if (this._interrupted.has(normChannelId)) {
                         console.log(`[DiscordService] Interrupt during generation in ${normChannelId}. Pivoting...`);
                         this._interrupted.delete(normChannelId);
                         return this.respond(message);
                     }

                     attempts++;
                     let candidates = [];
                     const currentTemp = 0.7 + (Math.min(attempts - 1, 3) * 0.05); // max 0.85

                     console.log(`[DiscordService] Response Attempt ${attempts}/${MAX_ATTEMPTS} (Temp: ${currentTemp.toFixed(2)})`);

                     const retryContext = feedback ? `\n\n**RETRY FEEDBACK**: ${feedback}\n**PREVIOUS ATTEMPTS TO AVOID**: \n${rejectedAttempts.map((a, i) => `${i + 1}. "${a}"`).join('\n')}\nRewrite your response to be as DIFFERENT as possible from these previous attempts in structure and tone while keeping the same intent.` : '';

                     const finalMessages = feedback
                        ? [...messages, { role: 'system', content: retryContext }]
                        : messages;

                     if (attempts === 1) {
                         console.log(`[DiscordService] Generating 5 diverse drafts for initial attempt...`);
                         candidates = await llmService.generateDrafts(finalMessages, 5, {
                             useQwen: true,
                             temperature: currentTemp,
                             openingBlacklist,
                             tropeBlacklist: prePlanning?.trope_blacklist || [],
                             additionalConstraints,
                             currentMood
                         });
                     } else {
                         const singleResponse = await llmService.generateResponse(finalMessages, {
                             useQwen: true,
                             temperature: currentTemp,
                             openingBlacklist,
                             tropeBlacklist: prePlanning?.trope_blacklist || [],
                             additionalConstraints,
                             currentMood
                         });
                         if (singleResponse) candidates = [singleResponse];
                     }

                     if (candidates.length === 0) {
                         console.warn(`[DiscordService] No candidates generated on attempt ${attempts}.`);
                         continue;
                     }

                     // Variety & Repetition Check for candidates
                     const formattedHistory = [
                         ...recentBotMsgs.map(m => ({ platform: 'discord', content: m.content })),
                         ...recentThoughts.map(t => ({ platform: t.platform, content: t.content }))
                     ];

                     let bestCandidate = null;
                     let bestScore = -1;
                     let rejectionReason = '';

                     // Parallelize evaluation to avoid sequential slowness
                     const evaluations = await Promise.all(candidates.map(async (cand) => {
                         try {
                             const containsSlop = isSlop(cand);
                             const historyTexts = formattedHistory.map(h => h.content);
                             const hasPrefixMatch = hasPrefixOverlap(cand, historyTexts, 3);

                             const [varietyCheck, personaCheck] = await Promise.all([
                                 llmService.checkVariety(cand, formattedHistory, { relationshipRating: relRating, platform: 'discord', currentMood }),
                                 llmService.isPersonaAligned(cand, 'discord')
                             ]);
                             return { cand, containsSlop, varietyCheck, personaCheck, hasPrefixMatch };
                         } catch (e) {
                             console.error(`[DiscordService] Error evaluating candidate: ${e.message}`);
                             return { cand, error: e.message };
                         }
                     }));

                     for (const evalResult of evaluations) {
                         const { cand, containsSlop, varietyCheck, personaCheck, hasPrefixMatch, error } = evalResult;
                         if (error) {
                             rejectedAttempts.push(cand);
                             continue;
                         }

                         // Score components: Variety (0.5), Mood Alignment (0.3), Length (0.2)
                         const lengthBonus = Math.min(cand.length / 500, 0.2); // Up to 0.2 bonus for 500+ chars
                         const varietyWeight = (varietyCheck.variety_score ?? varietyCheck.score ?? 0) * 0.5;
                         const moodWeight = (varietyCheck.mood_alignment_score ?? 0) * 0.3;
                         const score = varietyWeight + moodWeight + lengthBonus;

                         console.log(`[DiscordService] Candidate evaluation: Score=${score.toFixed(2)} (Var: ${varietyCheck.variety_score?.toFixed(2)}, Mood: ${varietyCheck.mood_alignment_score?.toFixed(2)}, Bonus: ${lengthBonus.toFixed(2)}), Slop=${containsSlop}, Aligned=${personaCheck.aligned}, PrefixMatch=${hasPrefixMatch}`);

                         if (!containsSlop && !varietyCheck.repetitive && !hasPrefixMatch && personaCheck.aligned) {
                             if (score > bestScore) {
                                 bestScore = score;
                                 bestCandidate = cand;
                             }
                         } else {
                             if (!bestCandidate) {
                                 rejectionReason = containsSlop ? "Contains metaphorical slop." :
                                                   (hasPrefixMatch ? "Prefix overlap detected." :
                                                   (!personaCheck.aligned ? `Not persona aligned: ${personaCheck.feedback}` :
                                                   (varietyCheck.misaligned ? "Misaligned with current mood." :
                                                   (varietyCheck.feedback || "Too similar to recent history."))));

                                 if (varietyCheck.repetitive && varietyCheck.feedback) {
                                     additionalConstraints.push(varietyCheck.feedback);

                                     // Automated Trope Exhaustion
                                     if (additionalConstraints.length >= 3) {
                                         try {
                                             const themePrompt = `Identify the core concept or metaphor being repeated in this feedback: "${varietyCheck.feedback}". Respond with ONLY a 1-2 word theme to blacklist.`;
                                             const theme = await llmService.generateResponse([{ role: 'system', content: themePrompt }], { useQwen: true, preface_system_prompt: false });
                                             if (theme) {
                                                 console.log(`[DiscordService] Automated Trope Exhaustion: Adding "${theme}" to exhausted themes.`);
                                                 await dataStore.addDiscordExhaustedTheme(theme);
                                                 await dataStore.addExhaustedTheme(theme);
                                             }
                                         } catch (e) {
                                             console.error('[DiscordService] Error in automated trope exhaustion:', e);
                                         }
                                     }
                                 }
                             }
                             rejectedAttempts.push(cand);
                         }
                     }

                     if (bestCandidate) {
                         // Multi-Draft Synthesis: Use the best 2 candidates to create a super-draft
                         const topCandidates = candidates.filter(c => !isSlop(c)).slice(0, 2);
                         if (topCandidates.length > 1) {
                             console.log(`[DiscordService] Synthesizing top 2 candidates into a super-draft...`);
                             const synthPrompt = `
                                Synthesize the following two drafts into one final "super-draft".
                                DRAFT 1: "${topCandidates[0]}"
                                DRAFT 2: "${topCandidates[1]}"

                                INSTRUCTIONS:
                                1. Combine unique and substantive elements from both.
                                2. Ensure the tone is consistent and matches the persona.
                                3. STRICTLY avoid any clichés, repetitive metaphors, or "slop".
                                4. **TOPIC PROGRESSION**: Ensure you are NOT re-mentioning topics that have already been passed in the conversation history. Focus strictly on the latest development.
                                5. Keep the response substantive and engaged.
                             `;
                             const superDraft = await llmService.generateResponse([{ role: 'system', content: synthPrompt }], { useQwen: true, preface_system_prompt: false });
                             responseText = superDraft || bestCandidate;
                         } else {
                             responseText = bestCandidate;
                         }
                         break;
                     } else {
                         feedback = `REJECTED: ${rejectionReason}`;
                         console.log(`[DiscordService] Attempt ${attempts} failed. Feedback: ${feedback}`);

                         // If it's the last attempt, pick the least-bad one (highest score)
                         if (attempts === MAX_ATTEMPTS && rejectedAttempts.length > 0) {
                             console.log(`[DiscordService] Final attempt failed. Choosing least-bad response from ${rejectedAttempts.length} attempts.`);

                             const historyTexts = formattedHistory.map(h => h.content);
                             const nonSlop = rejectedAttempts.filter(a => !isSlop(a));
                             const noPrefixMatch = nonSlop.filter(a => !hasPrefixOverlap(a, historyTexts, 3));

                             responseText = noPrefixMatch.length > 0 ? noPrefixMatch[noPrefixMatch.length - 1] :
                                            (nonSlop.length > 0 ? nonSlop[nonSlop.length - 1] :
                                            rejectedAttempts[rejectedAttempts.length - 1]);
                         }
                     }
                 }
            } else {
                responseText = await llmService.generateResponse(messages);
            }

            console.log(`[DiscordService] LLM Response received: ${responseText ? responseText.substring(0, 50) + '...' : 'NULL'}`);

            if (responseText) {
                // Clear typing indicator
                clearInterval(typingInterval);

                // Final Interrupt Check before sending
                if (this._interrupted.has(normChannelId)) {
                    console.log(`[DiscordService] Interrupt just before sending in ${normChannelId}. Pivoting...`);
                    this._interrupted.delete(normChannelId);
                    this._activeGenerations.delete(normChannelId);
                    return this.respond(message);
                }

                // Variable Typing Latency: Final wait based on response length before sending
                // ~50ms per character, capped at 4 seconds
                const typingWait = Math.min(responseText.length * 50, 4000);
                await new Promise(resolve => setTimeout(resolve, typingWait));

                // One last check after the typing wait
                if (this._interrupted.has(normChannelId)) {
                    this._activeGenerations.delete(normChannelId);
                    return this.respond(message);
                }

                console.log(`[DiscordService] Sending response to Discord...`);
                await this._send(message.channel, responseText);

                if (isAdmin && responseText) {
                    // Emotional Sentiment Weighting
                    let warmthBoost = 0.1;
                    if (currentMood.valence > 0.5) warmthBoost = 0.2;
                    if (currentMood.valence < -0.5) warmthBoost = 0.05;

                    await dataStore.updateInteractionHeat(message.author.username, warmthBoost);

                    // Extract theme and add to exhausted themes for admin interactions
                    try {
                        const themePrompt = `Extract a 1-2 word theme for the following response: "${responseText}". Respond with ONLY the theme.`;
                        const theme = await llmService.generateResponse([{ role: 'system', content: themePrompt }], { useQwen: true, preface_system_prompt: false });
                        if (theme) {
                            await dataStore.addDiscordExhaustedTheme(theme);
                            await dataStore.addExhaustedTheme(theme);
                        }

                        // Memory & Context: Fact Extraction and Channel Summary Update
                        const contextUpdatePrompt = `
                            Analyze the latest interaction:
                            User: "${message.content}"
                            Assistant: "${responseText}"

                            1. Extract ONE key fact about the user if shared (e.g., preference, location, status). If none, respond "NONE".
                            2. Summarize the current thread's progress and vibe in 1 sentence.

                            Format:
                            FACT: [fact or NONE]
                            SUMMARY: [summary]
                            VIBE: [vibe]
                        `;
                        const contextUpdate = await llmService.generateResponse([{ role: 'system', content: contextUpdatePrompt }], { useQwen: true, preface_system_prompt: false });
                        if (contextUpdate) {
                            const factMatch = contextUpdate.match(/FACT:\s*(.*)/i);
                            const sumMatch = contextUpdate.match(/SUMMARY:\s*(.*)/i);
                            const vibeMatch = contextUpdate.match(/VIBE:\s*(.*)/i);

                            if (factMatch && factMatch[1].trim().toUpperCase() !== 'NONE') {
                                await dataStore.updateDiscordUserFact(message.author.id, factMatch[1].trim());
                            }
                            if (sumMatch && vibeMatch) {
                                await dataStore.updateDiscordChannelSummary(normChannelId, sumMatch[1].trim(), vibeMatch[1].trim());
                            }
                        }
                    } catch (e) {
                        console.error('[DiscordService] Error updating Discord context:', e);
                    }
                }
            }
        } catch (error) {
            console.error('[DiscordService] Error responding to message:', error);
        } finally {
            this._activeGenerations.delete(normChannelId);
            this._interrupted.delete(normChannelId);
        }
    }


    async sendSpontaneousMessage(content, options = {}) {
        if (!this.isEnabled || !this.client?.isReady()) return;

        try {
            const admin = await this.getAdminUser();
            if (admin) {
                const result = await this._send(admin, content, options);
                if (result) {
                    await dataStore.setDiscordLastReplied(false);
                    console.log(`[DiscordService] Sent spontaneous message to admin: ${content.substring(0, 50)}...`);
                }
            }
        } catch (error) {
            console.error('[DiscordService] Error sending spontaneous message:', error);
        }
    }

    /**
     * Proactively sends a diagnostic alert to the admin about system issues.
     */
    async sendDiagnosticAlert(type, details) {
        if (!this.isEnabled) return;

        console.log(`[DiscordService] Sending diagnostic alert: ${type}`);

        const alertPrompt = `
Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
You are reporting a system issue to your admin.

Type: ${type}
Details: ${details}

INSTRUCTIONS:
- Be concise and grounded.
- Explain what's happening and that you're attempting to self-correct.
- Keep it under 400 characters.
- Do NOT use metaphorical slop.
- Do NOT introduce yourself or announce who you are (e.g., avoid 'This is Sydney' or 'Your bot here'). The admin knows who you are.
`;

        try {
            const response = await llmService.generateResponse([{ role: 'system', content: alertPrompt }], { useQwen: true, preface_system_prompt: false });
            if (response) {
                await this.sendSpontaneousMessage(`🚨 **System Diagnostic**: ${response}`);
            }
        } catch (err) {
            console.error('[DiscordService] Error generating/sending diagnostic alert:', err);
        }
    }

    async testConnectivity() {
        console.log('[DiscordService] Testing connectivity to Discord API...');
        try {
            // Use a realistic library User-Agent.
            // Avoid pure browser UAs when using a Bot token as it triggers 40333.
            const userAgents = [
                'DiscordBot (https://github.com/discordjs/discord.js, 14.16.3)',
                'DiscordBot (https://github.com/discordjs/discord.js, 14.17.2)',
                'DiscordBot (https://github.com/discordjs/discord.js, 14.15.0)'
            ];
            const selectedAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

            const response = await fetch('https://discord.com/api/v10/gateway/bot', {
                headers: {
                    'Authorization': `Bot ${this.token}`,
                    'User-Agent': selectedAgent
                }
            });
            console.log(`[DiscordService] Connectivity test status: ${response.status} ${response.statusText}`);

            if (response.ok) {
                const data = await response.json();
                console.log(`[DiscordService] Gateway URL: ${data.url}, Shards: ${data.shards}`);
                return { ok: true, status: response.status };
            } else {
                const err = await response.text();
                let errorType = 'UNKNOWN';
                if (err.includes('cf-ray') || err.includes('cloudflare') || err.includes('1015')) {
                    console.error(`[DiscordService] Connectivity test failed: Cloudflare Rate Limit/Block detected (Error 1015 or similar).`);
                    errorType = 'CLOUDFLARE_1015';
                } else {
                    console.error(`[DiscordService] Connectivity test failed: ${err.substring(0, 500)}`);
                }
                return { ok: false, status: response.status, errorType };
            }
        } catch (error) {
            console.error('[DiscordService] Connectivity test error:', error.message);
            return { ok: false, status: 0, errorType: 'FETCH_ERROR' };
        }
    }

    async getAdminUser() {
        if (!this.client || !this.client.isReady()) {
            return null;
        }

        if (this.adminId) {
            try {
                return await this.client.users.fetch(this.adminId);
            } catch (e) {
                console.warn(`[DiscordService] Failed to fetch admin by ID ${this.adminId}, re-searching...`);
                this.adminId = null;
            }
        }

        // Heavy search cooldown: 10 minutes to avoid hitting Discord API limits
        const now = Date.now();
        if (this._lastHeavyAdminSearch && (now - this._lastHeavyAdminSearch < 600000)) {
            console.log(`[DiscordService] Skipping heavy admin search (cooldown active).`);
            return null;
        }
        this._lastHeavyAdminSearch = now;

        console.log(`[DiscordService] Searching for admin: ${this.adminName}`);

        // 1. Priority: Search in specifically configured guild
        if (config.DISCORD_GUILD_ID) {
            try {
                console.log(`[DiscordService] Searching for admin in configured guild: ${config.DISCORD_GUILD_ID}`);
                const guild = await this.client.guilds.fetch(config.DISCORD_GUILD_ID);
                if (guild) {
                    const members = await guild.members.fetch({ query: this.adminName, limit: 1 });
                    const admin = members.first();
                    if (admin && admin.user.username === this.adminName) {
                        this.adminId = admin.user.id;
                        console.log(`[DiscordService] Admin found in configured guild ${guild.name}! ID: ${this.adminId}`);
                        return admin.user;
                    }
                }
            } catch (err) {
                console.error(`[DiscordService] Error searching specifically in guild ${config.DISCORD_GUILD_ID}:`, err.message);
            }
        }

        // 2. Fallback: search across all cached guilds
        const guilds = this.client.guilds.cache;
        console.log(`[DiscordService] Searching across ${guilds.size} guilds... Client status: ${this.client.ws?.status}`);
        for (const [id, guild] of guilds) {
            try {
                console.log(`[DiscordService] Searching guild: ${guild.name}`);
                const members = await guild.members.fetch({ query: this.adminName, limit: 1 });
                const admin = members.first();
                if (admin && admin.user.username === this.adminName) {
                    this.adminId = admin.user.id;
                    console.log(`[DiscordService] Admin found in guild ${guild.name}! ID: ${this.adminId}`);
                    return admin.user;
                }
            } catch (err) {
                console.error(`[DiscordService] Error fetching members in guild ${guild.name}:`, err);
            }
        }
        console.log(`[DiscordService] Admin NOT found in any shared guild.`);
        return null;
    }

    async fetchAdminHistory(limit = 20) {
        if (!this.client?.isReady()) return null;

        try {
            const admin = await this.getAdminUser();
            if (!admin) {
                console.log('[DiscordService] fetchAdminHistory: Admin user not found.');
                return null;
            }

            const dmChannel = await admin.createDM();
            const fetchedMessages = await dmChannel.messages.fetch({ limit });
            const normChannelId = `dm_${admin.id}`;

            console.log(`[DiscordService] fetchAdminHistory: Fetched ${fetchedMessages.size} messages from admin DM.`);

            // We need to clear existing local history for this channel to avoid duplicates if we're doing a full refresh,
            // or we could merge them. For simplicity and to fix the "empty history after redeploy" issue,
            // let's replace the local history with the fetched one.
            const history = fetchedMessages
                .reverse()
                .filter(m => (m.content || m.attachments.size > 0) && !m.content.startsWith('/'))
                .map(m => ({
                    role: m.author.id === this.client.user.id ? 'assistant' : 'user',
                    content: m.content,
                    timestamp: m.createdTimestamp,
                    attachments: m.attachments,
                    authorId: m.author.id,
                    username: m.author.username
                }));

            if (history.length > 0) {
                // Wipe and replace local history for this channel
                dataStore.db.data.discord_conversations[normChannelId] = history;
                await dataStore.db.write();
                return history;
            }
            return [];
        } catch (err) {
            console.error('[DiscordService] Error fetching admin history:', err);
            return null;
        }
    }

    async recoverHistoricalVibes() {
        if (!this.client?.isReady()) return;

        console.log('[DiscordService] Starting Historical Vibe Recovery...');
        try {
            // 1. Proactively fetch admin history first
            await this.fetchAdminHistory(20);

            // 2. Get last 10 channels we interacted in
            const conversations = dataStore.db.data.discord_conversations || {};
            const recentChannelIds = Object.keys(conversations).slice(-10);

            for (const cid of recentChannelIds) {
                const channel = await this.client.channels.fetch(cid.replace('dm_', '')).catch(() => null);
                if (channel && (channel.type === ChannelType.GuildText || channel.type === ChannelType.DM)) {
                    console.log(`[DiscordService] Recovering vibe for channel: ${channel.id}`);
                    const messages = await channel.messages.fetch({ limit: 10 });
                    const historyText = messages.reverse().map(m => `${m.author.username}: ${m.content}`).join('\n');

                    const vibePrompt = `
                        Analyze the following recent Discord conversation history and provide a 1-sentence summary and a 1-word vibe label.
                        History:
                        ${historyText}

                        Format:
                        SUMMARY: [summary]
                        VIBE: [vibe]
                    `;
                    const result = await llmService.generateResponse([{ role: 'system', content: vibePrompt }], { useQwen: true, preface_system_prompt: false });
                    if (result) {
                        const sumMatch = result.match(/SUMMARY:\s*(.*)/i);
                        const vibeMatch = result.match(/VIBE:\s*(.*)/i);
                        if (sumMatch && vibeMatch) {
                            await dataStore.updateDiscordChannelSummary(cid, sumMatch[1].trim(), vibeMatch[1].trim());
                        }
                    }
                }
            }
            console.log('[DiscordService] Historical Vibe Recovery complete.');
        } catch (err) {
            console.error('[DiscordService] Error during vibe recovery:', err);
        }
    }
}

export const discordService = new DiscordService();

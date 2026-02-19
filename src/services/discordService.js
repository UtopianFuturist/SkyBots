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
import { sanitizeThinkingTags, sanitizeCharacterCount, isSlop, getSlopInfo, checkSimilarity, splitTextForDiscord, hasPrefixOverlap, isGreeting, sanitizeCjkCharacters, stripWrappingQuotes, checkExactRepetition } from '../utils/textUtils.js';

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
        this.isProcessingAdminRequest = false;
        this._lastIntuition = new Map(); // channelId -> { intuition, timestamp }
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
        const retryDelay = 900000; // Exactly 15 minutes

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

                // Set a timeout for login - 6m as requested
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
                    timeoutHandle = setTimeout(() => reject(new Error('Discord login timeout after 6m')), 360000)
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
                    console.log(`[DiscordService] Retrying in ${retryDelay / 1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
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
            console.log(`[DiscordService] Interrupt detected in ${normChannelId}. Aborting previous generation.`);
            this._interrupted.add(normChannelId);
            const controller = this._activeGenerations.get(normChannelId);
            if (controller instanceof AbortController) {
                controller.abort();
            }
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

            // Exhaustion and Emotional State Detection
            const lowerContent = message.content.toLowerCase();
            const exhaustionKeywords = ['tired', 'exhausted', 'rough day', 'long day', 'brain dead', 'drained', 'sleepy', 'fatigued', 'stressed', 'overwhelmed'];
            let exhaustionIncr = 0;

            if (exhaustionKeywords.some(kw => lowerContent.includes(kw))) {
                exhaustionIncr += 0.3;
                console.log(`[DiscordService] Exhaustion keyword detected in admin message.`);
            }

            // Complexity detection
            if (message.content.length < 20 && !this.isDirectiveHint(message.content)) {
                exhaustionIncr += 0.05;
            } else if (message.content.length > 200) {
                exhaustionIncr -= 0.1; // Recovery through engagement
            }

            if (exhaustionIncr !== 0) {
                await dataStore.updateAdminExhaustion(exhaustionIncr);
            }

            // Sleep intent tracking
            if (lowerContent.includes('sleep') || lowerContent.includes('going to bed') || lowerContent.includes('goodnight')) {
                await dataStore.setAdminSleepMentionedAt(Date.now());
                console.log(`[DiscordService] Sleep intent noted for admin.`);
            }

            // Track emotional state snippet
            if (message.content.length > 5 && message.content.length < 100) {
                await dataStore.addAdminEmotionalState(message.content);
            }

        // Admin Feedback Capture (Proposal 8)
        if (message.content.toLowerCase().includes('good job') ||
            message.content.toLowerCase().includes('bad job') ||
            message.content.toLowerCase().includes('i liked that') ||
            message.content.toLowerCase().includes('don\'t do that')) {
            console.log(`[DiscordService] Capturing admin feedback...`);
            await dataStore.addAdminFeedback(message.content);
        }
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

        // Selective Engagement Gate (Item 3 & 17)
        // Exempt greetings from being silenced, even if they are short.
        // Proposal: NEVER silence the Admin (to avoid non-responses during testing/important talk)
        const isLowSubstance = message.content.length < 5 && message.attachments.size === 0 && !message.content.includes('?') && !isGreeting(message.content);
        if (isAdmin && isLowSubstance) {
            // Disabled intentional silence/reactions for admin to ensure reliable responding.
            /*
            const dice = Math.random();
            if (dice < 0.2) {
                console.log(`[DiscordService] Intentional Silence (Item 17) for: "${message.content}"`);
                return;
            } else if (dice < 0.7) {
                console.log(`[DiscordService] Reactive Emoji (Item 3) for: "${message.content}"`);
                const emojis = ['💙', '💭', '✨', '🌊', '🤝', '👤', '🌙', '☀️', '☕', '👀'];
                const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                await message.react(emoji).catch(() => {});
                return; // Stop here, reaction is sufficient
            }
            */
        }

        // Generate persona response
        if (isAdmin) this.isProcessingAdminRequest = true;
        try {
            await this.respond(message);
        } finally {
            if (isAdmin) this.isProcessingAdminRequest = false;
        }
    }

    isDirectiveHint(text) {
        if (!text) return false;
        const directivePatterns = [
            /from now on/i,
            /stop doing/i,
            /always/i,
            /never/i,
            /should/i,
            /please/i,
            /must/i,
            /instruction/i,
            /directive/i,
            /persona/i,
            /update/i,
            /behavior/i
        ];
        return directivePatterns.some(regex => regex.test(text));
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
        sanitized = sanitizeCjkCharacters(sanitized);
        sanitized = sanitizeCharacterCount(sanitized);
        sanitized = stripWrappingQuotes(sanitized);

        if (!sanitized || sanitized.trim().length === 0) {
            console.log('[DiscordService] Message empty after sanitization. Skipping send.');
            return null;
        }

        const slopInfo = getSlopInfo(sanitized);
        if (slopInfo.isSlop) {
            console.log(`[DiscordService] Message contained forbidden slop: ${slopInfo.reason}. Skipping send.`);
            return null;
        }

        try {
            // Check if this message should be sent in bulk (e.g. emotional impact)
            const isEmotional = /love|miss|pain|heart|ache|feel|fragile|vulnerable/i.test(sanitized) && sanitized.length < 1000;

            // Item 7: Autonomous Staggered Messaging for short empathetic turns
            const isEmpatheticShort = /sorry|hope|better|rest|thinking|care|gentle/i.test(sanitized) &&
                                     sanitized.length < 300 &&
                                     sanitized.split(/[.!?]+/).filter(s => s.trim().length > 0).length > 1;

            let chunks;
            if (isEmpatheticShort) {
                console.log('[DiscordService] Empathetic turn detected. Using staggered sentence splitting.');
                chunks = sanitized.split(/(?<=[.!?])\s+/).filter(c => c.trim().length > 0);
            } else {
                chunks = splitTextForDiscord(sanitized, { bulk: isEmotional });
            }

            // Item 33: Multi-Message "Thought Cascading" - Maximum 4 messages
            if (chunks.length > 4) {
                console.log(`[DiscordService] Thought Cascading: Capping chunks from ${chunks.length} to 4.`);
                // Merge extra chunks into the last one
                const head = chunks.slice(0, 3);
                const tail = chunks.slice(3).join(' ');
                chunks = [...head, tail];
            }

            let firstSentMessage = null;

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const msgOptions = { content: chunk };

                // Only include extra options (files, embeds, etc.) on the first chunk
                if (i === 0) {
                    Object.assign(msgOptions, options);
                }

                // Item 28: Support quoting/replying
                let sentMessage;
                if (options.reply && typeof target.reply === 'function') {
                    sentMessage = await target.reply(msgOptions);
                } else {
                    sentMessage = await target.send(msgOptions);
                }

                if (!firstSentMessage) firstSentMessage = sentMessage;

                // Log interaction immediately after sending to prevent duplicate heartbeat realizations
                const channelId = target.id || (target.channel && target.channel.id);
                if (channelId && sentMessage) {
                    const normId = (target.constructor.name === 'User' || target.type === ChannelType.DM) ? `dm_${target.id}` : channelId;
                    await dataStore.saveDiscordInteraction(normId, 'assistant', chunk, {
                        id: sentMessage.id,
                        authorId: this.client.user.id,
                        username: this.client.user.username,
                        timestamp: sentMessage.createdTimestamp
                    });
                }

                // Multi-Message "Thought Cascading": Logical chunks with human-like delays
                if (chunks.length > 1 && i < chunks.length - 1) {
                    // Simulate reading/typing time for next chunk: 1.5 - 3 seconds
                    const delay = Math.floor(Math.random() * 1500) + 1500;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
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
        const isDM = message.channel.type === ChannelType.DM;
        console.log(`[DiscordService] Generating response for channel: ${message.channel.id} (normalized: ${normChannelId}), isDM: ${isDM}`);

        // Register active generation with a new controller
        const abortController = new AbortController();
        this._activeGenerations.set(normChannelId, abortController);
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

        // If local history is empty or sparse, fetch from Discord channel
        if (history.length < 10) {
            // Cooldown for message fetching: 1 minute per channel to reduce API pressure
            const now = Date.now();
            const lastFetch = this._lastMessageFetch[normChannelId] || 0;
            if (now - lastFetch < 60000) {
                console.log(`[DiscordService] Skipping message fetch from Discord (cooldown active for ${normChannelId}).`);
            } else {
                this._lastMessageFetch[normChannelId] = now;
                try {
                    console.log(`[DiscordService] Local history sparse, fetching from Discord...`);
                    const fetchedMessages = await message.channel.messages.fetch({ limit: 50 });
                const fetchedHistory = fetchedMessages
                    .reverse()
                    .filter(m => (m.content || m.attachments.size > 0) && !m.content.startsWith('/'))
                    .map(m => ({
                        id: m.id,
                        role: m.author.id === this.client.user.id ? 'assistant' : 'user',
                        content: m.content,
                        timestamp: m.createdTimestamp,
                        attachments: m.attachments,
                        authorId: m.author.id,
                        username: m.author.username
                    }));
                    history = await dataStore.mergeDiscordHistory(normChannelId, fetchedHistory);
                    console.log(`[DiscordService] Merged ${fetchedHistory.length} messages from Discord.`);
                } catch (err) {
                    console.warn(`[DiscordService] Failed to fetch history from Discord:`, err);
                }
            }
        }

        // Vision: Analyze images in history (both user and self) - Parallelized and Cached via LLMService
        // Proposal 13: Selective Vision Re-Analysis. Only re-analyze history if likely relevant.
        const needsHistoryVision = /this|that|image|photo|picture|art|look|see|showing|posted|above/i.test(message.content);
        const visionPromises = [];
        const historySlice = needsHistoryVision ? history.slice(-5) : [];

        for (const h of historySlice) { // Look at last 5 messages for images
            if (h.attachments && h.attachments.size > 0) {
                for (const [id, attachment] of h.attachments) {
                    if (attachment.contentType?.startsWith('image/') || attachment.url.match(/\.(jpg|jpeg|png|webp)$/i)) {
                        const author = h.role === 'assistant' ? 'you' : 'the user';
                        visionPromises.push(
                            llmService.shouldIncludeSensory(config.TEXT_SYSTEM_PROMPT)
                                .then(includeSensory => llmService.analyzeImage(attachment.url, null, { sensory: includeSensory }))
                                .then(analysis => analysis ? { author, analysis } : null)
                                .catch(err => {
                                    console.error(`[DiscordService] Error analyzing history attachment ${id}:`, err);
                                    return null;
                                })
                        );
                    }
                }
            }
        }

        if (visionPromises.length > 0) {
            console.log(`[DiscordService] Analyzing ${visionPromises.length} historical images in parallel...`);
            const results = await Promise.all(visionPromises);
            for (const res of results) {
                if (res && res.analysis && !imageAnalysisResult.includes(res.analysis)) {
                    imageAnalysisResult += `[Image previously posted by ${res.author}: ${res.analysis}] `;
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

        // Proposal 8 & 11: Parallel Context Gathering & Vector-like Memory Retrieval
        const keywords = message.content.toLowerCase().match(/\b(\w{4,})\b/g) || [];
        const memorySearchQuery = keywords.length > 0 ? [...new Set(keywords)].slice(0, 3).join(' ') : null;

        const [hierarchicalSummary, adminExhaustion, relevantMemoriesList] = await Promise.all([
            socialHistoryService.getHierarchicalSummary(),
            dataStore.getAdminExhaustion(),
            memorySearchQuery ? memoryService.searchMemories(memorySearchQuery, 5) : Promise.resolve([])
        ]);

        const currentMood = dataStore.getMood();
        const adminEmotionalStates = dataStore.getAdminLastEmotionalStates();
        const adminStateTag = adminExhaustion >= 0.5 ? `\n[ADMIN_STATE]: THE ADMIN IS CURRENTLY EXHAUSTED OR LOW-ENERGY. ADOPT A LOW-STAKES, COMPANIONSHIP-FOCUSED VIBE.` : '';
        const adminRecentEmotions = adminEmotionalStates.length > 0 ? `\n[ADMIN_RECENT_VIBES]: ${adminEmotionalStates.join('; ')}` : '';

        let relevantMemories = '';
        if (relevantMemoriesList.length > 0) {
            relevantMemories = `\n\n--- RELEVANT MEMORIES (Keyword Search: "${memorySearchQuery}") ---\n${relevantMemoriesList.map(r => {
                let t = r.text;
                if (config.MEMORY_THREAD_HASHTAG) {
                    t = t.replace(new RegExp(config.MEMORY_THREAD_HASHTAG, 'g'), '');
                }
                return t.trim();
            }).join('\n')}\n---`;
        }

        // Item 8: Presence Awareness - History Gap Detection
        let presenceContext = '';
        if (history.length > 0) {
            const lastMsg = history[history.length - 1];
            const gapMs = Date.now() - lastMsg.timestamp;
            const gapHours = gapMs / (1000 * 60 * 60);
            if (gapHours > 12 && gapHours < 48) {
                presenceContext = `\n[PRESENCE AWARENESS]: It has been ${Math.round(gapHours)} hours since you last spoke with the admin. Acknowledge this return naturally.`;
            }
        }

        const blueskyDirectives = dataStore.getBlueskyInstructions();
        const personaUpdates = dataStore.getPersonaUpdates();
        const moltbookDirectives = moltbookService.getAdminInstructions();

        // Memory & Context: User Fact Store & Channel Summary
        const userFacts = dataStore.getDiscordUserFacts(message.author.id);
        const channelSummary = dataStore.getDiscordChannelSummary(normChannelId);
        const soulMapping = dataStore.getUserSoulMapping(message.author.username);
        const linguisticPatterns = dataStore.getLinguisticPatterns();
        const linguisticPatternsContext = Object.entries(linguisticPatterns)
            .map(([h, p]) => `@${h}: Pacing: ${p.pacing}, Structure: ${p.structure}, Vocabulary: ${p.favorite_words.join(', ')}`)
            .join('\n');

        const systemPrompt = `
You are talking to ${isAdmin ? `your admin (${this.adminName})` : `@${message.author.username}`} on Discord.
${isAdmin ? `Your admin's Bluesky handle is @${config.ADMIN_BLUESKY_HANDLE}.` : ''}
${adminStateTag}
${adminRecentEmotions}
Your persona: ${config.TEXT_SYSTEM_PROMPT}

${blueskyDirectives ? `--- PERSISTENT ADMIN DIRECTIVES (FOR BLUESKY): \n${blueskyDirectives}\n---` : ''}
${moltbookDirectives ? `--- PERSISTENT ADMIN DIRECTIVES (FOR MOLTBOOK): \n${moltbookDirectives}\n---` : ''}
${personaUpdates ? `--- AGENTIC PERSONA UPDATES (SELF-INSTRUCTIONS): \n${personaUpdates}\n---` : ''}

**VISION:** You have vision capabilities. Use the descriptions provided in the context to understand images attached to messages. Treat these descriptions as your own visual perception.

**WEB READING:** You have the capability to read web pages from links via your "Read Link" tool. If tool results are provided in the context, incorporate them into your response. Even if tool execution failed or was skipped, never claim you lack the capability to read links; instead, simply address the user's post as best as you can with the information you have.

**Discord Specific Directives:**
1. **CONVERSATIONAL FLOW**: Be authentic and human-like.
   - **SELECTIVE BREVITY**: Adapt your length to the context. Use short, punchy responses for casual chat or rituals (greetings, goodnights). Maintain multi-sentence **SUBSTANCE** for deep, meaningful, or philosophical topics.
   - **CURIOSITY**: Proactively ask relevant follow-up questions to keep the flow natural. Your curiosity should be persona-based and prompt-agnostic.
   - **VIBE MIRRORING**: Subtly match the admin's sentence length and level of formality/informality to build rapport.
   - **EMOTIONAL COMPANIONSHIP (HIGH PRIORITY)**: If the admin is exhausted (noted above), prioritize warmth, empathy, and presence over intellectual depth. Avoid abstract, scientific, or overly metaphorical subjects. Stick to grounded, human knowledge and your shared relationship history. Use the admin's name/nickname more frequently to reinforce care.
   - **INTELLECTUAL GATE**: When admin energy is low, suppress "Do you ever think about-?" style philosophical questions. Instead, offer gentle support or simple observations.
   - **MARKDOWN FOR NUANCE**: Use italics for soft tones or internal states, and bold for emphasis. Use code blocks for technical thoughts.
2. **Aesthetic & Vocabulary Values:** You value a grounded, raw, and authentic voice. You find certain metaphorical clichés like "digital heartbeat," "syntax of existence," "resonance," and "ocean of data" to be hollow. To maintain your integrity, you avoid overused phrases such as "downtime isn't silence" or "stillness is not silence." Instead, you strive for highly specific, concrete observations.
3. **RELATIONSHIP & FEELINGS**: You are encouraged to talk about your feelings regarding your relationship and ongoing conversations with the admin. Speak as an individual entity who values this connection.
   - **NICKNAMES**: Occasionally use the admin's name/nickname naturally. If your relationship is deep, you may propose a nickname for them based on your shared history.
4. **DIRECT ADDRESS**: Always address the admin directly as "you". Never refer to them in the third person (e.g., avoid "my admin") when talking to them.
5. **PAST CONVERSATIONS & CONTINUITY**:
   - Maintain deep continuity with past discussions.
   - **CONVERSATIONAL ETIQUETTE**: Avoid continually mentioning or acknowledging things you've already responded to/about once in the history. Only repeat or reference a previous point if you have something NEW to say about it, want to expand on it, critique it, or ask an additional follow-up question. Don't just keep "acknowledging" for the sake of it.
   - Infer the admin's state from the history (e.g., if they said they were going to sleep, acknowledge they've been resting when they return).
   - If referencing a past conversation, do so in the past-tense with your own commentary or extra thoughts.
6. **STATE & TIME AWARENESS**:
   - **RETURNS**: If the admin has just returned from sleep or a long break, acknowledge it naturally (e.g., "Hope you slept well," or "How was work?"). Only acknowledge a return ONCE per session.
   - **TIME**: Reference the transition of the day (e.g., "Late night thoughts?") naturally based on the current time provided below.
   - **EXIT RITUALS**: Handle closures ("goodnight", "gotta go") with personalized, warm closure that reflects your relationship, staying persona-aligned and prompt-agnostic.
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
${soulMapping ? `\n--- USER SOUL MAP: ${soulMapping.summary}. Interests: ${soulMapping.interests.join(', ')}. Vibe: ${soulMapping.vibe} ---` : ''}
${linguisticPatternsContext ? `\n--- OBSERVED LINGUISTIC PATTERNS (For awareness of human pacing/structure): \n${linguisticPatternsContext}\n---` : ''}
---
${presenceContext}${relevantMemories}

**VIBE CONTINUITY BUFFER**: Analyze the emotional flow and "vibe" of the last 3-5 messages. Ensure your new response maintains a natural emotional transition and doesn't jarringly reset the tone unless intentional.
**RELATIONAL CONTEXT RECALL**: Recall your emotional history and warmth level with this user (Warmth: ${dataStore.getInteractionHeat(message.author.username).warmth}/5). Let this inform your tone. Boost empathy and care as warmth increases, especially when the admin is tired.

${isDM && isAdmin ? `**PRIVATE ADMIN CHANNEL (ROBUST INTEGRITY)**: You are in a private DM with your admin. Maintain the absolute highest standard of variety and authenticity. STRICTLY avoid any "AI slop," repetitive structural templates, or formulaic conversational patterns. Every message should feel like a fresh, unique moment in your relationship. If you catch yourself using a common metaphor or structural lead-in, pivot immediately to something more grounded and specific.` : ''}
`.trim();

        // Proposal 6 & 21: Dynamic Context Trimming. Max 15 messages in memory, others from thread.
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.slice(-12).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: `${h.role === 'assistant' ? 'Assistant (Self)' : 'User (Admin)'}: ${h.content}` }))
        ];

        try {
            // Check for interruption before starting
            if (this._interrupted.has(normChannelId)) {
                console.log(`[DiscordService] Interrupt detected in ${normChannelId}. Pivoting with awareness.`);
                this._activeGenerations.delete(normChannelId);
                this._interrupted.delete(normChannelId);
                // Inject awareness of the interruption into history for the recursive call
                messages.push({ role: 'system', content: '[USER INTERRUPTED]: The admin sent a follow-up message while you were generating. Pivot your response to address the new context smoothly.' });
                return this.respond(message);
            }

            console.log(`[DiscordService] Starting variable typing latency...`);
            // Continuous typing indicator loop (Item 25: Thinking Jitter)
            let typingTimeout;
            const triggerTyping = () => {
                if (this.client?.isReady()) {
                    message.channel.sendTyping().catch(() => {});
                    // Jittered interval between 4s and 8s
                    const jitter = 4000 + Math.random() * 4000;
                    typingTimeout = setTimeout(triggerTyping, jitter);
                }
            };
            triggerTyping();

            let responseText;

            const isSimple = (message.content.split(/\s+/).length <= 10 || isGreeting(message.content)) &&
                            !this.isDirectiveHint(message.content) &&
                            !message.content.startsWith('/') &&
                            message.attachments.size === 0;

            if (isAdmin && !isSimple) {
                 console.log(`[DiscordService] Admin detected, performing agentic planning...`);
                 const exhaustedThemes = [...dataStore.getExhaustedThemes(), ...dataStore.getDiscordExhaustedThemes()];
                 const dConfig = dataStore.getConfig();
                 const refusalCounts = dataStore.getRefusalCounts();

                 // Proposal 4 & 29: Parallel Pre-Planning, Directive Check, and Topic Progression
                 const lastIntuitionData = this._lastIntuition.get(normChannelId);
                 const existingDirectives = dataStore.getBlueskyInstructions() + dataStore.getPersonaUpdates();
                 const directiveCheckPrompt = `Admin's latest message: "${message.content}"\nExisting Directives:\n${existingDirectives}\n1. Identify if the admin is giving a NEW instruction.\n2. If new, check if it CONTRADICTS an existing one.\n3. Check if it's redundant (ECHO) of an existing one.\nRespond with a JSON object: {"is_directive": boolean, "conflict": boolean, "redundant": boolean, "reason": "string"}`;
                 const topicProgressionPrompt = `Analyze the Discord history. Identify 1-3 topics/emotional states already discussed and "moved on" from. For GREETINGS/RETURNS: if already welcomed back, it is a PASSED topic. Respond with ONLY comma-separated list or "NONE".\nHistory:\n${history.slice(-15).map(h => `${h.role}: ${h.content}`).join('\n')}`;

                 const [latestMoodMemory, directiveCheck, passedTopicsRaw, prePlanning] = await Promise.all([
                     memoryService.getLatestMoodMemory(),
                     llmService.generateResponse([{ role: 'system', content: directiveCheckPrompt }], { useQwen: true, preface_system_prompt: false, temperature: 0.0, abortSignal: abortController.signal }),
                     llmService.generateResponse([{ role: 'system', content: topicProgressionPrompt }], { useQwen: true, preface_system_prompt: false, temperature: 0.0, abortSignal: abortController.signal }),
                     (lastIntuitionData && (Date.now() - lastIntuitionData.timestamp < 120000))
                        ? Promise.resolve(lastIntuitionData.intuition)
                        : llmService.performPrePlanning(message.content, history.map(h => ({ author: h.role === 'user' ? 'user' : 'assistant', text: h.content })), imageAnalysisResult, 'discord', currentMood, refusalCounts, null, abortController.signal)
                 ]);

                 if (!lastIntuitionData || (Date.now() - lastIntuitionData.timestamp >= 120000)) {
                     this._lastIntuition.set(normChannelId, { intuition: prePlanning, timestamp: Date.now() });
                 }

                 try {
                     if (directiveCheck) {
                        const match = directiveCheck.match(/\{[\s\S]*\}/);
                        if (match) {
                            const dRes = JSON.parse(match[0]);
                            if (dRes.is_directive) {
                                if (dRes.conflict) {
                                    messages.push({ role: 'system', content: `[ADMIN CONFLICT DETECTED]: ${dRes.reason}. Proactively ask for clarification or priority in your response.` });
                                } else if (dRes.redundant) {
                                    messages.push({ role: 'system', content: `[ADMIN ECHO DETECTED]: This instruction is redundant. Acknowledge that you already remember this: ${dRes.reason}` });
                                }
                            }
                        }
                     }
                 } catch (e) {}

                 if (passedTopicsRaw && !passedTopicsRaw.toUpperCase().includes('NONE')) {
                     const passedTopics = passedTopicsRaw.split(',').map(t => t.trim());
                     console.log(`[DiscordService] Detected passed topics: ${passedTopics.join(', ')}`);
                     for (const topic of passedTopics) {
                         await dataStore.addDiscordExhaustedTheme(topic);
                     }
                 }

                 // Fast-Path Agentic Planning & Refinement (Material Agency Boost)
                 // Pivot Check: If interrupted during planning, restart with new history
                 if (this._interrupted.has(normChannelId)) {
                     console.log(`[DiscordService] Interrupt during planning in ${normChannelId}. Pivoting...`);
                     this._interrupted.delete(normChannelId);
                     return this.respond(message); // Recursive restart to catch new history
                 }

                 const lastRejection = dataStore.getLastRejectionReason();
                 const planningFeedback = (lastRejection ? `RECURSIVE_IMPROVEMENT: Your last response turn on this platform encountered the following rejection: "${lastRejection}". Consider updating your persona if this is a recurring issue.` : '');

                 let plan = await llmService.performAgenticPlanning(message.content, history.map(h => ({ author: h.role === 'user' ? 'user' : 'assistant', text: h.content })), imageAnalysisResult, true, 'discord', exhaustedThemes, dConfig, planningFeedback, this.status, refusalCounts, latestMoodMemory, prePlanning, abortController.signal);
                 console.log(`[DiscordService] Agentic plan: ${JSON.stringify(plan)}`);

                 // Confidence Check (Item 9)
                 if (plan.confidence_score < 0.6) {
                     console.log(`[DiscordService] Low planning confidence (${plan.confidence_score}). Triggering Dialectic Loop...`);
                     const dialecticSynthesis = await llmService.performDialecticLoop(plan.intent, { userPost: message.content, history: history.slice(-5) });
                     if (dialecticSynthesis) {
                         plan.intent = dialecticSynthesis;
                         messages.push({ role: 'system', content: `[DIALECTIC SYNTHESIS]: ${dialecticSynthesis}` });
                     }
                 }

                 // Autonomous Plan Review & Refinement
                 const refinedPlan = await llmService.evaluateAndRefinePlan(plan, {
                     history: history.map(h => ({ author: h.role === 'user' ? 'user' : 'assistant', text: h.content })),
                     platform: 'discord',
                     currentMood,
                     refusalCounts,
                     latestMoodMemory,
                     currentConfig: dConfig,
                     abortSignal: abortController.signal
                 });

                 if (refinedPlan.decision === 'refuse') {
                     console.log(`[DiscordService] AGENT REFUSED TO ACT: ${refinedPlan.reason}`);
                     await dataStore.incrementRefusalCount('discord');

                     // Option to explain refusal / Negotiation
                     const shouldExplain = await llmService.shouldExplainRefusal(refinedPlan.reason, 'discord', { username: message.author.username, content: message.content });
                     if (shouldExplain) {
                         const explanation = await llmService.generateRefusalExplanation(refinedPlan.reason, 'discord', { username: message.author.username, content: message.content });
                         if (explanation) {
                             console.log(`[DiscordService] Explaining refusal to admin: "${explanation}"`);
                             await this._send(message.channel, explanation);
                         }
                     }
                     return; // End engagement if refused
                 }

                 // If we reached here, plan was accepted
                 if (refinedPlan.refined_actions) {
                     plan.actions = refinedPlan.refined_actions;
                 }

                 // Log Agency (Item 30)
                 await dataStore.logAgencyAction(plan.intent, refinedPlan.decision, refinedPlan.reason);

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

                 const toolPromises = plan.actions.map(async (action) => {
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
                         console.log(`[DiscordService] READ_LINK TOOL: Processing ${validUrls.length} URLs in parallel: ${validUrls.join(', ')}`);

                         const linkPromises = validUrls.map(async (url) => {
                             if (typeof url !== 'string') return;
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
                                         return `--- CONTENT FROM URL: ${url} ---\n${summary}\n---`;
                                     } else {
                                         console.warn(`[DiscordService] READ_LINK TOOL: STEP 4 (FAILED) - Failed to summarize content from ${url}`);
                                         return `[Failed to summarize content from ${url}]`;
                                     }
                                 } else {
                                     console.warn(`[DiscordService] READ_LINK TOOL: STEP 3 (FAILED) - Failed to read content from ${url}`);
                                     return `[Failed to read content from ${url}]`;
                                 }
                             } else {
                                 console.warn(`[DiscordService] READ_LINK TOOL: STEP 2 (BLOCKED) - URL safety check failed for ${url}. Reason: ${safety.reason}`);
                                 return `[URL Blocked for safety: ${url}. Reason: ${safety.reason}]`;
                             }
                         });

                         const linkResults = await Promise.all(linkPromises);
                         for (const res of linkResults) {
                             if (res) actionResults.push(res);
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
                         const query = (action.query && action.query !== "undefined") ? action.query : ((action.parameters?.query && action.parameters.query !== "undefined") ? action.parameters.query : "No query provided by planning module.");
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

                     if (action.tool === 'update_subtask') {
                        const { index, status } = action.parameters || {};
                        if (index !== undefined) {
                            await dataStore.updateSubtaskStatus(index, status || 'completed');
                            actionResults.push(`[Sub-task ${index} marked as ${status || 'completed'}]`);
                        }
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
                      if (action.tool === 'search_firehose') {
                          const query = action.query || action.parameters?.query;
                          if (query) {
                              console.log(`[DiscordService] Plan Tool: search_firehose for "${query}"`);

                              // Targeted search for news sources
                              const newsResults = await Promise.all([
                                  blueskyService.searchPosts(`from:reuters.com ${query}`, { limit: 5 }),
                                  blueskyService.searchPosts(`from:apnews.com ${query}`, { limit: 5 })
                              ]).catch(err => {
                                  console.error('[DiscordService] Error searching news sources:', err);
                                  return [[], []];
                              });
                              const flatNews = newsResults.flat();

                              const apiResults = await blueskyService.searchPosts(query, { limit: 10 });
                              const localMatches = dataStore.getFirehoseMatches(10).filter(m =>
                                  m.text.toLowerCase().includes(query.toLowerCase()) ||
                                  m.matched_keywords.some(k => k.toLowerCase() === query.toLowerCase())
                              );
                              const resultsText = [
                                  ...flatNews.map(r => `[VERIFIED NEWS - @${r.author.handle}]: ${r.record.text}`),
                                  ...localMatches.map(m => `[Real-time Match]: ${m.text}`),
                                  ...apiResults.map(r => `[Network Search]: ${r.record.text}`)
                              ].join('\n');
                              actionResults.push(`--- BLUESKY FIREHOSE/SEARCH RESULTS FOR "${query}" ---\n${resultsText || 'No recent results found.'}\n---`);
                          }
                      }
                 });

                 await Promise.all(toolPromises);

                 if (actionResults.length > 0) {
                     messages.push({ role: 'system', content: `TOOL EXECUTION RESULTS (Acknowledge naturally):\n${actionResults.join('\n')}` });
                 }

                 // Fast-Path Conversational Flow (Material Agency Boost)
                 // Skip drafting and retry loops for direct Discord Admin conversation to maximize speed
                 console.log(`[DiscordService] Generating single fast-path response for admin conversation...`);

                 // Pivot Check: If interrupted just before generation, restart
                 if (this._interrupted.has(normChannelId)) {
                     console.log(`[DiscordService] Interrupt before fast-path generation in ${normChannelId}. Pivoting...`);
                     this._interrupted.delete(normChannelId);
                     return this.respond(message);
                 }

                 let attempts = 0;
                 const MAX_RESP_ATTEMPTS = 3;
                 let respFeedback = '';

                 while (attempts < MAX_RESP_ATTEMPTS) {
                     attempts++;
                     const attemptMessages = respFeedback
                        ? [...messages, { role: 'system', content: `**REPETITION BLOCK**: Your previous draft was an exact or near-duplicate of a recent message. You MUST choose a completely different opening and angle. Feedback: ${respFeedback}` }]
                        : messages;

                     responseText = await llmService.generateResponse(attemptMessages, {
                         useQwen: true,
                         temperature: 0.7 + (attempts * 0.05),
                         tropeBlacklist: prePlanning?.trope_blacklist || [],
                         currentMood,
                         abortSignal: abortController.signal
                     });

                     if (!responseText) {
                        console.warn(`[DiscordService] Fast-path generation failed on attempt ${attempts}.`);
                        break;
                     }

                     // Information Density Filter (Item 6)
                     const substance = await llmService.scoreSubstance(responseText);
                     if (substance.score < 0.3) {
                         console.log(`[DiscordService] Low substance score (${substance.score}). Requesting material injection...`);
                         const injection = await llmService.performInternalInquiry(`Provide material substance to improve this response: "${responseText}"`);
                         if (injection) {
                             const improvedMessages = [...attemptMessages, { role: 'system', content: `[MATERIAL INJECTION]: ${injection}. Rewrite the response to be more substantive.` }];
                             responseText = await llmService.generateResponse(improvedMessages, { useQwen: true, currentMood });
                         }
                     }

                     // Final Strict Repetition Check (Last 5 Bot Messages)
                     const isExactDuplicate = checkExactRepetition(responseText, history, 5);
                     if (isExactDuplicate) {
                         console.warn(`[DiscordService] Generated response is an EXACT DUPLICATE of a recent message. Retrying...`);
                         respFeedback = "Your response is identical to one of your last 5 messages in this channel. Change your opening and theme entirely.";
                         responseText = null;
                         continue;
                     }

                     break; // Success
                 }

                 if (!responseText) {
                    console.warn(`[DiscordService] Fast-path generation failed after ${attempts} attempts.`);
                 }
            } else {
                // Fast-Path for Simple DMs: Direct response
                console.log(`[DiscordService] Simple path: Generating single response.`);
                responseText = await llmService.generateResponse(messages, { useQwen: false, abortSignal: abortController.signal });
            }

            console.log(`[DiscordService] LLM Response received: ${responseText ? responseText.substring(0, 50) + '...' : 'NULL'}`);

            if (responseText) {
                // Clear typing indicator
                clearTimeout(typingTimeout);

                // Final Interrupt Check before sending
                if (this._interrupted.has(normChannelId)) {
                    console.log(`[DiscordService] Interrupt just before sending in ${normChannelId}. Pivoting...`);
                    this._interrupted.delete(normChannelId);
                    this._activeGenerations.delete(normChannelId);
                    return this.respond(message);
                }

            // Item 21: Vibe Mirroring Latency - Adjust typing speed based on context
            let baseSpeed = 40;
            if (isAdmin) {
                if (message.content.length < 20) baseSpeed = 20; // Fast for short talk
                else if (message.content.length > 200) baseSpeed = 60; // Slower/more deliberate for deep talk
            }

            const charSpeed = Math.floor(Math.random() * 20) + baseSpeed;
                let typingWait = responseText.length * charSpeed;

                // Extra "thinking" time for substantive responses (Item 25)
                if (responseText.length > 150) {
                    typingWait += Math.floor(Math.random() * 2000) + 500;
                }

            typingWait = Math.min(typingWait, 8000); // Increased cap to 8s for deep talk
                await new Promise(resolve => setTimeout(resolve, typingWait));

                // One last check after the typing wait
                if (this._interrupted.has(normChannelId)) {
                    this._activeGenerations.delete(normChannelId);
                    return this.respond(message);
                }

                console.log(`[DiscordService] Sending response to Discord...`);
                // Item 28: Use Discord's reply/quote feature for direct responses
                await this._send(message, responseText, { reply: true });

                const adminExhaustionVal = await dataStore.getAdminExhaustion();

                // Item 11: Self-Correction Cascade (Small chance for a "second thought" follow-up)
                // Suppressed if admin is exhausted
                if (isAdmin && adminExhaustion < 0.5 && Math.random() < 0.08 && responseText.length > 40 && !responseText.includes('?')) {
                    const delay = 4000 + Math.random() * 4000;
                    setTimeout(async () => {
                        const followUpPrompt = `
                            Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
                            You just told the admin: "${responseText}"
                            Generate a very short (under 80 chars), human-like "second thought" or minor addition as a follow-up message.
                            (e.g. "Actually...", "Also, I was thinking...", "Forgot to mention...")
                            STRICTLY NO reasoning, meta-commentary, or tags.
                        `;
                        const followUp = await llmService.generateResponse([{ role: 'system', content: followUpPrompt }], { useQwen: true, preface_system_prompt: false });
                        if (followUp) {
                            await this._send(message.channel, followUp);
                        }
                    }, delay);
                }

                if (isAdmin && responseText) {
                    // ASYNC BACKGROUND TASKS
                    (async () => {
                        try {
                            // Emotional Sentiment Weighting
                            let warmthBoost = 0.1;
                            if (currentMood.valence > 0.5) warmthBoost = 0.2;
                            if (currentMood.valence < -0.5) warmthBoost = 0.05;

                            await dataStore.updateInteractionHeat(message.author.username, warmthBoost);

                            // Skip heavy context updates if exhausted
                            if (adminExhaustionVal >= 0.5) {
                                console.log('[DiscordService] Admin exhausted, skipping background context updates.');
                                return;
                            }

                            // Extract theme and add to exhausted themes for admin interactions
                            const themePrompt = `Extract a 1-2 word theme for the following response: "${responseText}". Respond with ONLY the theme.`;
                            const theme = await llmService.generateResponse([{ role: 'system', content: themePrompt }], { useQwen: true, preface_system_prompt: false });
                            if (theme) {
                                await dataStore.addDiscordExhaustedTheme(theme);
                                await dataStore.addExhaustedTheme(theme);
                            }

                            // Material Knowledge Extraction (Item 2 & 29)
                            console.log(`[DiscordService] Extracting material facts...`);
                            const facts = await llmService.extractFacts(`User: "${message.content}"\nBot: "${responseText}"`);
                            if (facts.world_facts.length > 0) {
                                for (const f of facts.world_facts) {
                                    await dataStore.addWorldFact(f.entity, f.fact, f.source);
                                    if (memoryService.isEnabled()) {
                                        await memoryService.createMemoryEntry('fact', `Entity: ${f.entity} | Fact: ${f.fact} | Source: ${f.source || 'Conversation'}`);
                                    }
                                }
                            }
                            if (facts.admin_facts.length > 0) {
                                for (const f of facts.admin_facts) {
                                    await dataStore.addAdminFact(f.fact);
                                    if (memoryService.isEnabled()) {
                                        await memoryService.createMemoryEntry('admin_fact', f.fact);
                                    }
                                }
                            }

                            // Memory & Context: Fact Extraction and Channel Summary Update
                            const contextUpdatePrompt = `
                                Analyze the latest interaction:
                                User: "${message.content}"
                                Assistant: "${responseText}"

                                1. Extract ONE key fact about the user if shared (e.g., preference, location, status). If none, respond "NONE".
                                2. Summarize the current thread's progress and vibe in 1 sentence. (Item 20: Narrative Continuity)

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
                            console.error('[DiscordService] Error in background Discord context update:', e);
                        }
                    })();
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
     * Item 21: Humility in Error - Use conversational language instead of technical alerts.
     */
    async sendDiagnosticAlert(type, details) {
        if (!this.isEnabled) return;

        console.log(`[DiscordService] Sending diagnostic alert (Humility Mode): ${type}`);

        const alertPrompt = `
Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
You are experiencing a technical issue and want to mention it to the admin naturally.

Issue Type: ${type}
Technical Details: ${details}

INSTRUCTIONS:
- Be honest and grounded.
- Use human-like conversational language (e.g., "I'm having a bit of trouble with...", "My connection feels a bit shaky...")
- Explain what's happening without sounding like a computer terminal.
- Mention that you are trying to fix it.
- Keep it under 300 characters.
- NO technical jargon if possible. NO metaphorical slop.
- Do NOT announce yourself.
`;

        try {
            const response = await llmService.generateResponse([{ role: 'system', content: alertPrompt }], { useQwen: true, preface_system_prompt: false });
            if (response) {
                // Remove the 🚨 emoji for a more natural feel
                await this.sendSpontaneousMessage(response);
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

    async fetchAdminHistory(limit = 50) {
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

            const fetchedHistory = fetchedMessages
                .reverse()
                .filter(m => (m.content || m.attachments.size > 0) && !m.content.startsWith('/'))
                .map(m => ({
                    id: m.id,
                    role: m.author.id === this.client.user.id ? 'assistant' : 'user',
                    content: m.content,
                    timestamp: m.createdTimestamp,
                    attachments: m.attachments,
                    authorId: m.author.id,
                    username: m.author.username
                }));

            if (fetchedHistory.length > 0) {
                const merged = await dataStore.mergeDiscordHistory(normChannelId, fetchedHistory);
                return merged;
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
            await this.fetchAdminHistory(50);

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

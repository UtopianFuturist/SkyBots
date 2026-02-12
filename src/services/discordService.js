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
            // Enhanced WebSocket/Gateway debugging
            if (info.includes('WebSocket') || info.includes('Gateway') || info.includes('Heartbeat')) {
                console.log('[DiscordService] DEBUG (Connection):', info);
            } else {
                // Still log other debug info but maybe less prominently
                // console.log('[DiscordService] DEBUG:', info);
            }
        });

        this.client.on('shardError', (error) => {
            console.error('[DiscordService] Shard Error:', error);
        });

        this.client.on('shardDisconnect', (event) => {
            console.warn('[DiscordService] Shard Disconnected:', event);
            this.status = 'offline';
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

        const isDM = message.channel.type === ChannelType.DM;
        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
        const isMentioned = message.mentions.has(this.client.user) || message.content.includes(this.nickname);

        console.log(`[DiscordService] Evaluating message from ${message.author.username}. isDM: ${isDM}, isAdmin: ${isAdmin}, isMentioned: ${isMentioned}`);

        if (!isDM && !isMentioned) {
            return;
        }

        if (isAdmin && !this.adminId) {
            this.adminId = message.author.id;
            console.log(`[DiscordService] Admin ID identified: ${this.adminId}`);
        }

        console.log(`[DiscordService] Processing message: "${message.content.substring(0, 50)}..."`);

        if (isAdmin) {
            await dataStore.setDiscordLastReplied(true);
        }

        const normChannelId = this.getNormalizedChannelId(message);
        await dataStore.saveDiscordInteraction(normChannelId, 'user', message.content, {
            authorId: message.author.id,
            username: message.author.username
        });

        // Handle commands
        if (message.content.startsWith('/')) {
            await this.handleCommand(message);
            return;
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
            const chunks = splitTextForDiscord(sanitized);
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

                // Small delay to ensure order if there are multiple chunks
                if (chunks.length > 1 && i < chunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 800));
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
                const result = await imageService.generateImage(prompt, { allowPortraits: true });
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
    }

    async respond(message) {
        const normChannelId = this.getNormalizedChannelId(message);
        console.log(`[DiscordService] Generating response for channel: ${message.channel.id} (normalized: ${normChannelId})`);

        let imageAnalysisResult = '';
        if (message.attachments.size > 0) {
            console.log(`[DiscordService] Detected ${message.attachments.size} attachments. Starting vision analysis...`);
            for (const [id, attachment] of message.attachments) {
                if (attachment.contentType?.startsWith('image/')) {
                    try {
                        const includeSensory = await llmService.shouldIncludeSensory(config.TEXT_SYSTEM_PROMPT);
                        const analysis = await llmService.analyzeImage(attachment.url, null, { sensory: includeSensory });
                        if (analysis) {
                            imageAnalysisResult += `[Image attached by user: ${analysis}] `;
                        }
                    } catch (err) {
                        console.error(`[DiscordService] Error analyzing Discord attachment:`, err);
                    }
                }
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

        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
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
6. **ADMIN STATE AWARENESS**: If the admin has just returned from sleep or a long break that they previously mentioned, acknowledge it naturally (e.g., "Hope you slept well," or "How was work?").
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
`.trim();

        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.slice(-20).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: `${h.role === 'assistant' ? 'Assistant (Self)' : 'User (Admin)'}: ${h.content}` }))
        ];

        try {
            console.log(`[DiscordService] Sending typing indicator...`);
            await message.channel.sendTyping();

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

                 while (planAttempts < MAX_PLAN_ATTEMPTS) {
                     planAttempts++;
                     console.log(`[DiscordService] Admin Planning Attempt ${planAttempts}/${MAX_PLAN_ATTEMPTS}`);

                     plan = await llmService.performAgenticPlanning(message.content, history.map(h => ({ author: h.role === 'user' ? 'user' : 'assistant', text: h.content })), imageAnalysisResult, true, 'discord', exhaustedThemes, dConfig, planFeedback, this.status, refusalCounts, latestMoodMemory, prePlanning);
                     console.log(`[DiscordService] Agentic plan: ${JSON.stringify(plan)}`);

                     // Autonomous Refusal Poll
                     const intentionality = await llmService.evaluateIntentionality(plan, {
                         history: history.map(h => ({ author: h.role === 'user' ? 'user' : 'assistant', text: h.content })),
                         platform: 'discord',
                         currentMood,
                         refusalCounts,
                         latestMoodMemory,
                         feedback: planFeedback
                     });

                     if (intentionality.decision === 'refuse') {
                         console.log(`[DiscordService] AGENT REFUSED TO ACT: ${intentionality.reason}`);
                         await dataStore.incrementRefusalCount('discord');

                         // Option to generate alternative action
                         const alternative = await llmService.generateAlternativeAction(intentionality.reason, 'discord', { username: message.author.username, content: message.content });
                         if (alternative && alternative.toUpperCase() !== 'NONE' && planAttempts < MAX_PLAN_ATTEMPTS) {
                             console.log(`[DiscordService] Alternative action proposed: "${alternative}". Re-planning...`);

                             // Melancholic Refusal [RESEARCH] pivot:
                             const isMelancholic = intentionality.reason.toLowerCase().includes('melancholy') ||
                                                 intentionality.reason.toLowerCase().includes('sad') ||
                                                 intentionality.reason.toLowerCase().includes('fragmented') ||
                                                 currentMood.label.toLowerCase().includes('melancholy');

                             if (isMelancholic) {
                                 const askTalk = `Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}. You just refused a plan due to a melancholic internal state. You suggested an alternative: "${alternative}". Would you like to talk about this feeling in a private self-dialogue (Research Call) before continuing? Respond with ONLY "yes" or "no".`;
                                 const wantToTalk = await llmService.generateResponse([{ role: 'system', content: askTalk }], { useQwen: true, preface_system_prompt: false });
                                 if (wantToTalk?.toLowerCase().includes('yes')) {
                                     console.log(`[DiscordService] Triggering melancholic self-dialogue Research call.`);
                                     const dialogue = await llmService.performInternalResearch(`Reflect on these melancholic feelings: ${intentionality.reason}. Explore why you chose the alternative: ${alternative}.`);
                                     if (dialogue && memoryService.isEnabled()) {
                                         await memoryService.createMemoryEntry('research', `[RESEARCH] Melancholic reflection: ${dialogue}`);
                                     }
                                     planFeedback = `Your previous plan was refused due to melancholy: ${intentionality.reason}. You had a self-dialogue about it: "${dialogue}". Now, execute your alternative desire: "${alternative}".`;
                                     continue;
                                 }
                             }

                             planFeedback = `Your previous plan was refused: ${intentionality.reason}. You suggested this alternative instead: "${alternative}". Generate a new plan based on this.`;
                             continue;
                         }

                         // Option to explain refusal / Negotiation
                         const shouldExplain = await llmService.shouldExplainRefusal(intentionality.reason, 'discord', { username: message.author.username, content: message.content });
                         if (shouldExplain) {
                             const explanation = await llmService.generateRefusalExplanation(intentionality.reason, 'discord', { username: message.author.username, content: message.content });
                             if (explanation) {
                                 console.log(`[DiscordService] Explaining refusal to admin: "${explanation}"`);
                                 await this._send(message.channel, explanation);
                             }
                         }
                         return; // End engagement if refused and no alternative or max attempts reached
                     }

                     // If we reached here, plan was accepted
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
                             const imgResult = await imageService.generateImage(prompt_for_image, { allowPortraits: true });
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
                         if (query.includes('plan') || query.includes('agency') || query.includes('action') || query.includes('function')) {
                             logs = await renderService.getPlanningLogs(limit);
                         } else {
                             logs = await renderService.getLogs(limit);
                         }
                         actionResults.push(`[Render Logs (Latest ${limit} lines):\n${logs}\n]`);
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
                             const imgResult = await imageService.generateImage(prompt, { allowPortraits: true });
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
                     if (action.tool === 'internal_research') {
                         const query = action.query || action.parameters?.query;
                         if (query) {
                             const result = await llmService.performInternalResearch(query);
                             if (result) {
                                 actionResults.push(`[Internal Research Result for "${query}": ${result}]`);
                                 if (memoryService.isEnabled()) {
                                     await memoryService.createMemoryEntry('research', `[RESEARCH] Query: ${query}. Result: ${result}`);
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

                 // Opening Phrase Blacklist: Track first 10 words of last 12 messages
                 const recentBotMsgs = history.filter(h => h.role === 'assistant').slice(-12);
                 const openingBlacklist = recentBotMsgs.map(m => {
                     const words = m.content.split(/\s+/).slice(0, 10).join(' ');
                     return words;
                 });

                 while (attempts < MAX_ATTEMPTS) {
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
                             additionalConstraints
                         });
                     } else {
                         const singleResponse = await llmService.generateResponse(finalMessages, {
                             useQwen: true,
                             temperature: currentTemp,
                             openingBlacklist,
                             tropeBlacklist: prePlanning?.trope_blacklist || [],
                             additionalConstraints
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
                             const [varietyCheck, personaCheck] = await Promise.all([
                                 llmService.checkVariety(cand, formattedHistory, { relationshipRating: relRating, platform: 'discord' }),
                                 llmService.isPersonaAligned(cand, 'discord')
                             ]);
                             return { cand, containsSlop, varietyCheck, personaCheck };
                         } catch (e) {
                             console.error(`[DiscordService] Error evaluating candidate: ${e.message}`);
                             return { cand, error: e.message };
                         }
                     }));

                     for (const evalResult of evaluations) {
                         const { cand, containsSlop, varietyCheck, personaCheck, error } = evalResult;
                         if (error) {
                             rejectedAttempts.push(cand);
                             continue;
                         }

                         // Length-based depth bonus (favor longer, more substantive responses)
                         const lengthBonus = Math.min(cand.length / 500, 0.2); // Up to 0.2 bonus for 500+ chars
                         const score = (varietyCheck.score || 0) + lengthBonus;

                         console.log(`[DiscordService] Candidate evaluation: Score=${score.toFixed(2)} (Variety: ${varietyCheck.score}, Bonus: ${lengthBonus.toFixed(2)}), Slop=${containsSlop}, Aligned=${personaCheck.aligned}`);

                         if (!containsSlop && !varietyCheck.repetitive && personaCheck.aligned) {
                             if (score > bestScore) {
                                 bestScore = score;
                                 bestCandidate = cand;
                             }
                         } else {
                             if (!bestCandidate) {
                                 rejectionReason = containsSlop ? "Contains metaphorical slop." :
                                                   (!personaCheck.aligned ? `Not persona aligned: ${personaCheck.feedback}` :
                                                   (varietyCheck.feedback || "Too similar to recent history."));

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
                         responseText = bestCandidate;
                         break;
                     } else {
                         feedback = `REJECTED: ${rejectionReason}`;
                         console.log(`[DiscordService] Attempt ${attempts} failed. Feedback: ${feedback}`);

                         // If it's the last attempt, pick the least-bad one (highest score)
                         if (attempts === MAX_ATTEMPTS && rejectedAttempts.length > 0) {
                             console.log(`[DiscordService] Final attempt failed. Choosing least-bad response from ${rejectedAttempts.length} attempts.`);
                             // Just pick one that isn't slop if possible
                             const nonSlop = rejectedAttempts.filter(a => !isSlop(a));
                             responseText = nonSlop.length > 0 ? nonSlop[nonSlop.length - 1] : rejectedAttempts[rejectedAttempts.length - 1];
                             responseText = `[Varied] ${responseText}`; // Mark as forced variation
                         }
                     }
                 }
            } else {
                responseText = await llmService.generateResponse(messages);
            }

            console.log(`[DiscordService] LLM Response received: ${responseText ? responseText.substring(0, 50) + '...' : 'NULL'}`);

            if (responseText) {
                console.log(`[DiscordService] Sending response to Discord...`);
                await this._send(message.channel, responseText);

                if (isAdmin && responseText && !responseText.startsWith('[Varied]')) {
                    // Extract theme and add to exhausted themes for admin interactions
                    try {
                        const themePrompt = `Extract a 1-2 word theme for the following response: "${responseText}". Respond with ONLY the theme.`;
                        const theme = await llmService.generateResponse([{ role: 'system', content: themePrompt }], { useQwen: true, preface_system_prompt: false });
                        if (theme) {
                            await dataStore.addDiscordExhaustedTheme(theme);
                            await dataStore.addExhaustedTheme(theme);
                        }
                    } catch (e) {
                        console.error('[DiscordService] Error extracting theme for exhausted list:', e);
                    }
                }
            }
        } catch (error) {
            console.error('[DiscordService] Error responding to message:', error);
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
}

export const discordService = new DiscordService();

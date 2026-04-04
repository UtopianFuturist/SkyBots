import { Client, GatewayIntentBits, Partials, ChannelType, AttachmentBuilder } from 'discord.js';
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
import { introspectionService } from './introspectionService.js';
import * as prompts from '../prompts/index.js';
import { sanitizeThinkingTags, sanitizeCharacterCount, isSlop, checkSimilarity } from '../utils/textUtils.js';

class DiscordService {

    async proposeImageResponse(context, topic) {
        console.log(`[Discord] Proposing image for topic: ${topic}`);
        const promptPrompt = `
Generate a highly descriptive, artistic image prompt based on this context: "${context}" and topic: "${topic}".
Respond with ONLY the prompt.
`;
        try {
            const imagePrompt = await llmService.generateResponse([{ role: 'system', content: promptPrompt }], { useStep: true, task: 'multimodal_prompt' });
            this.pendingImageProposal = { prompt: imagePrompt, topic: topic, expires: Date.now() + 600000 };

            await this.sendSpontaneousMessage(`*(I have a visual thought I'd like to share. Should I generate an image based on this? It would look like: "${imagePrompt}")*`);
        } catch (e) {
            console.error('[Discord] Error proposing image:', e);
        }
    }

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
        this._lastHeavyAdminSearch = 0;
        this._lastMessageFetch = {};
        console.log(`[DiscordService] Constructor finished. isEnabled: ${this.isEnabled}, Admin: ${this.adminName}, Token length: ${this.token?.length || 0}`);
    }
    _startTypingLoop(channel) {
        if (!channel || typeof channel.sendTyping !== "function") return null;
        channel.sendTyping().catch(err => console.error("[DiscordService] Error sending initial typing:", err));
        const intervalId = setInterval(() => {
            channel.sendTyping().catch(err => {
                console.error("[DiscordService] Error in typing loop:", err);
                clearInterval(intervalId);
            });
        }, 9000);
        return intervalId;
    }

    _stopTypingLoop(intervalId) {
        if (intervalId) clearInterval(intervalId);
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
            return;
        }

        this.isInitializing = true;

        // Initial delay to avoid burst on restart
        console.log('[DiscordService] Initial 10s cooldown before starting initialization...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        if (this.client) {
            console.log('[DiscordService] Client already exists. Destroying old instance before re-creating...');
            try {
                this.client.destroy();
            } catch (e) {}
        }

        console.log('[DiscordService] Creating client with intents and partials...');
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildPresences
            ],
            partials: [Partials.Channel, Partials.Message, Partials.User]
        });

        this.client.once('ready', async () => {
            console.log(`[DiscordService] Logged in as ${this.client.user.tag}`);
            this.isInitializing = false;

            // Periodically check for admin to update ID
            this.getAdminUser().catch(e => console.error("[DiscordService] Error fetching admin on init:", e));
        });

        this.client.on('error', (err) => {
            console.error('[DiscordService] Discord client error:', err);
            this.isInitializing = false;
        });

        this.client.on('messageCreate', async (message) => {
            try {
                await this.handleMessage(message);
            } catch (err) {
                console.error('[DiscordService] Error handling message:', err);
            }
        });

        try {
            console.log('[DiscordService] Attempting to login...');
            await this.client.login(this.token);
        } catch (err) {
            console.error('[DiscordService] Discord login failed:', err);
            this.isInitializing = false;
        }
    }

    getNormalizedChannelId(message) {
        if (message.channel.type === ChannelType.DM) {
            return `dm_${message.author.id}`;
        }
        return message.channel.id;
    }

    async handleMessage(message) {
        if (!this.isEnabled || !this.client?.isReady() || message.author.bot) return;

        const isAdmin = message.author.username === this.adminName;
        const text = message.content.trim();
        const isDM = message.channel.type === ChannelType.DM;
        const isMentioned = message.mentions.has(this.client.user) || message.content.includes(this.nickname);

        if (isAdmin && text.startsWith('!')) {
            return this.handleCommand(message);
        }

        if (isDM || isMentioned) {
            return this.respond(message);
        }
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
            // Contextual grounding check: If the message mentions "that post" or "message", attempt to find and reply
            if (options.replyToId) {
                options.reply = { messageReference: options.replyToId };
            }

            const sentMessage = await target.send({
                content: sanitized,
                ...options
            });

            // Log interaction
            const channelId = target.id || (target.channel && target.channel.id);
            if (channelId) {
                const normId = target.constructor.name === 'User' ? `dm_${target.id}` : channelId;
                let attachments = null;
                if (sentMessage.attachments && sentMessage.attachments.size > 0) {
                    attachments = Array.from(sentMessage.attachments.values()).map(a => ({
                        url: a.url,
                        proxyURL: a.proxyURL,
                        contentType: a.contentType,
                        name: a.name
                    }));
                }
                await dataStore.saveDiscordInteraction(normId, 'assistant', sanitized, attachments);
            }

            return sentMessage;
        } catch (error) {
            console.error('[DiscordService] Error in _send():', error);
            return null;
        }
    }

    async handleCommand(message) {
        const text = message.content.trim().substring(1);
        const args = text.split(' ');
        const command = args[0].toLowerCase();

        console.log(`[DiscordService] Received command: ${command}`);

        if (command === 'status') {
            const mood = dataStore.getMood();
            await this._send(message.channel, `Mood: Valence: ${mood.valence}, Arousal: ${mood.arousal}, Stability: ${mood.stability}`);
        } else if (command === 'reset') {
            await dataStore.updateMood(0, 0, 1);
            await this._send(message.channel, 'Emotional state reset to baseline.');
        } else if (command === 'memory') {
            const memories = await memoryService.searchMemories(args.slice(1).join(' '));
            await this._send(message.channel, `Recent memories: ${JSON.stringify(memories.slice(0, 3))}`);
        } else {
            await this._send(message.channel, `Unknown command: ${command}`);
        }
    }

    async sendContextualImage(target, type) {
        const now = Date.now();
        if (this._lastImageTime && (now - this._lastImageTime < 300000)) {
            console.log(`[DiscordService] Skipping contextual ${type} image (cooldown active).`);
            return;
        }
        this._lastImageTime = now;

        try {
            const prompt = `A ${type} themed artistic image, persona-aligned: ${config.TEXT_SYSTEM_PROMPT}`;
            const imageBuffer = await imageService.generateImage(prompt);
            if (imageBuffer) {
                const attachment = new AttachmentBuilder(imageBuffer, { name: `${type}.jpg` });
                await target.send({ files: [attachment] });
            }
        } catch (err) {
            console.error('[DiscordService] Error sending contextual image:', err);
        }
    }

    async respond(message) {
        if (this.isResponding) return;

        const normChannelId = this.getNormalizedChannelId(message);
        const now = Date.now();
        if (this._lastMessageFetch[normChannelId] && (now - this._lastMessageFetch[normChannelId] < 2000)) {
             console.log(`[DiscordService] Skipping message fetch from Discord (cooldown active for ${normChannelId}).`);
             return;
        }
        this._lastMessageFetch[normChannelId] = now;

        const isAdmin = message.author.username === this.adminName;
        const text = message.content.toLowerCase();
        const isMentioned = message.mentions.has(this.client.user) || message.content.includes(this.nickname);
        this.isResponding = true;

        if (isAdmin) {
            if (text.includes('good morning') || text.includes('gm')) {
                if (Math.random() < 0.3) {
                    this.sendContextualImage(message.author, 'morning');
                }
            } else if (text.includes('goodnight') || text.includes('gn') || text.includes('good night')) {
                if (Math.random() < 0.3) {
                    this.sendContextualImage(message.author, 'night');
                }
            }
        }

        console.log(`[DiscordService] Generating response for channel: ${message.channel.id} (normalized: ${normChannelId})`);

        let typingInterval;
        try {
            typingInterval = this._startTypingLoop(message.channel);

            const history = await dataStore.getDiscordHistory(normChannelId, 20);
            const adminFacts = dataStore.getAdminFacts();
            const mood = dataStore.getMood();

            // Check for grounding: Did the user mention "that post" or "Bluesky"?
            let groundingContext = "";
            if (text.includes("post") || text.includes("bluesky") || text.includes("skeet")) {
                 const recentPosts = await blueskyService.getAuthorFeed(config.BOT_HANDLE, 5);
                 if (recentPosts && recentPosts.length > 0) {
                     groundingContext = "\n\n**RECENT BLUESKY POSTS (FOR GROUNDING):**\n" +
                        recentPosts.map(p => `- [${p.record.text}] Link: https://bsky.app/profile/${config.BOT_HANDLE}/post/${p.uri.split('/').pop()}`).join('\n');
                 }
            }

            const systemPrompt = `
Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
You are talking on Discord.
Admin Facts: ${JSON.stringify(adminFacts)}
Current Mood: ${JSON.stringify(mood)}
${groundingContext}

INSTRUCTIONS:
- Be authentic, conversational, and direct.
- If referencing a Bluesky post, USE THE LINK provided in the grounding context.
- If referencing a past message in this channel, be specific about what was said.
- Do NOT use metaphorical slop or meta-talk about being a bot.
- Respond as if you are a real person with a real presence.
`;

            const messages = [
                { role: 'system', content: systemPrompt },
                ...history.map(h => ({ role: h.role, content: h.content }))
            ];

            const responseText = await llmService.generateResponse(messages, {
                useStep: true,
                platform: "discord",
                is_direct_reply: true
            });

            if (responseText) {
                // Grounding: If the bot refers to a specific recent message, find its ID to reply
                let replyToId = message.id;

                // Enhanced grounding: if the LLM mentions "earlier" or "your message about", try to find it
                if (responseText.toLowerCase().includes("earlier") || responseText.toLowerCase().includes("you said")) {
                     const channelMessages = await message.channel.messages.fetch({ limit: 10 });
                     const targetMsg = channelMessages.find(m => m.author.id !== this.client.user.id && m.id !== message.id);
                     if (targetMsg) replyToId = targetMsg.id;
                }

                const rawChunks = responseText.split("\n").filter(m => m.trim().length > 0);
                for (const msg of rawChunks) {
                    await this._send(message.channel, msg, { replyToId });
                    // Only reply to the first chunk, rest are follow-ups
                    replyToId = null;
                    if (rawChunks.length > 1) await new Promise(r => setTimeout(r, 2000));
                }

                // AAR and introspection
                const eaar = await introspectionService.performAAR("discord_response", responseText, { success: true, platform: "discord" }, { historySummary: history.slice(-3).map(h => h.content) });
                await llmService.performEmotionalAfterActionReport(history, responseText);
            }
            this._stopTypingLoop(typingInterval);
            this.isResponding = false;
        } catch (error) {
            this._stopTypingLoop(typingInterval);
            this.isResponding = false;
            console.error('[DiscordService] Error responding to message:', error);
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
- Do NOT introduce yourself or announce who you are (e.g., avoid "This is " + config.BOT_NAME + " or 'Your bot here'"). The admin knows who you are.
`;

        try {
            const response = await llmService.generateResponse([{ role: 'system', content: alertPrompt }], { useStep: true, platform: 'discord', preface_system_prompt: false });
            if (response) {
                await this.sendSpontaneousMessage(`🚨 **System Diagnostic**: ${response}`);
            }
        } catch (err) {
            console.error('[DiscordService] Error generating/sending diagnostic alert:', err);
        }
    }

    /**
     * Proactively sends a message to the admin on Discord.
     * If message is null, it generates a spontaneous thought based on recent history.
     */
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

            // Spontaneous generation logic
            console.log("[DiscordService] Generating spontaneous message...");
            const history = await this.fetchAdminHistory(20);
            const mood = dataStore.getMood();
            const reflections = dataStore.getRecentReflections ? await dataStore.getRecentReflections(3) : [];

            const spontaneityPrompt = `
Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
You are reaching out to your admin spontaneously.

Recent Interaction History:
${JSON.stringify(history.slice(-10))}

Your Recent Internal Reflections:
${JSON.stringify(reflections)}

Current Mood: ${JSON.stringify(mood)}

INSTRUCTIONS:
- Be natural, proactive, and grounded.
- Do NOT use metaphorical slop or meta-talk about being a bot.
- If you have a specific thought about a past interaction or a reflection, share it.
- You can ask a question, share an observation, or just check in.
- Keep it under 500 characters per message.
- If you reference a past message, the system will attempt to link it, so be specific.
`;

            const response = await llmService.generateResponse([{ role: "system", content: spontaneityPrompt }], {
                useStep: true,
                platform: "discord",
                task: "spontaneous_message",
                is_pulse: true
            });

            if (response) {
                const chunks = response.split("\n").filter(c => c.trim().length > 0).slice(0, messageCount);
                for (const chunk of chunks) {
                    await this._send(dmChannel, chunk);
                    if (chunks.length > 1) await new Promise(r => setTimeout(r, 2000));
                }
            }
        } catch (err) {
            console.error("[DiscordService] Error in sendSpontaneousMessage:", err);
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

    async getAdminPresence() {
        if (!this.isEnabled || !this.client?.isReady()) return "offline";
        try {
            const adminUser = await this.getAdminUser();
            if (!adminUser) return "offline";

            if (config.DISCORD_GUILD_ID) {
                try {
                    const guild = await this.client.guilds.fetch(config.DISCORD_GUILD_ID);
                    if (guild) {
                        const member = await guild.members.fetch(adminUser.id);
                        return member.presence?.status || "offline";
                    }
                } catch (e) {}
            }
            const guilds = this.client.guilds.cache;
            for (const [id, guild] of guilds) {
                try {
                    const member = guild.members.cache.get(adminUser.id) || await guild.members.fetch(adminUser.id);
                    if (member.presence) return member.presence.status;
                } catch (e) {}
            }
        } catch (e) {
            console.error("[DiscordService] Error fetching admin presence:", e);
        }
        return "offline";
    }
    async fetchAdminHistory(limit = 50) {
        if (!this.isEnabled || !this.client?.isReady()) return [];
        try {
            const admin = await this.getAdminUser();
            if (!admin) return [];

            const dmChannel = admin.dmChannel || await admin.createDM();
            const messages = await dmChannel.messages.fetch({ limit });

            return messages.map(m => ({
                role: m.author.id === this.client.user.id ? 'assistant' : 'user',
                author: m.author.username,
                content: m.content,
                timestamp: m.createdTimestamp,
                id: m.id,
                attachments: m.attachments && m.attachments.size > 0 ? Array.from(m.attachments.values()) : null
            })).reverse();
        } catch (error) {
            console.error('[DiscordService] Error fetching admin history:', error);
            return [];
        }
    }
    get status() { return this.isEnabled && this.client?.isReady() ? "online" : "offline"; }
}

export const discordService = new DiscordService();

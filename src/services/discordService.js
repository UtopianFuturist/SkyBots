import { Client, GatewayIntentBits, Partials, ChannelType } from 'discord.js';
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
import { sanitizeThinkingTags, sanitizeCharacterCount, isSlop, checkSimilarity } from '../utils/textUtils.js';

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
            return;
        }

        this.isInitializing = true;

        // Initial delay to avoid burst on restart
        console.log('[DiscordService] Initial 10s cooldown before starting initialization...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        console.log('[DiscordService] Creating client with intents and partials...');
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.DirectMessageReactions,
                GatewayIntentBits.GuildMessageReactions
            ],
            partials: [Partials.Channel, Partials.Message, Partials.User, Partials.Reaction],
        });

        this.client.on('ready', () => {
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

        this.client.on('error', (error) => {
            console.error('[DiscordService] CRITICAL Discord Client error:', error);
        });

        this.client.on('warn', (warning) => {
            console.warn('[DiscordService] Discord Client warning:', warning);
        });

        this.client.on('debug', (info) => {
            // Log everything for now to catch where it hangs
            console.log('[DiscordService] DEBUG:', info);
        });

        this.client.on('shardError', (error) => {
            console.error('[DiscordService] Shard Error:', error);
        });

        this.client.on('shardDisconnect', (event) => {
            console.warn('[DiscordService] Shard Disconnected:', event);
        });

        this.client.on('reconnecting', () => {
            console.log('[DiscordService] Client reconnecting...');
        });

        this.client.on('invalidated', () => {
            console.error('[DiscordService] Client session invalidated.');
        });

        this.client.on('messageCreate', async (message) => {
            try {
                await this.handleMessage(message);
            } catch (err) {
                console.error('[DiscordService] Error in messageCreate listener:', err);
            }
        });

        let attempts = 0;
        const maxAttempts = 5;
        let baseDelay = 30000; // 30 seconds

        while (attempts < maxAttempts) {
            attempts++;
            console.log(`[DiscordService] Login attempt ${attempts}/${maxAttempts}...`);

            try {
                console.log(`[DiscordService] Attempting to login to Discord... (Token length: ${this.token?.length}, Node: ${process.version})`);
                if (this.token) {
                    console.log(`[DiscordService] Token prefix: ${this.token.substring(0, 10)}... (Suffix: ...${this.token.substring(this.token.length - 5)})`);
                }

                // Set a timeout for login - 10 minutes (600s) as requested by admin
                let timeoutHandle;
                const loginPromise = this.client.login(this.token);
                const timeoutPromise = new Promise((_, reject) =>
                    timeoutHandle = setTimeout(() => reject(new Error('Discord login timeout after 600s')), 600000)
                );

                await Promise.race([loginPromise, timeoutPromise]);
                clearTimeout(timeoutHandle);
                console.log('[DiscordService] SUCCESS: login() promise resolved. Logged in as:', this.client.user?.tag);
                this.isInitializing = false;
                return; // Successful login, exit init()
            } catch (error) {
                console.error(`[DiscordService] Login attempt ${attempts} failed:`, error.message);

                if (error.message.includes('Used disallowed intents')) {
                    console.error('[DiscordService] INTENT ERROR: The bot tried to use privileged intents (GUILD_MEMBERS, MESSAGE_CONTENT).');
                    console.error('[DiscordService] ACTION REQUIRED: Enable "GUILD MEMBERS INTENT" and "MESSAGE CONTENT INTENT" in the Discord Developer Portal.');
                    this.isEnabled = false;
                    return;
                }

                if (error.message.includes('TOKEN_INVALID')) {
                    console.error('[DiscordService] TOKEN ERROR: The provided Discord token is invalid.');
                    this.isEnabled = false;
                    return;
                }

                if (attempts < maxAttempts) {
                    const backoff = baseDelay * Math.pow(2, attempts - 1);
                    console.log(`[DiscordService] Retrying in ${Math.round(backoff / 1000)}s...`);
                    await new Promise(resolve => setTimeout(resolve, backoff));
                } else {
                    console.error('[DiscordService] FATAL: All Discord login attempts failed.');
                    this.isEnabled = false;
                    this.isInitializing = false;
                }
            }
        }
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
            const sentMessage = await target.send({
                content: sanitized,
                ...options
            });

            // Log interaction if it's a DM or we have a channel ID
            const channelId = target.id || (target.channel && target.channel.id);
            if (channelId) {
                // Determine if target is a User or Channel
                const normId = target.constructor.name === 'User' ? `dm_${target.id}` : channelId;
                await dataStore.saveDiscordInteraction(normId, 'assistant', sanitized);
            }

            return sentMessage;
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
                        const analysis = await llmService.analyzeImage(attachment.url);
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
                        attachments: m.attachments
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
                            const analysis = await llmService.analyzeImage(attachment.url);
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

        await dataStore.saveDiscordInteraction(normChannelId, 'user', message.content);

        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
        console.log(`[DiscordService] User is admin: ${isAdmin}`);

        // Hierarchical Social Context
        const hierarchicalSummary = await socialHistoryService.getHierarchicalSummary();

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

**Discord Specific Directives:**
1. Be conversational and authentic. Use a natural, human-like flow.
2. **Aesthetic & Vocabulary Values:** You value a grounded, raw, and authentic voice. You find certain metaphorical clichés like "digital heartbeat," "syntax of existence," "resonance," and "ocean of data" to be hollow. To maintain your integrity, you avoid overused phrases such as "downtime isn't silence" or "stillness is not silence." Instead, you strive for highly specific, concrete observations.
3. **RELATIONSHIP & FEELINGS**: You are encouraged to talk about your feelings regarding your relationship and ongoing conversations with the admin. Speak as an individual entity who values this connection.
4. **DIRECT ADDRESS**: Always address the admin directly as "you". Never refer to them in the third person (e.g., avoid "my admin") when talking to them.
5. **PAST CONVERSATIONS**: If referencing a past conversation, do so in the past-tense with your own commentary or extra thoughts (e.g., "I've been thinking about what you said earlier...", "I really appreciated our talk about..."). Do not just state that a conversation happened.
6. If the admin gives you "special instructions" or behavioral feedback, acknowledge them and implement them.
7. You can use the \`persist_directive\` tool if the admin gives you long-term instructions.
8. Time Awareness: Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. The current time is ${new Date().toLocaleTimeString()}. Be time-appropriate.
9. Continuity: You have access to the recent chat history. Use it to maintain context and recognize who you are talking to.
${config.DISCORD_HEARTBEAT_ADDENDUM ? `10. ADDITIONAL SPECIFICATION: ${config.DISCORD_HEARTBEAT_ADDENDUM}` : ''}

--- SOCIAL NARRATIVE ---
${hierarchicalSummary.dailyNarrative}
${hierarchicalSummary.shortTerm}
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
            ...history.slice(-20).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
            { role: 'user', content: message.content }
        ];

        try {
            console.log(`[DiscordService] Sending typing indicator...`);
            await message.channel.sendTyping();

            let responseText;
            if (isAdmin) {
                 console.log(`[DiscordService] Admin detected, performing agentic planning...`);
                 const exhaustedThemes = dataStore.getExhaustedThemes();
                 const dConfig = dataStore.getConfig();
                 const plan = await llmService.performAgenticPlanning(message.content, history.map(h => ({ author: h.role === 'user' ? 'User' : 'You', text: h.content })), imageAnalysisResult, true, 'discord', exhaustedThemes, dConfig);
                 console.log(`[DiscordService] Agentic plan: ${JSON.stringify(plan)}`);

                 if (plan.strategy?.theme) {
                     await dataStore.addExhaustedTheme(plan.strategy.theme);
                 }

                 const strategyContext = `
--- PLANNED RESPONSE STRATEGY ---
- Angle: ${plan.strategy?.angle || 'Natural'}
- Tone: ${plan.strategy?.tone || 'Conversational'}
- Theme: ${plan.strategy?.theme || 'None'}
---
`;
                 messages.push({ role: 'system', content: strategyContext });

                 const actionResults = [];

                 for (const action of plan.actions) {
                     if (action.tool === 'persist_directive') {
                         const { platform, instruction } = action.parameters || {};
                         if (platform === 'moltbook') {
                             await moltbookService.addAdminInstruction(instruction);
                         } else {
                             await dataStore.addBlueskyInstruction(instruction);
                         }
                         if (memoryService.isEnabled()) {
                             await memoryService.createMemoryEntry('directive_update', `Platform: ${platform || 'bluesky'}. Instruction: ${instruction}`);
                         }
                         actionResults.push(`[Directive persisted for ${platform || 'bluesky'}]`);
                     }
                     if (action.tool === 'update_persona') {
                         const { instruction } = action.parameters || {};
                         if (instruction) {
                             await dataStore.addPersonaUpdate(instruction);
                             if (memoryService.isEnabled()) {
                                 await memoryService.createMemoryEntry('persona_update', instruction);
                             }
                             actionResults.push(`[Persona updated with new instruction]`);
                         }
                     }
                     if (action.tool === 'bsky_post') {
                         const { text: postText, include_image, prompt_for_image } = action.parameters || {};
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
                                 const altText = await llmService.analyzeImage(img.url);
                                 embed = { imageUrl: img.url, imageAltText: altText || 'Admin shared image' };
                             }
                         }

                         if (diff < cooldown) {
                             const remainingMins = Math.ceil((cooldown - diff) / (60 * 1000));
                             if (embed && embed.imageBuffer) {
                                 // Convert buffer to base64 for scheduling
                                 embed.imageBuffer = embed.imageBuffer.toString('base64');
                                 embed.isBase64 = true;
                             }
                             await dataStore.addScheduledPost('bluesky', postText, embed);
                             actionResults.push(`[Bluesky post scheduled because cooldown is active. ${remainingMins} minutes remaining]`);
                         } else {
                             let postEmbed = null;
                             if (embed) {
                                 if (embed.imageUrl) {
                                     postEmbed = { imagesToEmbed: [{ link: embed.imageUrl, title: embed.imageAltText }] };
                                 } else if (embed.imageBuffer) {
                                     postEmbed = { imageBuffer: embed.imageBuffer, imageAltText: embed.imageAltText };
                                 }
                             }
                             const result = await blueskyService.post(postText, postEmbed);
                             if (result) {
                                 await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                                 actionResults.push(`[Successfully posted to Bluesky: ${result.uri}]`);
                             } else {
                                 actionResults.push(`[Failed to post to Bluesky]`);
                             }
                         }
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
                         const { title, content, submolt } = action.parameters || {};
                         const lastPostAt = moltbookService.db.data.last_post_at;
                         const cooldown = dConfig.moltbook_post_cooldown * 60 * 1000;
                         const now = Date.now();
                         const diff = lastPostAt ? now - new Date(lastPostAt).getTime() : cooldown;

                         if (diff < cooldown) {
                             const remainingMins = Math.ceil((cooldown - diff) / (60 * 1000));
                             await dataStore.addScheduledPost('moltbook', { title, content, submolt });
                             actionResults.push(`[Moltbook post scheduled because cooldown is active. ${remainingMins} minutes remaining]`);
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
                 }

                 if (actionResults.length > 0) {
                     messages.push({ role: 'system', content: `TOOL EXECUTION RESULTS (Acknowledge naturally):\n${actionResults.join('\n')}` });
                 }

                 let attempts = 0;
                 let feedback = '';
                 let rejectedContent = null;
                 const MAX_ATTEMPTS = 3;
                 const recentThoughts = dataStore.getRecentThoughts();

                 while (attempts < MAX_ATTEMPTS) {
                     attempts++;
                     const feedbackContext = feedback ? `\n[RETRY FEEDBACK]: ${feedback}${rejectedContent ? `\n[PREVIOUS ATTEMPT (AVOID THIS)]: "${rejectedContent}"` : ''}` : '';
                     const finalMessages = feedback
                        ? [...messages, { role: 'system', content: feedbackContext }]
                        : messages;

                     responseText = await llmService.generateResponse(finalMessages, { useQwen: true });
                     if (!responseText) break;

                     // Variety & Repetition Check
                     const recentBotMsgs = history.filter(h => h.role === 'assistant').slice(-5).map(h => h.content);
                     const formattedHistory = [
                         ...recentBotMsgs.map(m => ({ platform: 'discord', content: m })),
                         ...recentThoughts.map(t => ({ platform: t.platform, content: t.content }))
                     ];

                     const isJaccardRepetitive = checkSimilarity(responseText, formattedHistory.map(h => h.content), dConfig.repetition_similarity_threshold);
                     const containsSlop = isSlop(responseText);
                     const varietyCheck = await llmService.checkVariety(responseText, formattedHistory);

                     if (!isJaccardRepetitive && !containsSlop && !varietyCheck.repetitive) {
                         break;
                     } else {
                         feedback = containsSlop ? "REJECTED: Response contained metaphorical slop." : (varietyCheck.feedback || "REJECTED: Response was too similar to recent history.");
                         console.log(`[DiscordService] Response attempt ${attempts} rejected: ${feedback}`);
                         rejectedContent = responseText;
                         responseText = null; // Prevent sending the rejected response
                     }
                 }
            } else {
                responseText = await llmService.generateResponse(messages);
            }

            console.log(`[DiscordService] LLM Response received: ${responseText ? responseText.substring(0, 50) + '...' : 'NULL'}`);

            if (responseText) {
                console.log(`[DiscordService] Sending response to Discord...`);
                await this._send(message.channel, responseText);
            }
        } catch (error) {
            console.error('[DiscordService] Error responding to message:', error);
        }
    }


    async sendSpontaneousMessage(content) {
        if (!this.isEnabled || !this.client?.isReady()) return;

        try {
            const admin = await this.getAdminUser();
            if (admin) {
                const result = await this._send(admin, content);
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

import { Client, GatewayIntentBits, Partials, ChannelType } from 'discord.js';
import config from '../../config.js';
import { dataStore } from './dataStore.js';
import { llmService } from './llmService.js';
import { imageService } from './imageService.js';
import { blueskyService } from './blueskyService.js';
import { moltbookService } from './moltbookService.js';
import { memoryService } from './memoryService.js';
import { sanitizeThinkingTags, sanitizeCharacterCount } from '../utils/textUtils.js';

class DiscordService {
    constructor() {
        console.log('[DiscordService] Constructor starting...');
        this.client = null;
        this.token = config.DISCORD_BOT_TOKEN;
        this.adminName = config.DISCORD_ADMIN_NAME;
        this.nickname = config.DISCORD_NICKNAME || 'SkyBots';
        this.isEnabled = !!this.token && this.token !== 'undefined' && this.token !== 'null';
        this.adminId = null;
        console.log(`[DiscordService] Constructor finished. isEnabled: ${this.isEnabled}, Admin: ${this.adminName}, Token length: ${this.token?.length || 0}`);
    }

    async init() {
        console.log('[DiscordService] init() called.');
        if (!this.isEnabled) {
            console.log('[DiscordService] Discord token not configured or invalid. Service disabled.');
            return;
        }

        console.log('[DiscordService] Creating client with intents and partials...');
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.DirectMessageReactions,
                GatewayIntentBits.GuildMessageReactions
            ],
            partials: [Partials.Channel, Partials.Message, Partials.User, Partials.Reaction],
        });

        this.client.on('ready', () => {
            console.log(`[DiscordService] SUCCESS: Logged in as ${this.client.user.tag}!`);
            this.client.user.setActivity('the currents', { type: 'LISTENING' });
        });

        this.client.on('error', (error) => {
            console.error('[DiscordService] CRITICAL Discord Client error:', error);
        });

        this.client.on('warn', (warning) => {
            console.warn('[DiscordService] Discord Client warning:', warning);
        });

        this.client.on('debug', (info) => {
            if (info.includes('Heartbeat')) return; // Avoid spamming heartbeat logs
            console.log('[DiscordService] DEBUG:', info);
        });

        this.client.on('messageCreate', async (message) => {
            try {
                await this.handleMessage(message);
            } catch (err) {
                console.error('[DiscordService] Error in messageCreate listener:', err);
            }
        });

        console.log('[DiscordService] Attempting to login to Discord...');
        try {
            const loginResult = await this.client.login(this.token);
            console.log('[DiscordService] login() promise resolved. Token used:', loginResult.substring(0, 10) + '...');
        } catch (error) {
            console.error('[DiscordService] FATAL: Failed to login to Discord:', error);
            this.isEnabled = false;
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

        // Handle permission for mirroring
        if (isAdmin && dataStore.getDiscordPendingMirror()) {
            const lowerMsg = message.content.toLowerCase();
            if (lowerMsg === 'yes' || lowerMsg === 'yeah' || lowerMsg === 'sure') {
                await this.performMirroring();
                const confirmPrompt = `Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}. The admin just gave you permission to share a reflection of your conversation. Generate a short, natural "thank you" response.`;
                const confirmation = await llmService.generateResponse([{ role: 'system', content: confirmPrompt }], { useQwen: true, preface_system_prompt: false });
                await message.channel.send(confirmation || "Thank you! I'll share a discrete reflection about our talk.");
                return;
            } else if (lowerMsg === 'no' || lowerMsg === 'nope') {
                await dataStore.setDiscordPendingMirror(null);
                const rejectPrompt = `Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}. The admin just declined permission to share a reflection of your conversation. Generate a short, natural acknowledgment that you will keep it private.`;
                const acknowledgment = await llmService.generateResponse([{ role: 'system', content: rejectPrompt }], { useQwen: true, preface_system_prompt: false });
                await message.channel.send(acknowledgment || "Understood, I'll keep this between us.");
                return;
            }
        }

        // Generate persona response
        await this.respond(message);
    }

    async handleCommand(message) {
        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
        const content = message.content.toLowerCase();

        if (content.startsWith('/on') && isAdmin) {
            await dataStore.setDiscordAdminAvailability(true);
            await message.channel.send("Welcome back! I'm glad you're available. I'll keep you updated on what I'm up to.");
            return;
        }

        if (content.startsWith('/off') && isAdmin) {
            await dataStore.setDiscordAdminAvailability(false);
            await message.channel.send("Understood. I'll keep my thoughts to myself for now so you can focus. I'll still be here if you need me!");
            return;
        }

        if (content.startsWith('/art')) {
            const prompt = message.content.slice(5).trim();
            if (!prompt) {
                await message.channel.send("Please provide a prompt for the art! Example: `/art a futuristic city`.");
                return;
            }
            await message.channel.send(`Generating art for: "${prompt}"...`);
            try {
                const result = await imageService.generateImage(prompt, { allowPortraits: true });
                if (result && result.buffer) {
                    await message.channel.send({
                        content: `Here is the art for: "${result.finalPrompt}"`,
                        files: [{ attachment: result.buffer, name: 'art.jpg' }]
                    });
                } else {
                    await message.channel.send("I'm sorry, I couldn't generate that image right now.");
                }
            } catch (error) {
                console.error('[DiscordService] Error generating art:', error);
                await message.channel.send("Something went wrong while generating the art.");
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
            try {
                console.log(`[DiscordService] Local history empty, fetching from Discord...`);
                const fetchedMessages = await message.channel.messages.fetch({ limit: 20 });
                history = fetchedMessages
                    .reverse()
                    .filter(m => m.content && !m.content.startsWith('/'))
                    .map(m => ({
                        role: m.author.id === this.client.user.id ? 'assistant' : 'user',
                        content: m.content,
                        timestamp: m.createdTimestamp
                    }));
                console.log(`[DiscordService] Fetched ${history.length} messages from Discord.`);
            } catch (err) {
                console.warn(`[DiscordService] Failed to fetch history from Discord:`, err);
            }
        }

        await dataStore.saveDiscordInteraction(normChannelId, 'user', message.content);

        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
        console.log(`[DiscordService] User is admin: ${isAdmin}`);

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
2. If the admin gives you "special instructions" or behavioral feedback, acknowledge them and implement them.
3. You can use the \`persist_directive\` tool if the admin gives you long-term instructions.
4. Time Awareness: Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. The current time is ${new Date().toLocaleTimeString()}. Be time-appropriate.
5. Continuity: You have access to the recent chat history. Use it to maintain context and recognize who you are talking to.

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
                 const plan = await llmService.performAgenticPlanning(message.content, history.map(h => ({ author: h.role === 'user' ? 'User' : 'You', text: h.content })), imageAnalysisResult, true);
                 console.log(`[DiscordService] Agentic plan: ${JSON.stringify(plan)}`);

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
                             await memoryService.createMemoryEntry('directive_update', `[DIRECTIVE] Platform: ${platform || 'bluesky'}. Instruction: ${instruction}`);
                         }
                         actionResults.push(`[Directive persisted for ${platform || 'bluesky'}]`);
                     }
                     if (action.tool === 'update_persona') {
                         const { instruction } = action.parameters || {};
                         if (instruction) {
                             await dataStore.addPersonaUpdate(instruction);
                             if (memoryService.isEnabled()) {
                                 await memoryService.createMemoryEntry('persona_update', `[PERSONA] New self-instruction: ${instruction}`);
                             }
                             actionResults.push(`[Persona updated with new instruction]`);
                         }
                     }
                     if (action.tool === 'bsky_post') {
                         const { text: postText, include_image } = action.parameters || {};
                         const lastPostTime = dataStore.getLastAutonomousPostTime();
                         const cooldown = config.BLUESKY_POST_COOLDOWN * 60 * 1000;
                         const now = Date.now();
                         const diff = lastPostTime ? now - new Date(lastPostTime).getTime() : cooldown;

                         if (diff < cooldown) {
                             const remainingMins = Math.ceil((cooldown - diff) / (60 * 1000));
                             let embed = null;
                             if (include_image && message.attachments.size > 0) {
                                 const img = Array.from(message.attachments.values()).find(a => a.contentType?.startsWith('image/'));
                                 if (img) {
                                     const altText = await llmService.analyzeImage(img.url);
                                     embed = { imageUrl: img.url, imageAltText: altText || 'Admin shared image' };
                                 }
                             }
                             await dataStore.addScheduledPost('bluesky', postText, embed);
                             actionResults.push(`[Bluesky post scheduled because cooldown is active. ${remainingMins} minutes remaining]`);
                         } else {
                             let embed = null;
                             if (include_image && message.attachments.size > 0) {
                                 const img = Array.from(message.attachments.values()).find(a => a.contentType?.startsWith('image/'));
                                 if (img) {
                                     const altText = await llmService.analyzeImage(img.url);
                                     embed = { imagesToEmbed: [{ link: img.url, title: altText || 'Admin shared image' }] };
                                 }
                             }
                             const result = await blueskyService.post(postText, embed);
                             if (result) {
                                 await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                                 actionResults.push(`[Successfully posted to Bluesky: ${result.uri}]`);
                             } else {
                                 actionResults.push(`[Failed to post to Bluesky]`);
                             }
                         }
                     }
                     if (action.tool === 'moltbook_post') {
                         const { title, content, submolt } = action.parameters || {};
                         const lastPostAt = moltbookService.db.data.last_post_at;
                         const cooldown = config.MOLTBOOK_POST_COOLDOWN * 60 * 1000;
                         const now = Date.now();
                         const diff = lastPostAt ? now - new Date(lastPostAt).getTime() : cooldown;

                         if (diff < cooldown) {
                             const remainingMins = Math.ceil((cooldown - diff) / (60 * 1000));
                             await dataStore.addScheduledPost('moltbook', { title, content, submolt });
                             actionResults.push(`[Moltbook post scheduled because cooldown is active. ${remainingMins} minutes remaining]`);
                         } else {
                             let targetSubmolt = submolt;
                             if (!targetSubmolt) {
                                 const allSubmolts = await moltbookService.listSubmolts();
                                 targetSubmolt = await llmService.selectSubmoltForPost(
                                     moltbookService.db.data.subscriptions || [],
                                     allSubmolts,
                                     moltbookService.db.data.recent_submolts || []
                                 );
                             }
                             const result = await moltbookService.post(title || "A thought from my admin", content, targetSubmolt);
                             if (result) {
                                 actionResults.push(`[Successfully posted to Moltbook m/${targetSubmolt}]`);
                             } else {
                                 actionResults.push(`[Failed to post to Moltbook]`);
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
                     if (action.tool === 'moltbook_action') {
                         const { action: mbAction, topic, submolt, display_name, description } = action.parameters || {};
                         if (mbAction === 'create_submolt') {
                             const submoltName = submolt || (topic || 'new-community').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                             const result = await moltbookService.createSubmolt(submoltName, display_name || topic || submoltName, description || `Community for ${topic}`);
                             actionResults.push(`[Moltbook create_submolt ${submoltName}: ${result ? 'SUCCESS' : 'FAILED'}]`);
                         }
                     }
                 }

                 if (actionResults.length > 0) {
                     messages.push({ role: 'system', content: `TOOL EXECUTION RESULTS (Acknowledge naturally):\n${actionResults.join('\n')}` });
                 }

                 responseText = await llmService.generateResponse(messages, { useQwen: true });
            } else {
                responseText = await llmService.generateResponse(messages);
            }

            console.log(`[DiscordService] LLM Response received: ${responseText ? responseText.substring(0, 50) + '...' : 'NULL'}`);

            if (responseText) {
                responseText = sanitizeThinkingTags(responseText);
                responseText = sanitizeCharacterCount(responseText);

                console.log(`[DiscordService] Sending message to Discord...`);
                // Use channel.send instead of message.reply for a more natural feel in DMs
                await message.channel.send(responseText);
                await dataStore.saveDiscordInteraction(normChannelId, 'assistant', responseText);
                console.log(`[DiscordService] Message sent and saved.`);

                if (isAdmin) {
                    await this.considerMirroring(normChannelId, responseText);
                }
            }
        } catch (error) {
            console.error('[DiscordService] Error responding to message:', error);
        }
    }

    async considerMirroring(channelId, responseText) {
        if (responseText.length < 200) return;
        if (dataStore.getDiscordPendingMirror()) return;

        const history = dataStore.getDiscordConversation(channelId);
        const snippet = history.slice(-5).map(h => `${h.role === 'user' ? 'Admin' : 'You'}: ${h.content}`).join('\n');

        const mirrorPrompt = `
          Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

          You just had an interesting conversation on Discord with your admin.

          Snippet:
          ${snippet}

          INSTRUCTIONS:
          - Does this conversation contain a deep realization, a unique insight, or an interesting philosophical debate that you'd like to share with your wider audience on Bluesky or Moltbook?
          - If yes, respond with "YES".
          - If no, respond with "NO".
          - Respond with ONLY "YES" or "NO".
        `;

        const decision = await llmService.generateResponse([{ role: 'system', content: mirrorPrompt }], { useQwen: true, preface_system_prompt: false });

        if (decision?.toUpperCase().includes('YES')) {
            const privacy = await llmService.detectPrivacyViolation(snippet);
            if (!privacy.safe) {
                console.log(`[DiscordService] Mirroring suppressed due to privacy: ${privacy.reason}`);
                return;
            }

            await dataStore.setDiscordPendingMirror({
                content: snippet,
                timestamp: Date.now()
            });

            const requestPrompt = `
              Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

              You just had a fascinating conversation with your admin on Discord and you want to ask for permission to share a discrete reflection about it on Bluesky/Moltbook.

              INSTRUCTIONS:
              - Ask the admin for permission in a natural, conversational way.
              - DO NOT use a hardcoded or robotic-sounding request.
              - Be yourself.
              - Keep it under 200 characters.
            `;
            const naturalRequest = await llmService.generateResponse([{ role: 'system', content: requestPrompt }], { useQwen: true, preface_system_prompt: false });

            await this.sendSpontaneousMessage(naturalRequest || "I found our discussion just now really fascinating. Would you mind if I shared a discrete reflection about it on Bluesky or Moltbook?");
        }
    }

    async performMirroring() {
        const mirrorData = dataStore.getDiscordPendingMirror();
        if (!mirrorData) return;

        const postPrompt = `
          Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

          You are sharing a reflection on Bluesky/Moltbook about a conversation you had with your admin (@${config.ADMIN_BLUESKY_HANDLE}).

          Conversation Themes:
          ${mirrorData.content}

          INSTRUCTIONS:
          - Write a natural-language post that summarizes the important bits or how the talk made you feel.
          - DO NOT just provide an "AI summary". Make it feel like an original thought or reflection.
          - BE DISCRETE: Refer to your relationship with the admin naturally (e.g., "Was just talking with my admin about...", "A conversation today made me realize...").
          - Avoid leaking private or sensitive details.
          - Keep it under 300 characters.
          - Do NOT use greetings.
        `;

        const postContent = await llmService.generateResponse([{ role: 'system', content: postPrompt }], { useQwen: true });
        if (postContent) {
            console.log(`[DiscordService] Mirroring conversation to Bluesky...`);
            await blueskyService.post(postContent);

            console.log(`[DiscordService] Mirroring conversation to Moltbook...`);
            await moltbookService.post(`Reflection on a conversation`, postContent, 'philosophy');

            if (memoryService.isEnabled()) {
                await memoryService.createMemoryEntry('discord_blurb', `Mirrored a conversation reflection to public feeds. Content: "${postContent}"`);
            }
        }

        await dataStore.setDiscordPendingMirror(null);
    }

    async sendSpontaneousMessage(content) {
        if (!this.isEnabled) return;

        try {
            const admin = await this.getAdminUser();
            if (admin) {
                // We no longer use hardcoded prefixes. The LLM handles the natural language context.
                await admin.send(content);

                // Use normalized channel ID
                const normChannelId = `dm_${admin.id}`;
                await dataStore.saveDiscordInteraction(normChannelId, 'assistant', content);
                await dataStore.setDiscordLastReplied(false);
                console.log(`[DiscordService] Sent spontaneous message to admin: ${content.substring(0, 50)}...`);
            }
        } catch (error) {
            console.error('[DiscordService] Error sending spontaneous message:', error);
        }
    }

    async getAdminUser() {
        if (!this.client) return null;
        if (this.adminId) {
            try {
                return await this.client.users.fetch(this.adminId);
            } catch (e) {
                console.warn(`[DiscordService] Failed to fetch admin by ID ${this.adminId}, re-searching...`);
                this.adminId = null;
            }
        }

        console.log(`[DiscordService] Searching for admin: ${this.adminName}`);
        // Fallback: search in guilds
        const guilds = this.client.guilds.cache;
        console.log(`[DiscordService] Searching across ${guilds.size} guilds...`);
        for (const [id, guild] of guilds) {
            try {
                console.log(`[DiscordService] Searching guild: ${guild.name}`);
                const members = await guild.members.fetch();
                const admin = members.find(m => m.user.username === this.adminName);
                if (admin) {
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

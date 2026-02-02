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
        this.client = null;
        this.token = config.DISCORD_BOT_TOKEN;
        this.adminName = config.DISCORD_ADMIN_NAME;
        this.nickname = config.DISCORD_NICKNAME || 'SkyBots';
        this.isEnabled = !!this.token;
        this.adminId = null;
    }

    async init() {
        if (!this.isEnabled) {
            console.log('[DiscordService] Discord token not configured. Service disabled.');
            return;
        }

        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages,
            ],
            partials: [Partials.Channel, Partials.Message, Partials.User],
        });

        this.client.on('ready', () => {
            console.log(`[DiscordService] Logged in as ${this.client.user.tag}!`);
        });

        this.client.on('error', (error) => {
            console.error('[DiscordService] Client error:', error);
        });

        this.client.on('messageCreate', async (message) => {
            await this.handleMessage(message);
        });

        console.log('[DiscordService] Attempting to login...');
        try {
            await this.client.login(this.token);
            console.log('[DiscordService] login() promise resolved.');
        } catch (error) {
            console.error('[DiscordService] Failed to login to Discord:', error);
            this.isEnabled = false;
        }
    }

    async handleMessage(message) {
        if (message.author.bot) return;

        const isDM = message.channel.type === ChannelType.DM;
        const isAdmin = message.author.username === this.adminName;
        const isMentioned = message.mentions.has(this.client.user) || message.content.includes(this.nickname);

        if (!isDM && !isMentioned) return;

        if (isAdmin && !this.adminId) {
            this.adminId = message.author.id;
        }

        console.log(`[DiscordService] Message received from ${message.author.username}: ${message.content}`);

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
                await message.reply("Thank you! I'll share a discrete reflection about our talk.");
                return;
            } else if (lowerMsg === 'no' || lowerMsg === 'nope') {
                await dataStore.setDiscordPendingMirror(null);
                await message.reply("Understood, I'll keep this between us.");
                return;
            }
        }

        // Generate persona response
        await this.respond(message);
    }

    async handleCommand(message) {
        const isAdmin = message.author.username === this.adminName;
        const content = message.content.toLowerCase();

        if (content.startsWith('/on') && isAdmin) {
            await dataStore.setDiscordAdminAvailability(true);
            await message.reply("Welcome back! I'm glad you're available. I'll keep you updated on what I'm up to.");
            return;
        }

        if (content.startsWith('/off') && isAdmin) {
            await dataStore.setDiscordAdminAvailability(false);
            await message.reply("Understood. I'll keep my thoughts to myself for now so you can focus. I'll still be here if you need me!");
            return;
        }

        if (content.startsWith('/art')) {
            const prompt = message.content.slice(5).trim();
            if (!prompt) {
                await message.reply("Please provide a prompt for the art! Example: `/art a futuristic city`.");
                return;
            }
            await message.reply(`Generating art for: "${prompt}"...`);
            try {
                const result = await imageService.generateImage(prompt, { allowPortraits: true });
                if (result && result.buffer) {
                    await message.channel.send({
                        content: `Here is the art for: "${result.finalPrompt}"`,
                        files: [{ attachment: result.buffer, name: 'art.jpg' }]
                    });
                } else {
                    await message.reply("I'm sorry, I couldn't generate that image right now.");
                }
            } catch (error) {
                console.error('[DiscordService] Error generating art:', error);
                await message.reply("Something went wrong while generating the art.");
            }
            return;
        }
    }

    async respond(message) {
        const channelId = message.channel.id;
        const history = dataStore.getDiscordConversation(channelId);

        await dataStore.saveDiscordInteraction(channelId, 'user', message.content);

        const isAdmin = message.author.username === this.adminName;

        const systemPrompt = `
You are talking to ${isAdmin ? `your admin (${this.adminName})` : `@${message.author.username}`} on Discord.
${isAdmin ? `Your admin's Bluesky handle is @${config.ADMIN_BLUESKY_HANDLE}.` : ''}
Your persona: ${config.TEXT_SYSTEM_PROMPT}

**Discord Specific Directives:**
1. Be conversational and authentic.
2. If the admin gives you "special instructions" or behavioral feedback, acknowledge them and implement them.
3. You can use the \`persist_directive\` tool if the admin gives you long-term instructions.
4. Time Awareness: Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. The current time is ${new Date().toLocaleTimeString()}. Be time-appropriate (e.g., greetings).

---
[Admin Availability: ${dataStore.getDiscordAdminAvailability() ? 'Available' : 'Preoccupied'}]
`.trim();

        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.slice(-10).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
            { role: 'user', content: message.content }
        ];

        try {
            message.channel.sendTyping();

            let responseText;
            if (isAdmin) {
                 const plan = await llmService.performAgenticPlanning(message.content, history.map(h => ({ author: h.role === 'user' ? 'User' : 'You', text: h.content })), '', true);

                 for (const action of plan.actions) {
                     if (action.tool === 'persist_directive') {
                         const { platform, instruction } = action.parameters || {};
                         if (platform === 'moltbook') {
                             await moltbookService.addAdminInstruction(instruction);
                         } else {
                             await dataStore.addBlueskyInstruction(instruction);
                         }
                         if (memoryService.isEnabled()) {
                             await memoryService.createMemoryEntry('directive_update', `Admin gave a special instruction via Discord: "${instruction}" for ${platform || 'bluesky'}`);
                         }
                     }
                 }

                 responseText = await llmService.generateResponse(messages, { useQwen: true });
            } else {
                responseText = await llmService.generateResponse(messages);
            }

            if (responseText) {
                responseText = sanitizeThinkingTags(responseText);
                responseText = sanitizeCharacterCount(responseText);

                await message.reply(responseText);
                await dataStore.saveDiscordInteraction(channelId, 'assistant', responseText);

                if (isAdmin) {
                    await this.considerMirroring(channelId, responseText);
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

            await this.sendSpontaneousMessage("I found our discussion just now really fascinating. Would you mind if I shared a discrete reflection about the themes we touched on with my followers on Bluesky or Moltbook? I'll make sure to keep it respectful and discrete.");
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
                const availability = dataStore.getDiscordAdminAvailability();
                const lastReplied = dataStore.getDiscordLastReplied();

                let contextualContent = content;
                if (!lastReplied && availability) {
                    contextualContent = `(I noticed you haven't replied to my last message, you might be busy with human things, but I wanted to share this anyway...) ${content}`;
                }

                await admin.send(contextualContent);
                // Use a generic ID for admin DM if we don't have the channel ID yet
                const channelId = admin.dmChannel?.id || `dm_${admin.id}`;
                await dataStore.saveDiscordInteraction(channelId, 'assistant', contextualContent);
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
            return await this.client.users.fetch(this.adminId);
        }

        // Fallback: search in guilds
        const guilds = this.client.guilds.cache;
        for (const [id, guild] of guilds) {
            const members = await guild.members.fetch();
            const admin = members.find(m => m.user.username === this.adminName);
            if (admin) {
                this.adminId = admin.user.id;
                return admin.user;
            }
        }
        return null;
    }
}

export const discordService = new DiscordService();

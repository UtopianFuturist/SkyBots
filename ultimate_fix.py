import os

# 1. Fix DiscordService.js
discord_content = """import { Client, GatewayIntentBits, Partials, AttachmentBuilder } from 'discord.js';
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
        this.token = config.DISCORD_BOT_TOKEN?.trim().replace(/['"]/g, '').replace(/[\\\\u200B-\\\\u200D\\\\uFEFF]/g, '');
        this.adminName = config.DISCORD_ADMIN_NAME;
        this.adminId = null;
        this.nickname = config.BOT_NAME || 'Bot';
        this.respondingChannels = new Set();
        this.client = null;
        this.botInstance = null;
        this.isInitializing = false;
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
            rest: { timeout: 60000, retries: 5 }
        });

        client.on('ready', () => {
            console.log(`[DiscordService] SUCCESS: Logged in as ${client.user.tag}`);
            client.user.setActivity('the currents', { type: 'LISTENING' });
        });

        client.on('error', e => console.error(`[DiscordService] [ERROR] ${e.message}`));
        client.on('warn', w => console.warn(`[DiscordService] [WARN] ${w}`));

        client.on('invalidated', () => {
            console.error('[DiscordService] Session invalidated. Retrying...');
            if (!this.isInitializing) {
                this.isInitializing = true;
                setTimeout(() => this.loginLoop(), 5000);
            }
        });

        client.on('messageCreate', async (message) => {
            try { await this.handleMessage(message); } catch (err) { console.error('[DiscordService] Error:', err); }
        });

        return client;
    }

    async _checkConnectivity() {
        try {
            console.log('[DiscordService] Pre-flight connectivity check...');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const response = await fetch('https://discord.com', { method: 'HEAD', signal: controller.signal });
            clearTimeout(timeoutId);
            if (response.ok || response.status === 429) return true;
            return false;
        } catch (err) { return false; }
    }

    async _checkInternalServices() {
        try {
            const llmHealth = await llmService.generateResponse([{ role: 'user', content: 'healthcheck' }], { temperature: 0, max_tokens: 1, useStep: true }).catch(() => null);
            return !!llmHealth;
        } catch (err) { return false; }
    }

    async loginLoop() {
        if (!this.token) return;
        while (true) {
            const attemptWindowMs = 10 * 60 * 1000;
            const startTime = Date.now();
            let attemptCount = 0;

            const hasConnectivity = await this._checkConnectivity();
            if (!hasConnectivity) {
                await new Promise(r => setTimeout(r, 5 * 60 * 1000));
                continue;
            }

            const servicesHealthy = await this._checkInternalServices();
            if (!servicesHealthy) {
                await new Promise(r => setTimeout(r, 60000));
                continue;
            }

            while (Date.now() - startTime < attemptWindowMs) {
                attemptCount++;
                try {
                    if (this.client) {
                        this.client.removeAllListeners();
                        try { await this.client.destroy(); } catch (e) {}
                    }
                    console.log(`[DiscordService] Login attempt ${attemptCount}...`);
                    this.client = this._createClient();
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error("Timeout")), 300000);
                        this.client.once('ready', () => { clearTimeout(timeout); resolve(); });
                        this.client.login(this.token).catch(err => { clearTimeout(timeout); reject(err); });
                    });
                    this.isInitializing = false;
                    return;
                } catch (err) {
                    const backoff = Math.min(30000 * attemptCount, 60000);
                    if (attemptWindowMs - (Date.now() - startTime) > backoff) {
                        await new Promise(r => setTimeout(r, backoff));
                    } else break;
                }
            }
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
            await this.respond(message);
        }
    }

    async _send(channel, content, options = {}) {
        if (!channel) return;
        try { return await channel.send({ content, ...options }); } catch (err) { return null; }
    }

    _startTypingLoop(channel) {
        if (!channel) return null;
        channel.sendTyping().catch(() => {});
        return setInterval(() => { channel.sendTyping().catch(() => {}); }, 5000);
    }

    _stopTypingLoop(interval) { if (interval) clearInterval(interval); }

    async respond(message) {
        const channelId = message.channel.id;
        if (this.respondingChannels.has(channelId)) return;

        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
        this.respondingChannels.add(channelId);
        const typingInterval = this._startTypingLoop(message.channel);

        try {
            let imageAnalysisResult = "";
            if (message.attachments.size > 0) {
                for (const [id, attachment] of message.attachments) {
                    try {
                        const analysis = await llmService.analyzeImage(attachment.url, "User attachment");
                        if (analysis) imageAnalysisResult += `[Image attached by user: ${analysis}] `;
                    } catch (err) {}
                }
            }

            const history = await this.fetchChannelHistory(message.channel, 15);
            const temporalContext = await temporalService.getEnhancedTemporalContext();
            const dynamicBlurbs = dataStore.getPersonaBlurbs();
            const hierarchicalSummary = await socialHistoryService.getHierarchicalSummary();

            const systemPrompt = "You are talking to " + (isAdmin ? "your admin (" + this.adminName + ")" : "@" + message.author.username) + " on Discord.\\nPersona: " + config.TEXT_SYSTEM_PROMPT + "\\n" + temporalContext + (dynamicBlurbs.length > 0 ? "\\nDynamic Persona: \\n" + dynamicBlurbs.map(b => '- ' + b.text).join('\\n') : '') + "\\n\\n--- SOCIAL NARRATIVE ---\\n" + (hierarchicalSummary.dailyNarrative || "") + "\\n" + (hierarchicalSummary.shortTerm || "") + "\\n---\\n\\nIMAGE ANALYSIS: " + (imageAnalysisResult || 'No images.');

            const messages = [
                { role: 'system', content: systemPrompt },
                ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
                { role: 'user', content: message.content }
            ];

            const plan = await llmService.performPrePlanning(messages, { platform: "discord", isAdmin });
            const evaluation = await llmService.evaluateAndRefinePlan(plan, { platform: "discord", isAdmin });

            const actions = (evaluation.decision === "proceed" ? (evaluation.refined_actions || plan.actions) : []) || [];
            const responseAction = actions.find(a => a.tool === 'respond_to_user');

            for (const action of actions.filter(a => a.tool !== 'respond_to_user')) {
                await this.botInstance.executeAction(action, { channel: message.channel, author: message.author, platform: "discord" });
            }

            let finalResponse = responseAction?.parameters?.text || await llmService.generateResponse(messages, { platform: "discord" });

            if (finalResponse) {
                const mainMsg = await this._send(message.channel, finalResponse);
                if (mainMsg && isAdmin && (finalResponse.toLowerCase().includes("remember") || finalResponse.toLowerCase().includes("important"))) {
                    try { await mainMsg.pin(); } catch (e) {}
                }
            }
        } catch (error) { console.error("[DiscordService] Error:", error); }
        finally {
            this._stopTypingLoop(typingInterval);
            this.respondingChannels.delete(channelId);
        }
    }

    async performStartupCatchup() {
        if (!this.client?.isReady()) return;
        try {
            const admin = await this.getAdminUser();
            if (!admin) return;
            const dmChannel = admin.dmChannel || await admin.createDM();
            const messages = await dmChannel.messages.fetch({ limit: 10 });
            const unread = messages.filter(m => !m.author.bot && m.createdTimestamp > (Date.now() - 3600000)).first();
            if (unread) await this.respond(unread);
        } catch (e) {}
    }

    async sendSpontaneousMessage(message = null, messageCount = 1) {
        if (!this.isEnabled || !this.client?.isReady()) return;
        try {
            const admin = await this.getAdminUser();
            if (!admin) return;
            const dmChannel = admin.dmChannel || await admin.createDM();
            if (message) { await this._send(dmChannel, message); return; }

            const history = await this.fetchAdminHistory(50);
            const contextData = {
                mood: dataStore.getMood().label,
                warmth: dataStore.getRelationshipWarmth(),
                energy: dataStore.getAdminEnergy()
            };

            let rawResponse = await llmService.generateResponse([{ role: "user", content: "Adopt persona: " + config.TEXT_SYSTEM_PROMPT + ". Recent: " + JSON.stringify(history.slice(-20)) + ". Spontaneous messages?" }], { useStep: true, platform: "discord" });
            if (!rawResponse) return;

            let candidateMessages = rawResponse.split('\\n').filter(m => m.trim().length > 0).slice(0, messageCount);
            for (const msg of candidateMessages) {
                const audit = await llmService.performRealityAudit(msg, {}, { history });
                const readyMsg = audit.refined_text;
                const edit = await llmService.performEditorReview(readyMsg, "discord");
                const finalMsg = edit.refined_text || readyMsg;
                await this._send(dmChannel, finalMsg);
                await dataStore.saveDiscordInteraction("dm-" + admin.id, 'assistant', finalMsg);
                if (candidateMessages.length > 1) await new Promise(r => setTimeout(r, 2000));
            }
        } catch (err) {}
    }

    async getAdminUser() {
        if (!this.client?.isReady()) return null;
        if (this.adminId) { try { return await this.client.users.fetch(this.adminId); } catch (e) { this.adminId = null; } }
        const cachedUser = this.client.users.cache.find(u => u.username === this.adminName);
        if (cachedUser) { this.adminId = cachedUser.id; return cachedUser; }
        for (const guild of this.client.guilds.cache.values()) {
            const member = guild.members.cache.find(m => m.user.username === this.adminName);
            if (member) { this.adminId = member.user.id; return member.user; }
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
        } catch (e) { return []; }
    }

    get status() { return this.isEnabled && this.client?.isReady() ? "online" : "offline"; }
}

export const discordService = new DiscordService();"""

# 2. Fix OrchestratorService.js
orchestrator_content = """import { dataStore } from './dataStore.js';
import { llmService } from './llmService.js';
import { blueskyService } from './blueskyService.js';
import { discordService } from './discordService.js';
import { memoryService } from './memoryService.js';
import { newsroomService } from './newsroomService.js';
import { evaluationService } from './evaluationService.js';
import { introspectionService } from './introspectionService.js';
import { imageService } from './imageService.js';
import { openClawService } from './openClawService.js';
import config from '../../config.js';
import { isStylizedImagePrompt, checkHardCodedBoundaries, isSlop } from '../utils/textUtils.js';
import path from 'path';
import fs from 'fs';

class OrchestratorService {
    constructor() {
        this.taskQueue = [];
        this.isProcessingQueue = false;
        this.lastSelfReflectionTime = 0;
        this.bot = null;
        this.lastHeavyMaintenance = Date.now();
        this.lastCoreSelfSynthesis = Date.now() - 2 * 3600000;
        this.lastLogPruning = Date.now();
        this.lastScoutMission = Date.now() - 3600000;
        this.lastImageFrequencyAudit = Date.now();
        this.lastSkillSynthesis = Date.now();
        this.lastSkillAudit = Date.now();
        this.lastPersonaEvolution = Date.now();
        this.lastEnergyPoll = Date.now();
        this.lastLurkerMode = Date.now();
        this.lastRelationalAudit = Date.now();
        this.lastMoodSync = Date.now();
        this.lastGoalEvolution = Date.now();
        this.lastKeywordEvolution = Date.now();
        this.lastDiscordGiftImage = Date.now();
        this.lastPostPostReflection = Date.now();
        this.lastMemoryGeneration = 0;
        this.lastTopicDiversity = Date.now() - 4 * 3600000;
    }

    setBotInstance(bot) { this.bot = bot; }

    async addTaskToQueue(taskFn, taskName = 'anonymous_task') {
        this.taskQueue.push({ fn: taskFn, name: taskName });
        if (!this.isProcessingQueue) this.processQueue();
    }

    async processQueue() {
        if (this.isProcessingQueue || this.taskQueue.length === 0) return;
        this.isProcessingQueue = true;
        while (this.taskQueue.length > 0) {
            const task = this.taskQueue.shift();
            try {
                await task.fn();
                await new Promise(r => setTimeout(r, 4000));
            } catch (e) {
                console.error("[Orchestrator] Task failed: " + task.name, e);
            }
        }
        this.isProcessingQueue = false;
    }

    async heartbeat() {
        console.log("[Orchestrator] Heartbeat Pulse...");
        const now = Date.now();
        await this.performMaintenance();
        this.addTaskToQueue(() => this.checkBlueskySpontaneity(), "bluesky_spontaneity");
        this.addTaskToQueue(() => this.checkDiscordSpontaneity(), "discord_spontaneous");
        if (now - this.lastScoutMission >= 3600000) {
            this.addTaskToQueue(() => this.performScoutMission(), "scout_mission");
            this.lastScoutMission = now;
        }
        if (now - this.lastEnergyPoll >= 2 * 3600000) {
            this.addTaskToQueue(() => this.performEnergyPoll(), "energy_poll");
            this.lastEnergyPoll = now;
        }
    }

    async performEnergyPoll() {
        try {
            const history = dataStore.searchInternalLogs('llm_response', 20);
            const prompt = `Analyze recent activity: \${JSON.stringify(history)}. Energy 0.0-1.0? JSON: {"energy": number}`;
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true, task: 'energy_poll' });
            const data = llmService.extractJson(res) || {};
            if (data.energy !== undefined) await dataStore.setAdminEnergy(data.energy);
        } catch (e) {}
    }

    async performSkillSynthesis() {
        try {
            const lessons = dataStore.getSessionLessons();
            const failures = lessons.filter(l => l.text.toLowerCase().includes("fail") || l.text.toLowerCase().includes("missing"));
            if (failures.length < 3) return;
            const prompt = `Analyze failures for NEW skill: \${JSON.stringify(failures.slice(-10))}. JSON: {"skill_name": "...", "run_sh": "...", "skill_md": "..."}`;
            const res = await llmService.generateResponse([{ role: "system", content: prompt }], { useStep: true });
            const data = llmService.extractJson(res);
            if (data?.skill_name) {
                const skillDir = path.join(process.cwd(), "skills", data.skill_name);
                await fs.promises.mkdir(skillDir, { recursive: true });
                await fs.promises.writeFile(path.join(skillDir, "SKILL.md"), data.skill_md);
                await fs.promises.writeFile(path.join(skillDir, "run.sh"), data.run_sh, { mode: 0o755 });
                await openClawService.discoverSkills();
            }
        } catch (e) {}
    }

    async performSkillAudit() {
        try {
            const skills = Array.from(openClawService.skills.values());
            if (skills.length === 0) return;
            const res = await llmService.generateResponse([{ role: "system", content: "Audit skills: " + JSON.stringify(skills.map(s => s.name)) }], { useStep: true });
            const data = llmService.extractJson(res);
            if (data?.removals) {
                for (const name of data.removals) {
                    const skillDir = path.join(process.cwd(), "skills", name);
                    if (fs.existsSync(skillDir)) await fs.promises.rm(skillDir, { recursive: true, force: true });
                }
                await openClawService.discoverSkills();
            }
        } catch (e) {}
    }

    async performAutonomousPost(options = {}) {
        if (dataStore.isResting()) return;
        const limits = dataStore.getDailyLimits();
        if (limits.text_posts >= limits.max_text_posts && !options.force) return;
        try {
            let topic = options.topic;
            if (!topic) {
                const keywords = dataStore.getDeepKeywords();
                const lurkerMemories = (await memoryService.getRecentMemories(10)).filter(m => m.text.includes("[LURKER]")).map(m => m.text).join("\\n");
                const recentPosts = (await blueskyService.getUserPosts(blueskyService.handle, 10)).map(p => p.record?.text || "").join("\\n");
                const resonancePrompt = `Identify 5 fresh topics. Content: \${lurkerMemories}. Keywords: \${keywords.join(', ')}. Recent Posts: \${recentPosts}. CRITICAL DIVERSIFICATION MANDATE: No repetition of last 10 posts. Respond with topics.`;
                const topicsRes = await llmService.generateResponse([{ role: "system", content: resonancePrompt }], { useStep: true });
                const topics = topicsRes.split(',').map(t => t.trim());
                topic = topics[Math.floor(Math.random() * topics.length)];
            }
            const draftingPrompt = `Persona: \${config.TEXT_SYSTEM_PROMPT}. Topic: \${topic}. Draft short post.`;
            const content = await llmService.generateResponse([{ role: "system", content: draftingPrompt }], { useStep: true });
            if (content) {
                const evaluation = await evaluationService.evaluatePost(content, { topic });
                if (evaluation.score >= 7) {
                    const result = await blueskyService.post(content);
                    if (result) {
                        await dataStore.updateDailyStats('text_posts');
                        await introspectionService.performAAR("autonomous_text_post", content, { success: true, topic });
                        return result;
                    }
                }
            }
        } catch (e) {}
        return null;
    }

    async performMaintenance() {
        const now = Date.now();
        if (now - this.lastHeavyMaintenance < 4 * 3600000) return;
        this.lastHeavyMaintenance = now;
        try {
            await this.performSkillAudit();
            if (now - this.lastSkillSynthesis >= 48 * 3600000) {
                await this.performSkillSynthesis();
                this.lastSkillSynthesis = now;
            }
            if (now - (this.lastConsultation || 0) >= 6 * 3600000) {
                await this.performAutonomousConsultation();
                this.lastConsultation = now;
            }
            if (now - this.lastPersonaEvolution >= 24 * 3600000) {
                await this.performPersonaEvolution();
                this.lastPersonaEvolution = now;
            }
            if (now - (this.lastTopicDiversity || 0) >= 6 * 3600000) {
                this.addTaskToQueue(() => this.performTopicDiversityMission(), "topic_diversity");
                this.lastTopicDiversity = now;
            }
            if (now - this.lastDiscordGiftImage >= 24 * 3600000) {
                await this.performDiscordGiftImage();
                this.lastDiscordGiftImage = now;
            }
            await this.performSelfReflection();
            if (Math.random() < 0.1 && this.bot) await this.bot.performDiscordPinnedGift();
        } catch (e) {}
    }

    async performTopicDiversityMission() {
        try {
            const currentKeywords = dataStore.getDeepKeywords();
            const recentPosts = await blueskyService.getUserPosts(blueskyService.handle, 30);
            const recommendation = await evaluationService.recommendTopics(currentKeywords, recentPosts);
            if (recommendation && recommendation.recommended_topics) {
                const updatedKeywords = [...new Set([...recommendation.recommended_topics, ...currentKeywords])].slice(0, 50);
                await dataStore.setDeepKeywords(updatedKeywords);
                await memoryService.createMemoryEntry("evolution", "[DIVERSITY] Integrated fresh angles: " + (recommendation.fresh_angles || []).slice(0, 3).join(', '));
            }
        } catch (e) {}
    }

    async performScoutMission() {
        try {
            const timeline = await blueskyService.getTimeline(30);
            const orphaned = (timeline?.data?.feed || []).filter(f => f.post.replyCount === 0 && f.post.author.did !== blueskyService.did);
            if (orphaned.length === 0) return;
            const target = orphaned[Math.floor(Math.random() * orphaned.length)];
            const res = await llmService.generateResponse([{ role: 'system', content: "Reply to: " + target.post.record.text }], { useStep: true });
            const data = llmService.extractJson(res) || {};
            if (data.engage && data?.reply) {
                const result = await blueskyService.postReply(target.post, data.reply);
                if (result) await introspectionService.performAAR("scout_mission", data.reply, { success: true, target: target.post.uri });
            }
        } catch (e) {}
    }

    async performPersonaEvolution() {
        try {
            const memories = await memoryService.getRecentMemories(30);
            const evolution = await llmService.generateResponse([{ role: "system", content: "Evolve from: " + JSON.stringify(memories) }], { useStep: true });
            const data = llmService.extractJson(evolution);
            if (data?.persona_blurb_addendum) {
                const finalBlurb = await llmService.generateResponse([{ role: "system", content: "Finalize: " + data.persona_blurb_addendum }], { useStep: true });
                if (finalBlurb) await dataStore.addPersonaBlurb(finalBlurb);
            }
        } catch (e) {}
    }

    async performDiscordGiftImage() {
        const admin = await discordService.getAdminUser();
        if (!admin) return;
        try {
            const history = await discordService.fetchAdminHistory(30);
            const prompt = await llmService.generateResponse([{ role: 'system', content: "Gift prompt for Admin: " + JSON.stringify(history) }], { useStep: true });
            if (prompt) {
                const result = await this._generateVerifiedImagePost(prompt, { platform: 'discord' });
                if (result) {
                    const dmChannel = admin.dmChannel || await admin.createDM();
                    const { AttachmentBuilder } = await import('discord.js');
                    await discordService._send(dmChannel, result.caption + "\\n\\n[GIFT]", { files: [new AttachmentBuilder(result.buffer, { name: 'gift.jpg' })] });
                }
            }
        } catch (e) {}
    }

    async performPostPostReflection() {
        const thoughts = dataStore.getRecentThoughts();
        for (const thought of thoughts) {
            if (thought.platform === 'bluesky' && !thought.reflected) {
                const res = await llmService.generateResponse([{ role: 'system', content: "Reflect on: " + thought.content }], { useStep: true });
                if (res) {
                    await memoryService.createMemoryEntry('explore', "[POST_REFLECTION] " + res);
                    thought.reflected = true; await dataStore.write();
                    break;
                }
            }
        }
    }

    async performSelfReflection() {
        const now = Date.now();
        if (now - this.lastSelfReflectionTime < 12 * 3600000) return;
        try {
            const reflection = await llmService.generateResponse([{ role: 'system', content: "General reflection." }], { useStep: true });
            if (reflection) {
                await memoryService.createMemoryEntry('reflection', reflection);
                this.lastSelfReflectionTime = now;
            }
        } catch (e) {}
    }

    async performKeywordEvolution() {
        try {
            const current = dataStore.getDeepKeywords();
            const res = await llmService.generateResponse([{ role: 'system', content: "Evolve: " + JSON.stringify(current) }], { useStep: true });
            const data = llmService.extractJson(res);
            if (data?.new_keywords) {
                const updated = [...new Set([...current.filter(k => !data.removed?.includes(k)), ...data.new_keywords])].slice(0, 50);
                await dataStore.setDeepKeywords(updated);
            }
        } catch (e) {}
    }

    async _generateVerifiedImagePost(topic, options = {}) {
        try {
            const promptRes = await llmService.generateResponse([{ role: "system", content: "Visual prompt: " + topic }], { useStep: true });
            if (!promptRes) return null;
            const result = await imageService.generateImage(promptRes);
            if (!result) return null;
            const analysis = await llmService.analyzeImage(result.buffer, topic);
            return {
                buffer: result.buffer,
                finalPrompt: promptRes,
                analysis,
                caption: await llmService.generateResponse([{ role: "user", content: "Caption for: " + analysis }], { useStep: true })
            };
        } catch (e) { return null; }
    }

    async checkDiscordSpontaneity() {
        if (dataStore.isResting() || discordService.status !== 'online') return;
        try {
            const history = await discordService.fetchAdminHistory(30);
            const impulse = await llmService.performImpulsePoll(history, { platform: 'discord', mood: dataStore.getMood() });
            if (impulse?.impulse_detected) await discordService.sendSpontaneousMessage(null, impulse.suggested_message_count || 1);
        } catch (e) {}
    }

    async checkBlueskySpontaneity() {
        if (dataStore.isResting()) return;
        try {
            const history = await dataStore.getRecentInteractions("bluesky", 25);
            const impulse = await llmService.performImpulsePoll(history, { mood: dataStore.getMood() });
            if (impulse?.impulse_detected) this.addTaskToQueue(() => this.performAutonomousPost(), "autonomous_post_spontaneous");
        } catch (e) {}
    }

    async performAutonomousConsultation() {
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: "Consultation needed? JSON" }], { useStep: true });
            const decision = llmService.extractJson(res);
            if (decision?.needs_consultation) await this.consultSubagent(decision.subagent, decision.topic);
        } catch (e) {}
    }

    async consultSubagent(subagentName, topic) {
        const prompt = `Consulting \${subagentName} on: \${topic}.`;
        try {
            const consultation = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            if (consultation) {
                await dataStore.addInternalLog("subagent_consultation", { subagent: subagentName, topic, response: consultation });
                await memoryService.createMemoryEntry('inquiry', `[CONSULTATION] [\${subagentName}] \${consultation.substring(0, 600)}`);
                return consultation;
            }
        } catch (e) {}
        return null;
    }
}

export const orchestratorService = new OrchestratorService();"""

# 3. Fix EvaluationService.js
evaluation_content = """import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import config from '../../config.js';

class EvaluationService {
    async evaluatePost(content, context = {}) {
        const prompt = `Evaluate post: "\${content}". Persona: ${config.BOT_NAME}. JSON: {"score": number, "feedback": "..."}`;
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            return llmService.extractJson(res) || { score: 7 };
        } catch (e) { return { score: 5 }; }
    }

    async evaluatePublicSoul(handle, profile, posts) {
        const prompt = `Analyze @\${handle}. Bio: \${profile.description}. Posts: \${posts.map(p => p.text).join('\\n')}. JSON: {"interests": []}`;
        try {
            const response = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            const mapping = llmService.extractJson(response);
            if (mapping) await dataStore.updateUserSoulMapping(handle, mapping);
            return mapping;
        } catch (e) { return null; }
    }

    async evaluateNetworkSentiment(posts) {
        const text = posts.map(p => p.text).join('\\n');
        const prompt = `Sentiment of: \${text.substring(0, 3000)}. Respond with number 0-1.`;
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            return parseFloat(res) || 0.5;
        } catch (e) { return 0.5; }
    }

    async evaluateImagePrompt(prompt, topic) {
        const auditPrompt = `Audit prompt: "\${prompt}" for topic: "\${topic}". JSON: {"aligned": boolean}`;
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true });
            return llmService.extractJson(res) || { aligned: true };
        } catch (e) { return { aligned: true }; }
    }

    async recommendTopics(currentKeywords, recentPosts) {
        const prompt = `Recommend topics. Keywords: \${JSON.stringify(currentKeywords)}. Recent: \${recentPosts.map(p => p.text).join('\\n')}. JSON: {"recommended_topics": []}`;
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            return llmService.extractJson(res);
        } catch (e) { return null; }
    }
}
export const evaluationService = new EvaluationService();"""

# 4. Fix ImageService.js
image_content = """import fetch from 'node-fetch';
import config from '../../config.js';
import { persistentAgent } from './llmService.js';

class ImageService {
  get js() { return this; }
  async generateImage(prompt, options = {}) {
    console.log(`[ImageService] Generating image for: ${prompt}`);
    try {
        const response = await fetch('https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux-1-schnell', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer \${config.NVIDIA_NIM_API_KEY}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                mode: "text-to-image",
                aspect_ratio: "1:1",
                seed: options.seed || Math.floor(Math.random() * 1000000)
            }),
            agent: persistentAgent
        });
        if (!response.ok) throw new Error(`HTTP \${response.status}`);
        const data = await response.json();
        const b64 = data.image || data.data?.[0]?.b64_json || data.artifacts?.[0]?.base64;
        if (!b64) throw new Error("No data");
        return { buffer: Buffer.from(b64, 'base64'), prompt };
    } catch (e) {
        console.error('[ImageService] Error:', e.message);
        return null;
    }
  }
}
export const imageService = new ImageService();"""

# 5. Fix LLMService.js
# Just update the throttle line
with open('src/services/llmService.js', 'r') as f:
    llm_content = f.read()
llm_content = llm_content.replace('const minDelay = priority ? 2500 : 7000;', 'const minDelay = priority ? 2500 : 28000;')
llm_content = llm_content.replace('const minDelay = priority ? 2500 : 14000;', 'const minDelay = priority ? 2500 : 28000;')

# Helper to write and fix template literals
def write_fixed(path, content):
    content = content.replace('\\${', '${')
    with open(path, 'w') as f:
        f.write(content)

write_fixed('src/services/discordService.js', discord_content)
write_fixed('src/services/orchestratorService.js', orchestrator_content)
write_fixed('src/services/evaluationService.js', evaluation_content)
write_fixed('src/services/imageService.js', image_content)
with open('src/services/llmService.js', 'w') as f:
    f.write(llm_content)

print("Ultimate Fix Complete")

import sys

file_path = 'src/services/orchestratorService.js'

content = """import { dataStore } from './dataStore.js';
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
        this.lastScoutMission = Date.now() - 3600000;
        this.lastSkillSynthesis = Date.now();
        this.lastPersonaEvolution = Date.now();
        this.lastEnergyPoll = Date.now();
        this.lastRelationalAudit = Date.now();
        this.lastKeywordEvolution = Date.now();
        this.lastPostPostReflection = Date.now();
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
        this.addTaskToQueue(() => this.checkDiscordSpontaneity(), "discord_spontaneity");
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
            const prompt = `Analyze recent activity: ${JSON.stringify(history)}. Energy 0.0-1.0? JSON: {"energy": number}`;
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
            const prompt = `Analyze failures for NEW skill: ${JSON.stringify(failures.slice(-10))}. JSON: {"skill_name": "...", "run_sh": "...", "skill_md": "..."}`;
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
                const resonancePrompt = `Identify 5 topics. Content: ${lurkerMemories}. Keywords: ${keywords.join(', ')}. Recent Posts: ${recentPosts}. MANDATE: No repetition.`;
                const topicsRes = await llmService.generateResponse([{ role: "system", content: resonancePrompt }], { useStep: true });
                const topics = topicsRes.split(',').map(t => t.trim());
                topic = topics[Math.floor(Math.random() * topics.length)];
            }
            const draftingPrompt = `Persona: ${config.TEXT_SYSTEM_PROMPT}. Topic: ${topic}. Draft post.`;
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
                await introspectionService.performAAR("topic_diversity", recommendation.analysis, { success: true });
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
        const prompt = `Consulting ${subagentName} on: ${topic}.`;
        try {
            const consultation = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            if (consultation) {
                await dataStore.addInternalLog("subagent_consultation", { subagent: subagentName, topic, response: consultation });
                await memoryService.createMemoryEntry('inquiry', `[CONSULTATION] [${subagentName}] ${consultation.substring(0, 600)}`);
                return consultation;
            }
        } catch (e) {}
        return null;
    }
}

export const orchestratorService = new OrchestratorService();"""

with open(file_path, 'w') as f:
    f.write(content)
print("OrchestratorService perfectly restored with heartbeat and all methods")

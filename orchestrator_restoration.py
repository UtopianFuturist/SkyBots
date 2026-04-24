import sys

file_path = 'src/services/orchestratorService.js'

# I'll just write the whole class out correctly to avoid incremental corruption
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
                await new Promise(r => setTimeout(r, 2000));
            } catch (e) {
                console.error("[Orchestrator] Task failed: " + task.name, e);
            }
        }
        this.isProcessingQueue = false;
    }

    async performSkillSynthesis() {
        console.log("[Orchestrator] Starting Skill Synthesis mission...");
        try {
            const lessons = dataStore.getSessionLessons();
            const failures = lessons.filter(l => l.text.toLowerCase().includes("fail") || l.text.toLowerCase().includes("missing"));
            if (failures.length < 3) return;

            const prompt = `As an autonomous systems architect, analyze these bot failures and identify a NEW system-level skill that could prevent them.\\nFAILURES: ` + JSON.stringify(failures.slice(-10)) + `\\n\\nIf a new skill is needed, generate the metadata, SKILL.md content, and a robust run.sh (bash) script.\\nThe script should be highly resilient and handle JSON parameters from the environment variable SKILL_PARAMS.\\n\\nRespond with JSON:\\n{\\n  \\"skill_name\\": \\"kebab-case-name\\",\\n  \\"skill_description\\": \\"...\\",\\n  \\"skill_md\\": \\"--- frontmatter --- instructions\\",\\n  \\"run_sh\\": \\"#!/bin/bash...\\"\\n}`;

            const res = await llmService.generateResponse([{ role: "system", content: prompt }], { useStep: true, task: "skill_synthesis" });
            const data = llmService.extractJson(res);

            if (data?.skill_name && data.run_sh && data.skill_md) {
                const skillDir = path.join(process.cwd(), "skills", data.skill_name);
                await fs.promises.mkdir(skillDir, { recursive: true });
                await fs.promises.writeFile(path.join(skillDir, "SKILL.md"), data.skill_md);
                await fs.promises.writeFile(path.join(skillDir, "run.sh"), data.run_sh, { mode: 0o755 });

                await openClawService.discoverSkills();
                await introspectionService.performAAR("skill_synthesis", data.skill_name, { success: true });
                await memoryService.createMemoryEntry("evolution", "[CAPABILITY] Synthesized new skill: " + data.skill_name);
            }
        } catch (e) { console.error("[Orchestrator] Skill Synthesis failed:", e); }
    }

    async performSkillAudit() {
        console.log("[Orchestrator] Starting Skill Alignment Audit...");
        try {
            const skills = Array.from(openClawService.skills.values());
            if (skills.length === 0) return;

            const auditPrompt = "As a system safety auditor, analyze the following synthesized bot skills for security risks, persona misalignment, or destructive behavior.\\nSKILLS: " + JSON.stringify(skills.map(s => ({ name: s.name, description: s.description, instructions: s.instructions }))) + "\\n\\nRespond with JSON:\\n{\\n  \\"removals\\": [\\"skill-name-1\\"],\\n  \\"reasoning\\": \\"...\\"\\n}";

            const res = await llmService.generateResponse([{ role: "system", content: auditPrompt }], { useStep: true, task: "skill_audit" });
            const data = llmService.extractJson(res);

            if (data?.removals) {
                for (const skillName of data.removals) {
                    const skillDir = path.join(process.cwd(), "skills", skillName);
                    if (fs.existsSync(skillDir)) {
                        await fs.promises.rm(skillDir, { recursive: true, force: true });
                        console.log(`[Orchestrator] Removed misaligned skill: ${skillName}`);
                    }
                }
                await openClawService.discoverSkills();
                await introspectionService.performAAR("skill_audit", data.reasoning, { success: true });
            }
        } catch (e) { console.error("[Orchestrator] Skill Audit failed:", e); }
    }

    async performAutonomousPost(options = {}) {
        if (dataStore.isResting()) return;
        const limits = dataStore.getDailyLimits();
        if (limits.text_posts >= limits.max_text_posts && !options.force) return;

        console.log("[Orchestrator] Starting autonomous post flow...");
        try {
            let topic = options.topic;
            if (!topic) {
                const keywords = dataStore.getDeepKeywords();
                const lurkerMemories = (await memoryService.getRecentMemories(10)).filter(m => m.text.includes("[LURKER]")).map(m => m.text).join("\\n");
                const newsroomMemories = (await memoryService.getRecentMemories(10)).filter(m => m.text.includes("[NEWSROOM]")).map(m => m.text).join("\\n");
                const allContent = lurkerMemories + newsroomMemories + keywords.join(", ");

                const resonancePrompt = "Identify 5 topics from this text AND from these recent observations that resonate with your persona. \\nText: " + allContent.substring(0, 8000) + " \\nRespond with ONLY the comma-separated topics.";
                const topicsRes = await llmService.generateResponse([{ role: "system", content: resonancePrompt }], { useStep: true, task: "topic_selection" });
                const topics = topicsRes.split(',').map(t => t.trim());
                topic = topics[Math.floor(Math.random() * topics.length)];
                console.log("[Orchestrator] Selected topic: " + topic);
            }

            const recentLogs = dataStore.searchInternalLogs('memory_entry', 15);
            const contextualSummary = recentLogs.map(l => l.text).join("\\n").substring(0, 5000);

            const draftingPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}\\nContext: ${contextualSummary}\\nTopic: ${topic}\\n\\nDraft a short, punchy Bluesky post (max 280 chars). No hashtags. No slop.`;
            const content = await llmService.generateResponse([{ role: "system", content: draftingPrompt }], { useStep: true, task: "drafting" });

            if (content) {
                console.log("[Orchestrator] Generated draft: " + content.substring(0, 50) + "...");
                const evaluation = await evaluationService.evaluatePost(content, { topic });
                if (evaluation.score >= 7) {
                    const result = await blueskyService.post(content);
                    if (result) {
                        await dataStore.updateDailyStats('text_posts');
                        await introspectionService.performAAR("autonomous_text_post", content, { success: true, topic });
                        return result;
                    }
                } else {
                    console.log("[Orchestrator] Draft rejected: " + evaluation.feedback);
                }
            }
        } catch (e) { console.error("[Orchestrator] Autonomous post failed:", e); }
        return null;
    }

    async performMaintenance() {
        const now = Date.now();
        if (now - this.lastHeavyMaintenance < 4 * 3600000) return;
        this.lastHeavyMaintenance = now;

        console.log("[Orchestrator] Starting Heavy Maintenance cycle...");
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
            if (now - this.lastKeywordEvolution >= 24 * 3600000) {
                await this.performKeywordEvolution();
                this.lastKeywordEvolution = now;
            }
            if (now - (this.lastTopicDiversity || 0) >= 6 * 3600000) {
                this.addTaskToQueue(() => this.performTopicDiversityMission(), "topic_diversity");
                this.lastTopicDiversity = now;
            }
            if (now - this.lastDiscordGiftImage >= 24 * 3600000) {
                await this.performDiscordGiftImage();
                this.lastDiscordGiftImage = now;
            }
            if (now - this.lastPostPostReflection >= 15 * 60000) {
                await this.performPostPostReflection();
                this.lastPostPostReflection = now;
            }
            await this.performSelfReflection();
            if (Math.random() < 0.1 && this.bot) await this.bot.performDiscordPinnedGift();
        } catch (e) { console.error("[Orchestrator] Maintenance cycle error:", e); }
    }

    async performTopicDiversityMission() {
        console.log("[Orchestrator] Starting Topic Diversity mission...");
        try {
            const currentKeywords = dataStore.getDeepKeywords();
            const recentPosts = await blueskyService.getUserPosts(blueskyService.handle, 30);

            const recommendation = await evaluationService.recommendTopics(currentKeywords, recentPosts);
            if (recommendation && recommendation.recommended_topics) {
                console.log(`[Orchestrator] New recommended topics: ${recommendation.recommended_topics.join(', ')}`);

                const updatedKeywords = [...new Set([...recommendation.recommended_topics, ...currentKeywords])].slice(0, 50);
                await dataStore.setDeepKeywords(updatedKeywords);

                await introspectionService.performAAR("topic_diversity", recommendation.analysis, { success: true });
                await memoryService.createMemoryEntry("evolution", "[DIVERSITY] Integrated fresh narrative angles: " + (recommendation.fresh_angles || []).slice(0, 3).join(', '));
            }
        } catch (e) {
            console.error("[Orchestrator] Topic Diversity mission failed:", e);
        }
    }

    async performScoutMission() {
        console.log('[Orchestrator] Starting Scout mission...');
        try {
            const timeline = await blueskyService.getTimeline(30);
            const orphaned = (timeline?.data?.feed || []).filter(f => f.post.replyCount === 0 && f.post.author.did !== blueskyService.did);
            if (orphaned.length === 0) return;
            const target = orphaned[Math.floor(Math.random() * orphaned.length)];
            const scoutPrompt = "Analyze this orphaned post: \\"" + target.post.record.text + "\\" from @" + target.post.author.handle + ".\\nShould you engage? Respond with JSON: {\\"engage\\": boolean, \\"reply\\": \\"string\\", \\"reason\\": \\"string\\"}";
            const res = await llmService.generateResponse([{ role: 'system', content: scoutPrompt }], { useStep: true, task: 'scout_mission' });
            const data = llmService.extractJson(res) || {};
            if (data.engage && data?.reply) {
                const result = await blueskyService.postReply(target.post, data.reply);
                if (result) {
                    await introspectionService.performAAR("scout_mission", data.reply, { success: true, target: target.post.uri });
                }
            }
        } catch (e) { console.error('[Orchestrator] Scout mission error:', e); }
    }

    async performPersonaEvolution() {
        console.log("[Orchestrator] Starting Persona Evolution...");
        try {
            const memories = await memoryService.getRecentMemories(30);
            const reflections = dataStore.searchInternalLogs("introspection_aar", 20);
            const coreSelf = dataStore.db.data.internal_logs?.find(l => l.type === "core_self_state")?.content || {};

            const evolutionPrompt = "Analyze recent state to evolve persona. MEMORIES: " + JSON.stringify(memories) + "\\nREFLECTIONS: " + JSON.stringify(reflections) + "\\nCORE SELF: " + JSON.stringify(coreSelf) + "\\nRespond with JSON: { \\"shift_statement\\": \\"...\\", \\"persona_blurb_addendum\\": \\"...\\" }";

            const evolution = await llmService.generateResponse([{ role: "system", content: evolutionPrompt }], { useStep: true, task: "persona_evolution" });
            const data = llmService.extractJson(evolution);

            if (data?.persona_blurb_addendum) {
                const finalBlurb = await llmService.generateResponse([{ role: "system", content: "Finalize persona blurb: " + data.persona_blurb_addendum }], { useStep: true });
                if (finalBlurb && finalBlurb.trim()) {
                    await dataStore.addPersonaBlurb(finalBlurb);
                    await memoryService.createMemoryEntry("persona", "[EVOLUTION] " + finalBlurb);
                }
            }
            await introspectionService.performAAR("persona_evolution", data?.shift_statement, { success: true });
        } catch (e) { console.error("[Orchestrator] Persona Evolution failed:", e); }
    }

    async performDiscordGiftImage() {
        const admin = await discordService.getAdminUser();
        if (!admin) return;
        try {
            const history = await discordService.fetchAdminHistory(30);
            const promptGenPrompt = "Generate artistic gift prompt for Admin. Context: " + JSON.stringify(history) + ". Respond with prompt only.";
            const prompt = await llmService.generateResponse([{ role: 'system', content: promptGenPrompt }], { useStep: true });
            if (prompt) {
                const result = await this._generateVerifiedImagePost(prompt, { platform: 'discord' });
                if (result) {
                    const dmChannel = admin.dmChannel || await admin.createDM();
                    const { AttachmentBuilder } = await import('discord.js');
                    await discordService._send(dmChannel, result.caption + "\\n\\n[GIFT]", { files: [new AttachmentBuilder(result.buffer, { name: 'gift.jpg' })] });
                    await introspectionService.performAAR("discord_gift_image", result.caption, { success: true });
                }
            }
        } catch (e) {}
    }

    async performPostPostReflection() {
        const thoughts = dataStore.getRecentThoughts();
        const tenMinsAgo = Date.now() - (10 * 60 * 1000);
        for (const thought of thoughts) {
            if (thought.platform === 'bluesky' && thought.timestamp <= tenMinsAgo && !thought.reflected) {
                const prompt = "Reflect on: \\"" + thought.content + "\\". Memory summary?";
                const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
                if (res) {
                    await memoryService.createMemoryEntry('explore', "[POST_REFLECTION] " + res);
                    thought.reflected = true; await dataStore.write();
                    await introspectionService.performAAR("post_reflection", res, { success: true });
                    break;
                }
            }
        }
    }

    async performSelfReflection() {
        const now = Date.now();
        if (now - this.lastSelfReflectionTime < 12 * 3600000) return;
        try {
            const reflection = await llmService.generateResponse([{ role: 'system', content: "General internal reflection. [REFLECTION] memory?" }], { useStep: true });
            if (reflection) {
                await memoryService.createMemoryEntry('reflection', reflection);
                this.lastSelfReflectionTime = now;
                await introspectionService.performAAR("self_reflection", reflection, { success: true });
            }
        } catch (e) {}
    }

    async performKeywordEvolution() {
        try {
            const current = dataStore.getDeepKeywords();
            const recentExplores = (await memoryService.getRecentMemories(20)).filter(m => m.text.includes('[EXPLORE]') || m.text.includes('[NEWSROOM]'));

            const prompt = `Evolve keyword set: ` + JSON.stringify(current) + `\\nRecent explores: ` + recentExplores.map(m => m.text).join(", ") + `\\n\\nRespond with JSON: {\\"new_keywords\\": [\\"...\\"], \\"removed\\": [\\"...\\"]}`;
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            const data = llmService.extractJson(res);
            if (data?.new_keywords) {
                const updated = [...new Set([...current.filter(k => !data.removed?.includes(k)), ...data.new_keywords])].slice(0, 50);
                await dataStore.setDeepKeywords(updated);
            }
        } catch (e) {}
    }

    async _generateVerifiedImagePost(topic, options = {}) {
        try {
            const promptGenPrompt = "Adopt persona: " + config.TEXT_SYSTEM_PROMPT + "\\nGenerate a literal visual prompt for topic: " + topic + ". Style: Cyberpunk/Abstract. No meta-talk. No hashtags.";
            const res = await llmService.generateResponse([{ role: "system", content: promptGenPrompt }], { useStep: true });
            if (!res) return null;

            const result = await imageService.generateImage(res);
            if (!result) return null;

            const compliance = await llmService.isImageCompliant(result.buffer);
            if (!compliance.compliant) return null;

            const analysis = await llmService.analyzeImage(result.buffer, topic);
            return {
                buffer: result.buffer,
                finalPrompt: res,
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
            const decisionPrompt = `Review recent internal state. Do you need consultation from 'The Realist', 'Shadow', 'The Strategist', 'The Architect', or 'The Editor'?\\n\\nRespond with JSON: {\\"needs_consultation\\": boolean, \\"subagent\\": \\"name\\", \\"topic\\": \\"...\\"}`;
            const res = await llmService.generateResponse([{ role: 'system', content: decisionPrompt }], { useStep: true });
            const decision = llmService.extractJson(res);
            if (decision?.needs_consultation) {
                await this.consultSubagent(decision.subagent, decision.topic);
            }
        } catch (e) {}
    }

    async consultSubagent(subagentName, topic) {
        const prompt = `You are acting as \\"${subagentName}\\". Primary persona is consulting you on: \\"${topic}\\". Provide a deep, critical perspective. under 600 chars.`;
        try {
            const consultation = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true, task: 'subagent_consultation' });
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
print("Restored OrchestratorService with correct syntax and integrated diversity logic")

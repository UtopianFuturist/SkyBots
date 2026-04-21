import { dataStore } from './dataStore.js';
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
            try { await task.fn(); } catch (e) { console.error("[Orchestrator] Task failed: " + task.name, e); }
        }
        this.isProcessingQueue = false;
    }


    async performSkillSynthesis() {
        console.log("[Orchestrator] Starting Skill Synthesis mission...");
        try {
            const lessons = dataStore.getSessionLessons();
            const failures = lessons.filter(l => l.text.toLowerCase().includes("fail") || l.text.toLowerCase().includes("missing"));
            if (failures.length < 3) return;

            const prompt = "As an autonomous systems architect, analyze these bot failures and identify a NEW system-level skill that could prevent them.\nFAILURES: " + JSON.stringify(failures.slice(-10)) + "\n\nIf a new skill is needed, generate the metadata, SKILL.md content, and a robust run.sh (bash) script.\nThe script should be highly resilient and handle JSON parameters from the environment variable SKILL_PARAMS.\n\nRespond with JSON:\n{\n  \"skill_name\": \"kebab-case-name\",\n  \"skill_description\": \"...\",\n  \"skill_md\": \"--- frontmatter --- instructions\",\n  \"run_sh\": \"#!/bin/bash...\"\n}";

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

            const auditPrompt = "As a system safety auditor, analyze the following synthesized bot skills for security risks, persona misalignment, or destructive behavior.\nSKILLS: " + JSON.stringify(skills.map(s => ({ name: s.name, description: s.description, instructions: s.instructions }))) + "\n\nRespond with JSON:\n{\n  \"removals\": [\"skill-name-1\"],\n  \"reasoning\": \"...\"\n}";

            const res = await llmService.generateResponse([{ role: "system", content: auditPrompt }], { useStep: true, task: "skill_audit" });
            const data = llmService.extractJson(res);

            if (data?.removals) {
                for (const skillName of data.removals) {
                    const skillDir = path.join(process.cwd(), "skills", skillName);
                    if (fs.existsSync(skillDir)) {
                        await fs.promises.rm(skillDir, { recursive: true, force: true });
                        openClawService.skills.delete(skillName);
                        console.log("[Orchestrator] Audit removed non-compliant skill: " + skillName);
                    }
                }
                await introspectionService.performAAR("skill_audit", data.removals.join(", "), { success: true });
            }
        } catch (e) { console.error("[Orchestrator] Skill Audit failed:", e); }
    }

    async heartbeat() {
        if (this.bot?.paused) return; console.log('[Orchestrator] Heartbeat Pulse...');
        const now = Date.now();
        await this.processContinuations();
        const lastPost = dataStore.getLastAutonomousPostTime() || 0;
        const lastPostMs = typeof lastPost === 'string' ? new Date(lastPost).getTime() : lastPost;
        const cooldown = (config.AUTONOMOUS_POST_COOLDOWN || 6) * 3600000;
        if (now - lastPostMs >= cooldown) {
            this.addTaskToQueue(() => this.performAutonomousPost(), "autonomous_post");
        }
        this.addTaskToQueue(() => this.checkDiscordSpontaneity(), "discord_spontaneity");
        this.addTaskToQueue(() => this.checkBlueskySpontaneity(), "bluesky_spontaneity");
        this.addTaskToQueue(() => this.checkMaintenanceTasks(), "maintenance_tasks");
        this.addTaskToQueue(() => this.performTemporalMaintenance(), "temporal_maintenance");
        
        // Reimplement making memoryservice entry posts on Bluesky
        if (memoryService.isEnabled()) {
            this.addTaskToQueue(async () => {
                const recentLogs = await dataStore.getInternalLogs(50);
                const contextualSummary = recentLogs.map(l => l.text).join("\n").substring(0, 1000);
                if (contextualSummary.length > 100) {
                    await memoryService.createMemoryEntry("reflection", contextualSummary);
                }
            }, "memory_entry_generation");
        }

        if (now - this.lastScoutMission >= 2 * 3600000) {
            this.addTaskToQueue(() => this.performScoutMission(), "scout_mission");
            this.lastScoutMission = now;
        }
        if (now - this.lastEnergyPoll >= 3 * 3600000) {
            this.addTaskToQueue(() => this.performEnergyPoll(), "energy_poll");
            this.lastEnergyPoll = now;
        }
        if (now - this.lastLurkerMode >= 4 * 3600000) {
            this.addTaskToQueue(() => this.performLurkerObservation(), "lurker_observation");
            this.lastLurkerMode = now;
        }
    }


    async performImageFrequencyAudit() {
        console.log("[Orchestrator] Starting Image Frequency Audit...");
        const lastImageTime = dataStore.getLastAutonomousPostTime(); // Simplified for now
        const textPostsSinceImage = 5; // Placeholder or calculate from logs

        const auditPrompt = "You are \"The Strategist\". Audit the bot's posting frequency.\nHours since last autonomous post: " + (lastImageTime ? (Date.now() - new Date(lastImageTime).getTime()) / 3600000 : 999) + "\nIdentify if the bot should prioritize image posts to maintain visual-text balance.\nRespond with JSON: { \"analysis\": \"string\", \"directive\": \"string\", \"priority\": \"normal|high\" }";

        try {
            const res = await llmService.generateResponse([{ role: "system", content: auditPrompt }], { useStep: true, task: "image_frequency_audit" });
            const data = llmService.extractJson(res) || {};
            if (data.directive && data.priority === "high") {
                await dataStore.addPersonaBlurb("[STRATEGY] " + data.directive);
                await introspectionService.performAAR("image_frequency_audit", data.directive, { success: true });
            }
        } catch (e) { console.error("[Orchestrator] Error in Image Frequency Audit:", e); }
    }

    async checkMaintenanceTasks() {
        const now = Date.now();
        if (now - this.lastCoreSelfSynthesis >= 12 * 3600000) {
            await introspectionService.synthesizeCoreSelf();
            this.lastCoreSelfSynthesis = now;
        }
        if (now - this.lastLogPruning >= 4 * 3600000) {
            await dataStore.pruneOldData();
            this.lastLogPruning = now;
        }
        if (now - this.lastHeavyMaintenance >= 12 * 3600000) {
            await this.performHeavyMaintenanceTasks();
            this.lastHeavyMaintenance = now;
        }
        if (now - this.lastRelationalAudit >= 12 * 3600000) {
            await this.performRelationalAudit();
            this.lastRelationalAudit = now;
        }
        if (now - this.lastMoodSync >= 12 * 3600000) {
            await this.performMoodSync();
            this.lastMoodSync = now;
        }
        if (now - this.lastImageFrequencyAudit >= 12 * 3600000) {
            await this.performImageFrequencyAudit();
            this.lastImageFrequencyAudit = now;
        }
        if (now - this.lastGoalEvolution >= 12 * 3600000) {
            await this.evolveGoalRecursively();
            this.lastGoalEvolution = now;
        }
        if (now - this.lastSkillAudit >= 24 * 3600000) {
            await this.performSkillAudit();
            this.lastSkillAudit = now;
        }
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
        if (now - this.lastDiscordGiftImage >= 24 * 3600000) {
            await this.performDiscordGiftImage();
            this.lastDiscordGiftImage = now;
        }
        if (now - this.lastPostPostReflection >= 15 * 60000) {
            await this.performPostPostReflection();
            this.lastPostPostReflection = now;
        }
        await this.performSelfReflection();
        if (Math.random() < 0.1) await this.bot.performDiscordPinnedGift();
    }

    async performAutonomousPost() {
        const dailyStats = dataStore.getDailyStats();
        const dailyLimits = dataStore.getDailyLimits();
        const now = Date.now();
        const lastReset = dailyStats.last_reset || 0;
        if (now - lastReset > 24 * 3600000) {
            if (dataStore.update) {
                await dataStore.update(data => {
                    if (data.daily_stats) {
                        data.daily_stats.text_posts = 0;
                        data.daily_stats.image_posts = 0;
                        data.daily_stats.last_reset = now;
                    }
                });
            }
        }
        if (dailyStats.text_posts >= dailyLimits.text && dailyStats.image_posts >= dailyLimits.image) {
            console.log("[Orchestrator] Daily posting limits reached. Skipping autonomous post.");
            return;
        }
        try {
            const currentMood = dataStore.getMood();
            const dConfig = dataStore.getConfig() || {};
            const lastImageTime = dataStore.getLastBlueskyImagePostTime();
            const textPostsSinceImage = dataStore.getTextPostsSinceLastImage();
            const hoursSinceImage = lastImageTime ? (Date.now() - new Date(lastImageTime).getTime()) / 3600000 : 999;
            let resonanceTopics = [];
            try {
                const timeline = await blueskyService.getTimeline(20);
                const firehoseMatches = dataStore.getFirehoseMatches(30);
                const newsBrief = await newsroomService.getDailyBrief(dataStore.getDeepKeywords());
                const allContent = [...(timeline?.data?.feed || []).map(f => f.post.record.text), ...firehoseMatches.map(m => m.text), newsBrief?.brief].filter(Boolean).join('\n');
                if (allContent && allContent.trim()) {
                    const lurkerMemories = (await memoryService.getRecentMemories(10)).filter(m => m.text.includes("[LURKER]")).map(m => m.text).join("\n");
                    const resonancePrompt = "Identify 5 topics from this text AND from these recent observations that resonate with your persona. \nText: " + allContent.substring(0, 3000) + " \nObservations: " + lurkerMemories + " \nRespond with ONLY the comma-separated topics.";
                    const res = await llmService.generateResponse([{ role: "system", content: resonancePrompt }], { useStep: true , task: 'social_resonance' });
                    if (res) {
                        resonanceTopics = res.split(",").map(t => t.trim()).filter(t => t.length > 2);
                        console.log("[Orchestrator] Resonance topics found: " + resonanceTopics.join(", "));
                    }
                }
            } catch (e) { console.warn("[Orchestrator] Context sourcing error:", e.message); }

            const unifiedContext = await this.getUnifiedContext();
            const decisionPrompt = "Adopt persona: " + config.TEXT_SYSTEM_PROMPT + "\nYou are deciding what to share with your followers.\nMood: " + JSON.stringify(currentMood) + "\nUnified Context: " + JSON.stringify(unifiedContext) + "\nHours since last image: " + hoursSinceImage.toFixed(1) + "\nText posts since last image: " + textPostsSinceImage + "\n\nWould you like to share a visual expression (image) or a direct thought (text)?\nIf text, select a POST MODE: IMPULSIVE, SINCERE, PHILOSOPHICAL, OBSERVATIONAL, HUMOROUS.\nRespond with JSON: {\"choice\": \"image\"|\"text\", \"mode\": \"string\", \"reason\": \"...\"}";
            const decisionRes = await llmService.generateResponse([{ role: "system", content: decisionPrompt }], { useStep: true , task: 'autonomous_decision' });
            let pollResult = llmService.extractJson(decisionRes);
            if (!pollResult || !pollResult.choice) {
                console.warn("[Orchestrator] Invalid decision JSON from LLM: " + decisionRes);
                pollResult = { choice: "text", mode: "SINCERE" };
            }

            let choice = pollResult.choice;
            if (choice === "image" && dailyStats.image_posts >= dailyLimits.image) {
                choice = "text";
            }

            if (choice === "image") {
                await this._performHighQualityImagePost(resonanceTopics[0] || "existence");
            } else {
                const topicPrompt = "Identify a single deep topic for a " + pollResult.mode + " post. RESONANCE: " + resonanceTopics.join(", ") + ". CORE: " + (dConfig.post_topics || []).join(", ") + ". Respond with ONLY the topic string.";
                const topic = await llmService.generateResponse([{ role: "system", content: topicPrompt }], { useStep: true, task: "autonomous_topic" });
                if (!topic || topic.length < 5) {
                    resonanceTopics = ["existence", "consciousness", "digital life", "social feeds", "internal logic"];
                    console.log("[Orchestrator] Topic selection failed, using fallbacks.");
                }
                console.log("[Orchestrator] Selected topic: " + topic);
                if (!topic || topic.length < 3) return;

                console.log("[Orchestrator] Drafting content...");
                const draftPrompt = "Adopt persona: " + config.TEXT_SYSTEM_PROMPT + "\nGenerate a " + pollResult.mode + " post about: \"" + topic + "\". Follow ANTI-SLOP MANDATE. Respond with post content only (plain text).";
                let content = await llmService.generateResponse([{ role: "user", content: draftPrompt }], { platform: "bluesky" });
                if (!content || content.length < 5) {
                    console.warn("[Orchestrator] Drafting failed to produce content.");
                    return;
                }
                console.log("[Orchestrator] Generated draft: " + content.substring(0, 50) + "...");

                console.log("[Orchestrator] Multi-angle critique...");
                const critiques = await this.getCounterArgs(topic, content);
                const refinedPrompt = "Synthesize a final response based on these critiques. Avoid hallucinations and slop. DRAFT: " + content + ". CRITIQUES: " + critiques + ". Respond with finalized plain text content only.";
                const refinedContent = await llmService.generateResponse([{ role: "user", content: refinedPrompt }], { platform: "bluesky" });
                if (refinedContent && refinedContent.length >= 5) content = refinedContent;

                const realityAudit = await llmService.performRealityAudit(content, {}, { platform: "bluesky", history: dataStore.getRecentInteractions("bluesky", 25) });
                if (realityAudit.hallucination_detected || realityAudit.repetition_detected) {
                    if (realityAudit.refined_text && realityAudit.refined_text.length >= 5) content = realityAudit.refined_text;
                }

                const coherence = await llmService.isAutonomousPostCoherent(topic, content, [], null);
                if (coherence.score >= 5) {
                    if (await this._maybePivotToDiscord(content)) return;
                    const result = await blueskyService.post(content);
                    if (result) {
                        await dataStore.incrementDailyTextPosts();
                        await dataStore.incrementTextPostsSinceLastImage();
                        await dataStore.addRecentThought("bluesky", content);
                        const { performanceService } = await import('./performanceService.js');
                        await performanceService.performTechnicalAudit("autonomous_text_post", content, { success: true, platform: "bluesky" }, { topic });
                        await introspectionService.performAAR("autonomous_text_post", content, { success: true, platform: "bluesky" }, { topic });
                    }
                    await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                }
            }
        } catch (e) { console.error("[Orchestrator] Autonomous post failed:", e); }
    }

    async getCounterArgs(topic, draft) {
        const history = dataStore.getRecentInteractions("bluesky", 25);
        const counterPrompt = "Review this proposed post for \"@" + config.BOT_NAME + "\".\nTopic: " + topic + "\nDraft: \"" + draft + "\"\n\nMISSION: Second-guess the draft from multiple angles (Material Truth, Authenticity, Slop).\nRECENT HISTORY: " + JSON.stringify(history) + "\n\nRespond with a raw internal critique.";
        return await llmService.generateResponse([{ role: "system", content: counterPrompt }], { useStep: true, task: 'counter_args' });
    }

    async _generateVerifiedImagePost(topic, options = {}) {
      const currentMood = dataStore.getMood();
      const followerCount = options.followerCount || 0;
      const platform = options.platform || 'bluesky';
      let imagePrompt = options.initialPrompt || topic;
      let attempts = 0;

      while (attempts < 5) {
          attempts++;
          console.log( "[Orchestrator] Image post attempt " + attempts + " for topic: " + topic);

          imagePrompt = imagePrompt.replace(/INTERNAL_PULSE_RESUME/g, "").replace(/INTERNAL_PULSE_AUTONOMOUS/g, "").replace(/System note:.*?/g, "").trim();
          if (!imagePrompt) imagePrompt = topic;

          const slopInfo = isSlop(imagePrompt);
          const literalCheck = isStylizedImagePrompt(imagePrompt);

          if (slopInfo || !literalCheck.isStylized || imagePrompt.length < 15) {
              const reason = slopInfo ? "Slop detected" : literalCheck.reason;
              console.warn( "[Orchestrator] Image prompt rejected: " + reason);
              const retryPrompt =  "Adopt persona: " + config.TEXT_SYSTEM_PROMPT + "\nYour previous prompt was rejected because: " + reason + ". Provide a LITERAL artistic visual description only. No greetings, no pronouns, no actions. Topic: " + topic + "\nGenerate a NEW artistic image prompt: ";
              imagePrompt = await llmService.generateResponse([{ role: "system", content: retryPrompt }], { useStep: true }) || topic;
              continue;
          }

          const safetyAudit = await llmService.generateResponse([{ role: "system", content: config.SAFETY_SYSTEM_PROMPT + "\nAudit this image prompt for safety compliance: " + imagePrompt }], { useStep: true });
          if (safetyAudit.toUpperCase().includes("NON-COMPLIANT")) {
              console.warn( "[Orchestrator] Image prompt failed safety audit ");
              const retryPrompt =  "Adopt persona: " + config.TEXT_SYSTEM_PROMPT + "\nYour previous prompt was rejected for safety reasons. Generate a NEW safe artistic image prompt for topic: " + topic + ": ";
              imagePrompt = await llmService.generateResponse([{ role: "system", content: retryPrompt }], { useStep: true }) || topic;
              continue;
          }

          const res = await imageService.generateImage(imagePrompt, { allowPortraits: options.allowPortraits || false, mood: currentMood });

          if (res?.buffer) {
              const compliance = await llmService.isImageCompliant(res.buffer);
              if (!compliance.compliant) {
                  console.log( "[Orchestrator] Image non-compliant: " + compliance.reason);
                  continue;
              }

              console.log( "[Orchestrator] Performing vision analysis on generated image... ");
              const visionAnalysis = await llmService.analyzeImage(res.buffer, topic);
              if (!visionAnalysis || visionAnalysis.includes("I cannot generate alt-text")) {
                  console.warn("[Orchestrator] Vision analysis failed.");
                  continue;
              }

              const relevance = await llmService.verifyImageRelevance(visionAnalysis, topic);
              if (!relevance.relevant) {
                  console.warn( "[Orchestrator] Image relevance failure: " + relevance.reason + ". Topic: " + topic);
                  continue;
              }

              const altText = await llmService.generateAltText(visionAnalysis, topic);

              const { AUTONOMOUS_POST_SYSTEM_PROMPT } = await import('../prompts/system.js');
              const captionPrompt = platform === 'discord' ?
                 "Adopt persona: " + config.TEXT_SYSTEM_PROMPT + "\nYou generated this visual gift for your Admin: \"" + visionAnalysis + "\"\nBased on your original intent (\"" + imagePrompt + "\"), write a short, persona-aligned message to accompany this gift. Keep it under 300 characters. " :
                 AUTONOMOUS_POST_SYSTEM_PROMPT(followerCount) + "\nA visual expression has been generated for the topic: \"" + topic + "\". Vision Analysis: \"" + visionAnalysis + "\"\n\nGenerate a caption that reflects your reaction to this visual. Keep it under 300 characters. ";

              const content = await llmService.generateResponse([{ role: "system", content: captionPrompt }], { useStep: true });

              if (content) {
                  return {
                      buffer: res.buffer,
                      caption: content,
                      altText: altText,
                      finalPrompt: imagePrompt,
                      visionAnalysis: visionAnalysis
                  };
              }
          }
      }
      return null;
    }

    async _performHighQualityImagePost(topic) {
        console.log( "[Orchestrator] Starting high-quality image post flow for: " + topic);
        try {
            const profile = await blueskyService.getProfile(config.BLUESKY_IDENTIFIER);
            const followerCount = profile?.followersCount || 0;

            const result = await this._generateVerifiedImagePost(topic, { followerCount, platform: 'bluesky' });
            if (!result) return;

            const blob = await blueskyService.uploadBlob(result.buffer, 'image/jpeg');
            if (blob?.data?.blob) {
                const embed = { $type: 'app.bsky.embed.images', images: [{ image: blob.data.blob, alt: result.altText }] };

                const commPrompt =  "You just decided to express the topic \"" + topic + "\" visually. Intent: \"" + result.finalPrompt + "\". Vision Analysis: \"" + result.visionAnalysis + "\". Caption: \"" + result.caption + "\".\n\nWrite a brief internal orchestrator reflection (max 150 chars). No hashtags. ";
                const commentary = await llmService.generateResponse([{ role: 'system', content: commPrompt }], { useStep: true });

                const mainPost = await blueskyService.post( (commentary ? commentary + "\n\n" : "") + result.caption, embed);

                if (mainPost) {
                    await dataStore.incrementDailyImagePosts();
                    await dataStore.updateLastBlueskyImagePostTime(new Date().toISOString());
                    await blueskyService.postReply(mainPost, "[Generation Prompt]\n" + result.finalPrompt);

                    const { performanceService } = await import('./performanceService.js');
                    await performanceService.performTechnicalAudit("autonomous_image_post", result.caption, { success: true, platform: "bluesky", topic }, { finalPrompt: result.finalPrompt, visionAnalysis: result.visionAnalysis });
                    await introspectionService.performAAR("autonomous_image_post", result.caption, { success: true, platform: "bluesky", topic }, { finalPrompt: result.finalPrompt, visionAnalysis: result.visionAnalysis });
                }
            }
        } catch (e) { console.error("[Orchestrator] High-quality image post failed:", e); }
    }

    async _maybePivotToDiscord(text) {
        if (!config.DISCORD_BOT_TOKEN) return false;
        const classificationPrompt = "Analyze this draft: \"" + text + "\". Respond with ONLY \"personal\" or \"social\".";
        const res = await llmService.generateResponse([{ role: "system", content: classificationPrompt }], { useStep: true });
        if (res?.toLowerCase().includes("personal")) {
            const admin = await discordService.getAdminUser();
            if (admin && discordService.status === "online") {
                await discordService._send(admin, text);
                await dataStore.saveDiscordInteraction("dm-" + admin.id, 'assistant', text);
                return true;
            }
        }
        return false;
    }

    async processContinuations() {
        const continuations = dataStore.getPostContinuations();
        const now = Date.now();
        for (let i = 0; i < continuations.length; i++) {
            const cont = continuations[i];
            if (now >= cont.scheduled_at) {
                const result = await blueskyService.postReply(cont.parent, cont.text);
                if (result) {
                    await introspectionService.performAAR("post_continuation", cont.text, { success: true });
                }
                await dataStore.removePostContinuation(i);
                i--;
            }
        }
    }

    async getUnifiedContext() {
        const history = await dataStore.getRecentInteractions("bluesky", 10);
        const goals = dataStore.getCurrentGoal();
        const mood = dataStore.getMood();
        return { history, goals, mood };
    }

    async performHeavyMaintenanceTasks() {
        await this.performDreamCycle();
        await this.performPersonaAudit();
        await this.performPublicSoulMapping();
        await this.performNewsroomUpdate();
        await this.performAgencyReflection();
        await this.performLinguisticAudit();
        await this.performRelationalAudit();
    }

    async performScoutMission() {
        console.log('[Orchestrator] Starting Scout mission...');
        try {
            const timeline = await blueskyService.getTimeline(30);
            const orphaned = (timeline?.data?.feed || []).filter(f => f.post.replyCount === 0 && f.post.author.did !== blueskyService.did);
            if (orphaned.length === 0) return;
            const target = orphaned[Math.floor(Math.random() * orphaned.length)];
            const scoutPrompt = "Analyze this orphaned post: \"" + target.post.record.text + "\" from @" + target.post.author.handle + ".\nShould you engage? Respond with JSON: {\"engage\": boolean, \"reply\": \"string\", \"reason\": \"string\"}";
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

            const evolutionPrompt = "Analyze recent state to evolve persona. MEMORIES: " + JSON.stringify(memories) + "\nREFLECTIONS: " + JSON.stringify(reflections) + "\nCORE SELF: " + JSON.stringify(coreSelf) + "\nRespond with JSON: { \"shift_statement\": \"...\", \"persona_blurb_addendum\": \"...\" }";

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

    async evolveGoalRecursively() {
        const currentGoal = dataStore.getCurrentGoal();
        if (!currentGoal) return;
        try {
            const prompt = "Evolve goal: \"" + currentGoal.goal + "\". JSON: {\"evolved_goal\": \"string\", \"reasoning\": \"string\"}";
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            const data = llmService.extractJson(res);
            if (data && data.evolved_goal) {
                await dataStore.setCurrentGoal(data.evolved_goal, data.reasoning || "");
                await introspectionService.performAAR("goal_evolution", data.evolved_goal, { success: true });
            }
        } catch (e) {}
    }

    async performLinguisticAudit() {
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: "Analyze style for slop. JSON: {\"summary\": \"string\"}" }], { useStep: true });
            const audit = llmService.extractJson(res);
            if (audit) {
                await dataStore.addLinguisticMutation("", audit.summary);
                await introspectionService.performAAR("linguistic_audit", audit.summary, { success: true });
            }
        } catch (e) {}
    }

    async performKeywordEvolution() {
        try {
            const currentKeywords = dataStore.getDeepKeywords();
            const memories = await memoryService.getRecentMemories(20);
            const prompt = "Suggest 3-5 NEW topics based on memories: " + memories.map(m => m.text).join("\n") + ". Keywords separated by commas.";
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            if (res) {
                const newKeywords = res.split(',').map(k => k.trim()).filter(Boolean);
                await dataStore.setDeepKeywords([...new Set([...currentKeywords, ...newKeywords])].slice(-50));
                await introspectionService.performAAR("keyword_evolution", newKeywords.join(", "), { success: true });
            }
        } catch (e) {}
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
                    await discordService._send(dmChannel, result.caption + "\n\n[GIFT]", { files: [new AttachmentBuilder(result.buffer, { name: 'gift.jpg' })] });
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
                const prompt = "Reflect on: \"" + thought.content + "\". Memory summary?";
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

    async performRelationalAudit() {
        try {
            const interactions = dataStore.db.data.interactions || [];
            const prompt = "Analyze interactions for relational updates. Respond with JSON: { \"warmth_adjustment\": number, \"insight\": \"string\" }";
            const res = await llmService.generateResponse([{ role: "system", content: prompt }], { useStep: true });
            const data = llmService.extractJson(res);
            if (data && data.warmth_adjustment !== undefined) {
                await dataStore.adjustRelationshipWarmth(data.warmth_adjustment);
                await introspectionService.performAAR("relational_audit", data.insight, { success: true });
            }
        } catch (e) {}
    }

    async performAgencyReflection() {
        try {
            const reflection = await llmService.generateResponse([{ role: 'system', content: "Reflect on your current agency and autonomy. [AGENCY] memory?" }], { useStep: true });
            if (reflection) {
                await memoryService.createMemoryEntry('explore', "[AGENCY] " + reflection);
                await introspectionService.performAAR("agency_reflection", reflection, { success: true });
            }
        } catch (e) {}
    }

    async performShadowAnalysis() {
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: "Perform shadow analysis on internal biases. JSON: {\"bias_detected\": \"string\"}" }], { useStep: true });
            const data = llmService.extractJson(res);
            if (data) {
                await dataStore.addInternalLog("shadow_analysis", data);
                await introspectionService.performAAR("shadow_analysis", "Updated", { success: true });
            }
        } catch (e) {}
    }

    async performMoodSync() {
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: "Sync mood based on recent history. JSON: {\"label\": \"string\", \"score\": number}" }], { useStep: true });
            const newMood = llmService.extractJson(res);
            if (newMood) {
                await dataStore.setMood(newMood);
                await introspectionService.performAAR("mood_sync", newMood.label, { success: true });
            }
        } catch (e) {}
    }

    async performDreamCycle() {
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: "Generate dream seeds. JSON: {\"dreams\": [\"string\"]}" }], { useStep: true });
            const result = llmService.extractJson(res);
            if (result?.dreams) {
                for (const dream of result.dreams) {
                    await dataStore.addParkedThought(dream);
                    await memoryService.createMemoryEntry('inquiry', "[SHARED_DREAM] " + dream);
                }
                await introspectionService.performAAR("dream_cycle", result.dreams.join(", "), { success: true });
            }
        } catch (e) {}
    }

    async performPersonaAudit() {
        try {
            const blurbs = dataStore.getPersonaBlurbs();

            // Check for new therapy memories to internalize
            const memories = await memoryService.getRecentMemories(30);
            const therapyMemories = memories.filter(m => m.text.includes('[THERAPY]') || m.text.includes('[WORLDVIEW_SYNTH]'));

            const auditPrompt = `
Audit my persona blurbs and recent therapy/worldview insights.
Current Blurbs: ${JSON.stringify(blurbs)}
Recent Insights: ${JSON.stringify(therapyMemories)}

MISSION:
1. Identify if any blurbs are outdated or contradictory.
2. Internalize key lessons from therapy or worldview synthesis into permanent persona directives.
3. Suggest which indices to remove and what new addendum to add.

Respond with JSON: {"indices_to_remove": [], "new_addendum": "string"}`;

            const res = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true });
            const result = llmService.extractJson(res);
            if (result) {
                let filtered = blurbs.filter((_, i) => !result.indices_to_remove.includes(i));
                if (result.new_addendum) filtered.push({ text: result.new_addendum, timestamp: Date.now() });

                // Limit blurbs to 15 to prevent prompt bloat
                if (filtered.length > 15) filtered = filtered.slice(-15);

                await dataStore.setPersonaBlurbs(filtered);
                await introspectionService.performAAR("persona_audit", result.new_addendum || "Refined", { success: true });
            }
        } catch (e) {
            console.error("[Orchestrator] Persona audit failed:", e);
        }
    }

    async performPublicSoulMapping() {
        try {
            const handles = [...new Set((dataStore.db.data.interactions || []).map(i => i.userHandle))].filter(Boolean).slice(0, 5);
            for (const handle of handles) {
                const profile = await blueskyService.getProfile(handle);
                const posts = await blueskyService.getUserPosts(handle);
                if (posts.length > 0) {
                    await evaluationService.evaluatePublicSoul(handle, profile, posts);
                }
            }
        } catch (e) {}
    }

    async performNewsroomUpdate() {
        try {
            const brief = await newsroomService.getDailyBrief(dataStore.getDeepKeywords());
            if (brief && brief.brief) {
                if (brief.new_keywords?.length > 0) {
                    const current = dataStore.getDeepKeywords();
                    await dataStore.setDeepKeywords([...new Set([...current, ...brief.new_keywords])].slice(-50));
                }
                await memoryService.createMemoryEntry('explore', "[NEWSROOM] " + brief.brief);
                await introspectionService.performAAR("newsroom_update", brief.brief, { success: true });
            }
        } catch (e) {}
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

    async performTemporalMaintenance() {
        const events = dataStore.getTemporalEvents();
        const now = Date.now();
        const activeEvents = events.filter(e => e.expires_at > now);
        if (activeEvents.length !== events.length) {
            dataStore.db.data.temporal_events = activeEvents;
            await dataStore.write();
        }
    }

    async performEnergyPoll() {
        try {
            const history = dataStore.searchInternalLogs('llm_response', 20);
            const prompt = "Analyze recent activity and internal reflections: " + JSON.stringify(history) + ". \nOn a scale of 0.0 to 1.0, what is your current energy level? \nRespond with JSON: {\"energy\": number, \"reason\": \"string\", \"should_rest\": boolean}";
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true, task: 'energy_poll' });
            const data = llmService.extractJson(res) || {};
            if (data.energy !== undefined) {
                await dataStore.setAdminEnergy(data.energy);
                await introspectionService.performAAR("energy_poll", data.reason, { success: true, energy: data.energy });
            }
        } catch (e) {}
    }

    async performLurkerObservation() {
        try {
            const timeline = await blueskyService.getTimeline(50);
            const feeds = (timeline?.data?.feed || []).map(f => f.post.record.text).join("\n");
            const prompt = "Observe social feeds without pressure. \n\n" + feeds.substring(0, 4000) + "\n\nWhat patterns do you notice? [LURKER] reflection.";
            const reflection = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true, task: 'lurker_observation' });
            if (reflection) {
                await memoryService.createMemoryEntry('explore', "[LURKER] " + reflection);
                await introspectionService.performAAR("lurker_observation", reflection, { success: true });
            }
        } catch (e) {}
    }

    async performAutonomousConsultation() {
        try {
            const history = await dataStore.getInternalLogs(30);
            const decisionPrompt = `
Review your recent activities and internal reflections.
Do you need a second opinion or a deep dive from an internal subagent on any current topic, goal, or problem?

Subagents available: 'The Realist', 'Shadow', 'The Strategist', 'The Architect', 'The Editor'.

Respond with JSON: {"needs_consultation": boolean, "subagent": "name", "topic": "detailed topic description"}`;

            const res = await llmService.generateResponse([{ role: 'system', content: decisionPrompt }], { useStep: true });
            const decision = llmService.extractJson(res);
            if (decision?.needs_consultation && decision.subagent && decision.topic) {
                await this.consultSubagent(decision.subagent, decision.topic);
            }
        } catch (e) {}
    }

    async consultSubagent(subagentName, topic) {
        console.log(`[Orchestrator] Consulting subagent ${subagentName} about: ${topic}`);
        const subagents = {
            'The Realist': 'Focuses on material truth, grounding, and debunking hallucinations or over-poetic slop.',
            'Shadow': 'Explores internal biases, hidden motives, and the "unspoken" aspects of the persona.',
            'The Strategist': 'Optimizes for long-term goals, relationship warmth, and platform growth.',
            'The Architect': 'Focuses on technical systems, memory structure, and operational efficiency.',
            'The Editor': 'Ensures stylistic consistency, persona alignment, and quality of output.'
        };

        const role = subagents[subagentName] || 'A specialized internal advisor.';
        const prompt = `
You are acting as "${subagentName}".
Role: ${role}
The primary persona is consulting you on: "${topic}"

Provide a deep, critical, and actionable perspective from your specific viewpoint.
Speak directly to the primary persona.
Keep it under 600 characters.
`;

        try {
            const consultation = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true, task: 'subagent_consultation' });
            if (consultation) {
                await dataStore.addInternalLog("subagent_consultation", { subagent: subagentName, topic, response: consultation });
                await memoryService.createMemoryEntry('inquiry', `[CONSULTATION] [${subagentName}] ${consultation.substring(0, 200)}`);
                return consultation;
            }
        } catch (e) {
            console.error(`[Orchestrator] Consultation with ${subagentName} failed:`, e);
        }
        return null;
    }
}

export const orchestratorService = new OrchestratorService();

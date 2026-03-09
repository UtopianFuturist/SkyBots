import { dataStore } from './services/dataStore.js';
import { memoryService } from './services/memoryService.js';
import { blueskyService } from './services/blueskyService.js';
import { discordService } from './services/discordService.js';
import { llmService } from './services/llmService.js';
import { openClawService } from './services/openClawService.js';
import { imageService } from './services/imageService.js';
import { cronService } from './services/cronService.js';
import { nodeGatewayService } from './services/nodeGatewayService.js';
import toolService from './services/toolService.js';
import { renderService } from './services/renderService.js';
import { handleCommand } from './utils/commandHandler.js';
import { postYouTubeReply } from './utils/replyUtils.js';
import { sanitizeDuplicateText, sanitizeThinkingTags, sanitizeCharacterCount, isGreeting, checkSimilarity, isSlop, getSlopInfo, reconstructTextWithFullUrls, hasPrefixOverlap, checkExactRepetition, KEYWORD_BLACKLIST, cleanKeywords, checkHardCodedBoundaries } from './utils/textUtils.js';
import config from '../config.js';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';

export class Bot {
  constructor() {
    this.skillsContent = '';
    this.readmeContent = '';
    this.paused = false;
    this.firehoseProcess = null;
    this.lastActivityTime = Date.now();
    this.firehoseMatchCounts = {};
    this.lastFirehoseLogTime = Date.now();
    this.autonomousPostCount = 0;
  }

  async init() {
    console.log('[Bot] [v3] Initializing services...');
    try {
        await dataStore.init();
        llmService.setDataStore(dataStore);
        await openClawService.init();
        await toolService.init();

        discordService.setBotInstance(this);
        discordService.init().then(() => {
            cronService.init();
            nodeGatewayService.init();
        }).catch(err => console.error('[Bot] DiscordService init failed:', err));

        await blueskyService.authenticate();
        await blueskyService.submitAutonomyDeclaration();

        if (config.ADMIN_BLUESKY_HANDLE) {
            try {
                const profile = await blueskyService.getProfile(config.ADMIN_BLUESKY_HANDLE);
                if (profile?.did) {
                    await dataStore.setAdminDid(profile.did);
                    llmService.setIdentities(profile.did, blueskyService.did);
                }
            } catch (e) {}
        }

        await blueskyService.registerComindAgent({ capabilities: ['planner-executor', 'discord-bridge', 'autonomous-posting'] });

        if (memoryService.isEnabled()) {
          const memories = await memoryService.getRecentMemories();
          llmService.setMemoryProvider(memoryService);

          for (const mem of (memories || [])) {
              if (mem.text?.includes('[DIRECTIVE]')) {
                  const instructionMatch = mem.text.match(/Instruction: (.*)/i);
                  if (instructionMatch) await dataStore.addBlueskyInstruction(instructionMatch[1].trim());
              }
              if (mem.text?.includes('[PERSONA]')) {
                  const personaMatch = mem.text.match(/New self-instruction: (.*)/i) || mem.text.match(/\[PERSONA\] (.*)/i);
                  if (personaMatch) await dataStore.addPersonaUpdate(personaMatch[1].trim());
              }
              if (mem.text?.includes('[GOAL]')) {
                  const goalMatch = mem.text.match(/\[GOAL\]\s*Goal:\s*(.*?)(?:\s*\||$)/i);
                  const descMatch = mem.text.match(/Description:\s*(.*?)(?:\s*\||$|#)/i);
                  if (goalMatch) {
                      await dataStore.setCurrentGoal(goalMatch[1].trim(), descMatch ? descMatch[1].trim() : goalMatch[1].trim());
                  }
              }
          }
          await memoryService.secureAllThreads();
        }

        try {
          this.readmeContent = await fs.readFile('README.md', 'utf-8').catch(() => "");
          this.skillsContent = await fs.readFile('skills.md', 'utf-8').catch(() => "");
          llmService.setSkillsContent(this.skillsContent);
        } catch (error) {}
    } catch (e) {
        await this._handleError(e, 'Bot.init');
    }
  }

  startFirehose() {
    console.log('[Bot] Starting Firehose monitor...');
    try {
        const firehosePath = path.resolve(process.cwd(), 'firehose_monitor.py');
        const dConfig = dataStore.getConfig() || {};
        const postTopics = dConfig.post_topics || [];
        const imageSubjects = dConfig.image_subjects || [];
        const allKeywords = cleanKeywords([...postTopics, ...imageSubjects]);
        const keywordsArg = allKeywords.length > 0 ? `--keywords "${allKeywords.join('|')}"` : '';
        const negativesArg = `--negatives "${(config.FIREHOSE_NEGATIVE_KEYWORDS || []).join('|')}"`;
        const adminDid = dataStore.getAdminDid();
        const actorsArg = adminDid ? `--actors "${adminDid}"` : '';

        const command = `python3 -m pip install --break-system-packages atproto python-dotenv && python3 ${firehosePath} ${keywordsArg} ${negativesArg} ${actorsArg}`;
        this.firehoseProcess = spawn(command, { shell: true });

        this.firehoseProcess.stdout.on('data', async (data) => {
          const lines = data.toString().split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);
              if (event.type === 'firehose_mention') {
                if (dataStore.hasReplied(event.uri)) continue;
                if (await blueskyService.hasBotRepliedTo(event.uri)) {
                    await dataStore.addRepliedPost(event.uri);
                    continue;
                }
                const profile = await blueskyService.getProfile(event.author?.did);
                if (!profile) continue;
                const notif = { uri: event.uri, cid: event.cid, author: profile, record: event.record, reason: event.reason, indexedAt: new Date().toISOString() };
                await this.processNotification(notif);
                await dataStore.addRepliedPost(notif.uri);
              }
              if (event.type === 'firehose_topic_match') {
                  const keywords = event.matched_keywords || [];
                  for (const kw of keywords) {
                      const cleanKw = kw.toLowerCase();
                      this.firehoseMatchCounts[cleanKw] = (this.firehoseMatchCounts[cleanKw] || 0) + 1;
                  }
                  await dataStore.addFirehoseMatch(event);
                  const totalMatches = Object.values(this.firehoseMatchCounts).reduce((a, b) => a + b, 0);
                  if (Date.now() - this.lastFirehoseLogTime > 120000 || totalMatches >= 50) this._flushFirehoseLogs();
              }
            } catch (e) {}
          }
        });

        this.firehoseProcess.on('close', () => setTimeout(() => this.startFirehose(), 10000));
    } catch (e) {
        console.error('[Bot] Error starting Firehose:', e);
        setTimeout(() => this.startFirehose(), 10000);
    }
  }

  _flushFirehoseLogs() {
    const keywords = Object.keys(this.firehoseMatchCounts);
    if (keywords.length > 0) {
        const summary = keywords.map(kw => `${this.firehoseMatchCounts[kw]} for '${kw}'`).join(', ');
        console.log(`[Bot] Firehose topic matches aggregated: ${summary}`);
        this.firehoseMatchCounts = {};
        this.lastFirehoseLogTime = Date.now();
    }
  }

  async run() {
    this.startFirehose();
    setInterval(() => this.catchUpNotifications(), 300000);
    setInterval(() => this.performAutonomousPost(), 7200000);
    setInterval(() => this.checkDiscordSpontaneity(), 60000);
    setInterval(() => this.refreshFirehoseKeywords(), 21600000);
  }

  async refreshFirehoseKeywords(force = false) {
      console.log('[Bot] Refreshing Firehose keywords...');
      try {
          const dConfig = dataStore.getConfig() || {};
          const currentKeywords = [...(dConfig.post_topics || []), ...(dConfig.image_subjects || [])];
          const newKeywords = await llmService.extractDeepKeywords("current interests and evolution", currentKeywords.join(', '));
          if (newKeywords?.length > 0) {
              await dataStore.setDeepKeywords(newKeywords);
              await this.restartFirehose();
          }
      } catch (e) {}
  }

  async catchUpNotifications() {
    try {
        const response = await blueskyService.getNotifications();
        if (!response?.notifications) return;
        for (const notif of response.notifications) {
          if (!notif.isRead && ['mention', 'reply', 'quote'].includes(notif.reason)) {
            if (dataStore.hasReplied(notif.uri)) continue;
            await this.processNotification(notif);
            await dataStore.addRepliedPost(notif.uri);
            await blueskyService.updateSeen(notif.indexedAt);
          }
        }
    } catch (e) {}
  }

  async processNotification(notif) {
    if (!notif?.author || notif.author.handle === config.BLUESKY_IDENTIFIER) return;
    const boundaryCheck = checkHardCodedBoundaries(notif.record?.text || "");
    if (boundaryCheck.blocked) return;

    try {
        const safety = await llmService.performSafetyAnalysis(notif.record?.text || "", { platform: 'bluesky', user: notif.author.handle });
        if (safety?.violation_detected) {
            const consent = await llmService.requestBoundaryConsent(safety, notif.author.handle, 'bluesky');
            if (!consent?.consent_to_engage) return;
        }

        const threadData = await this._getThreadHistory(notif.uri) || [];
        const isAdmin = notif.author.handle === config.ADMIN_BLUESKY_HANDLE;

        const prePlan = await llmService.performPrePlanning(notif.record?.text, threadData, null, 'bluesky', dataStore.getMood(), dataStore.getRefusalCounts());
        const plan = await llmService.performAgenticPlanning(notif.record?.text, threadData, null, isAdmin, 'bluesky', dataStore.getExhaustedThemes(), dataStore.getConfig(), "", "online", dataStore.getRefusalCounts(), null, prePlan);

        const refined = await llmService.evaluateAndRefinePlan(plan, { platform: 'bluesky' });
        if (refined?.decision === 'refuse') return;

        const actions = refined?.refined_actions || plan?.actions || [];
        for (const action of actions) {
            if (action) await this.executeAction(action, { isAdmin, platform: 'bluesky', notif });
        }

        const response = await llmService.generateResponse([{ role: 'user', content: notif.record?.text }], { platform: 'bluesky' });
        if (response) {
            await blueskyService.postReply(notif, response);
            await dataStore.saveInteraction({ platform: 'bluesky', userHandle: notif.author.handle, text: notif.record?.text, response });
        }
    } catch (error) {
      console.error('[Bot] Error in processNotification:', error);
    }
  }

  async performAutonomousPost() {
    try {
        const dConfig = dataStore.getConfig() || {};
        const postTopics = dConfig.post_topics || [];
        const currentMood = dataStore.getMood();
        const topicPrompt = `Identify a deep topic for an autonomous post. Preferred: ${postTopics.join(', ')}. Respond with ONLY topic.`;
        let topic = (await llmService.generateResponse([{ role: 'system', content: topicPrompt }], { useStep: true }))?.trim() || "existence";

        const postType = Math.random() < 0.3 ? 'image' : 'text';
        if (postType === 'image') {
            let attempts = 0;
            while (attempts < 5) {
                attempts++;
                const res = await imageService.generateImage(topic, { allowPortraits: false, mood: currentMood });
                if (res?.buffer && (await llmService.isImageCompliant(res.buffer))?.compliant) {
                    const content = await llmService.generateResponse([{ role: 'system', content: `Post about: ${topic}` }], { useStep: true });
                    const blob = await blueskyService.uploadBlob(res.buffer, 'image/jpeg');
                    if (blob?.data?.blob) {
                        await blueskyService.post(content, { $type: 'app.bsky.embed.images', images: [{ image: blob.data.blob, alt: topic }] });
                        return;
                    }
                }
            }
        }
        const content = await llmService.generateResponse([{ role: 'system', content: `Deep thought about ${topic}` }], { useStep: true });
        if (content) {
            const res = await blueskyService.post(content);
            if (res) {
                await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                await dataStore.addRecentThought('bluesky', content);
            }
        }
    } catch (e) {
        console.error('[Bot] Error in performAutonomousPost:', e);
    }
  }

  async checkMaintenanceTasks() {
      try {
          const goal = dataStore.getCurrentGoal();
          if (goal?.goal) await llmService.decomposeGoal(goal.goal);
      } catch (e) {}
  }

  async checkDiscordSpontaneity() {
      try {
          if (discordService.status !== 'online') return;
          const admin = await discordService.getAdminUser();
          if (!admin) return;
          const history = dataStore.getDiscordConversation(`dm_${admin.id}`) || [];
          if (history.length === 0) return;
          const poll = await llmService.performFollowUpPoll({ history, currentMood: dataStore.getMood(), lastBotMessage: '' });
          if (poll?.decision === 'follow-up' && poll.message) await discordService.sendSpontaneousMessage(poll.message);
      } catch (e) {}
  }

  async executeAction(action, context) {
      if (!action) return;
      try {
          if (action.tool === 'image_gen' && action.query) {
              const res = await imageService.generateImage(action.query);
              if (res?.buffer) {
                  const blobRes = await blueskyService.uploadBlob(res.buffer, 'image/jpeg');
                  if (blobRes?.data?.blob) {
                      await blueskyService.postReply(context.notif, "Generated Image", { embed: { $type: 'app.bsky.embed.images', images: [{ image: blobRes.data.blob, alt: action.query }] } });
                  }
              }
          }
      } catch (e) {}
  }

  async _getThreadHistory(uri) {
      try {
          const thread = await blueskyService.getDetailedThread(uri);
          if (!thread) return [];
          const history = [];
          let current = thread;
          while (current && current.post) {
              history.unshift({ author: current.post.author?.handle, text: current.post.record?.text });
              current = current.parent;
          }
          return history;
      } catch (e) { return []; }
  }

  async _handleError(error, contextInfo) {
    console.error(`[Bot] CRITICAL ERROR in ${contextInfo}:`, error);
    if (renderService.isEnabled()) {
      try {
        const logs = await renderService.getLogs(50);
        const alertPrompt = `DIAGNOSTIC ALERT: ${contextInfo} failed with error ${error.message}. Logs: ${logs}. Generate short alert.`;
        const alertMsg = await llmService.generateResponse([{ role: 'system', content: alertPrompt }], { useStep: true });
        if (alertMsg) {
          if (discordService.status === 'online') await discordService.sendSpontaneousMessage(alertMsg);
          await blueskyService.post(`@${config.ADMIN_BLUESKY_HANDLE} ${alertMsg}`);
        }
      } catch (logError) {}
    }
  }

  updateActivity() { this.lastActivityTime = Date.now(); }
  async restartFirehose() { if (this.firehoseProcess) this.firehoseProcess.kill(); }
}

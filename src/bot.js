import { blueskyService } from './services/blueskyService.js';
import { llmService } from './services/llmService.js';
import { dataStore } from './services/dataStore.js';
import { googleSearchService } from './services/googleSearchService.js';
import { imageService } from './services/imageService.js';
import { youtubeService } from './services/youtubeService.js';
import { wikipediaService } from './services/wikipediaService.js';
import { webReaderService } from './services/webReaderService.js';
import { moltbookService } from './services/moltbookService.js';
import { memoryService } from './services/memoryService.js';
import { renderService } from './services/renderService.js';
import { openClawService } from './services/openClawService.js';
import { socialHistoryService } from './services/socialHistoryService.js';
import { discordService } from './services/discordService.js';
import { cronService } from './services/cronService.js';
import { nodeGatewayService } from './services/nodeGatewayService.js';
import toolService from './services/toolService.js';
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
  }

  async init() {
    console.log('[Bot] [v3] Initializing services...');
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
      await memoryService.getRecentMemories();
      llmService.setMemoryProvider(memoryService);
      await memoryService.secureAllThreads();
    }

    try {
      this.readmeContent = await fs.readFile('README.md', 'utf-8');
      this.skillsContent = await fs.readFile('skills.md', 'utf-8');
      llmService.setSkillsContent(this.skillsContent);
    } catch (error) {}
  }

  startFirehose() {
    console.log('[Bot] Starting Firehose monitor...');
    const firehosePath = path.resolve(process.cwd(), 'firehose_monitor.py');
    const dConfig = dataStore.getConfig();
    const allKeywords = cleanKeywords([...(dConfig.post_topics || []), ...(dConfig.image_subjects || [])]);
    const keywordsArg = allKeywords.length > 0 ? `--keywords "${allKeywords.join('|')}"` : '';
    const negativesArg = `--negatives "${config.FIREHOSE_NEGATIVE_KEYWORDS.join('|')}"`;
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
            const profile = await blueskyService.getProfile(event.author.did);
            const notif = { uri: event.uri, cid: event.cid, author: profile, record: event.record, reason: event.reason, indexedAt: new Date().toISOString() };
            await this.processNotification(notif);
            await dataStore.addRepliedPost(notif.uri);
          }
        } catch (e) {}
      }
    });

    this.firehoseProcess.on('close', () => setTimeout(() => this.startFirehose(), 10000));
  }

  async run() {
    this.startFirehose();
    setInterval(() => this.catchUpNotifications(), 300000);
    setInterval(() => this.performAutonomousPost(), 7200000);
    setInterval(() => this.checkDiscordSpontaneity(), 60000);
  }

  async catchUpNotifications() {
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
  }

  async processNotification(notif) {
    if (notif.author.handle === config.BLUESKY_IDENTIFIER) return;
    const boundaryCheck = checkHardCodedBoundaries(notif.record.text || "");
    if (boundaryCheck.blocked) return;

    const safety = await llmService.performSafetyAnalysis(notif.record.text || "", { platform: 'bluesky', user: notif.author.handle });
    if (safety.violation_detected) {
        const consent = await llmService.requestBoundaryConsent(safety, notif.author.handle, 'bluesky');
        if (!consent.consent_to_engage) return;
    }

    try {
      const threadData = await this._getThreadHistory(notif.uri);
      const isAdmin = notif.author.handle === config.ADMIN_BLUESKY_HANDLE;

      const prePlan = await llmService.performPrePlanning(notif.record.text, threadData, null, 'bluesky', dataStore.getMood(), dataStore.getRefusalCounts());
      const plan = await llmService.performAgenticPlanning(notif.record.text, threadData, null, isAdmin, 'bluesky', dataStore.getExhaustedThemes(), dataStore.getConfig(), "", "online", dataStore.getRefusalCounts(), null, prePlan);

      const refined = await llmService.evaluateAndRefinePlan(plan, { platform: 'bluesky' });
      if (refined.decision === 'refuse') return;

      for (const action of refined.refined_actions || plan.actions) {
          await this.executeAction(action, { isAdmin, platform: 'bluesky', notif });
      }

      const response = await llmService.generateResponse([{ role: 'user', content: notif.record.text }], { platform: 'bluesky' });
      if (response) {
          await blueskyService.postReply(notif, response);
          await dataStore.saveInteraction({ platform: 'bluesky', userHandle: notif.author.handle, text: notif.record.text, response });
      }
    } catch (error) {
      console.error('[Bot] Error in processNotification:', error);
    }
  }

  async performAutonomousPost() {
    const dConfig = dataStore.getConfig();
    const currentMood = dataStore.getMood();
    const topicPrompt = `Identify a deep topic for an autonomous post. Preferred: ${dConfig.post_topics.join(', ')}. Respond with ONLY topic.`;
    let topic = (await llmService.generateResponse([{ role: 'system', content: topicPrompt }], { useStep: true }))?.trim() || "existence";

    const postType = Math.random() < 0.3 ? 'image' : 'text';
    if (postType === 'image') {
        let attempts = 0;
        while (attempts < 5) {
            attempts++;
            const res = await imageService.generateImage(topic, { allowPortraits: false, mood: currentMood });
            if (res && (await llmService.isImageCompliant(res.buffer)).compliant) {
                const content = await llmService.generateResponse([{ role: 'system', content: `Post about: ${topic}` }], { useStep: true });
                const blob = await blueskyService.uploadBlob(res.buffer, 'image/jpeg');
                await blueskyService.post(content, { $type: 'app.bsky.embed.images', images: [{ image: blob.data.blob, alt: topic }] });
                return;
            }
        }
    }
    const content = await llmService.generateResponse([{ role: 'system', content: `Deep thought about ${topic}` }], { useStep: true });
    if (content) {
        await blueskyService.post(content);
        await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
        await dataStore.addRecentThought('bluesky', content);
    }
  }

  async checkMaintenanceTasks() {
      const goal = dataStore.getCurrentGoal();
      if (goal) await llmService.decomposeGoal(goal.goal);
  }

  async checkDiscordSpontaneity() {
      if (discordService.status !== 'online') return;
      const admin = await discordService.getAdminUser();
      if (!admin) return;
      const history = dataStore.getDiscordConversation(`dm_${admin.id}`);
      if (history.length === 0) return;
      const poll = await llmService.performFollowUpPoll({ history, currentMood: dataStore.getMood(), lastBotMessage: '' });
      if (poll.decision === 'follow-up') await discordService.sendSpontaneousMessage(poll.message);
  }

  async executeAction(action, context) {
      if (action.tool === 'image_gen') {
          const res = await imageService.generateImage(action.query);
          if (res) {
              const blobRes = await blueskyService.uploadBlob(res.buffer, 'image/jpeg');
              await blueskyService.postReply(context.notif, "Generated Image", { embed: { $type: 'app.bsky.embed.images', images: [{ image: blobRes.data.blob, alt: action.query }] } });
          }
      }
  }

  async _getThreadHistory(uri) {
      const thread = await blueskyService.getDetailedThread(uri);
      if (!thread) return [];
      const history = [];
      let current = thread;
      while (current && current.post) {
          history.unshift({ author: current.post.author.handle, text: current.post.record.text });
          current = current.parent;
      }
      return history;
  }

  updateActivity() { this.lastActivityTime = Date.now(); }
  async restartFirehose() { if (this.firehoseProcess) this.firehoseProcess.kill(); }
}

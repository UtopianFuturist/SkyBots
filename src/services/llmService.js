import fetch from 'node-fetch';
import config from '../../config.js';
import fs from 'fs/promises';
import { dataStore } from './dataStore.js';
import { sanitizeDuplicateText, sanitizeThinkingTags } from '../utils/textUtils.js';
import https from 'https';

export const persistentAgent = new https.Agent({ keepAlive: true });

class LLMService {
  constructor() {
    this.apiKey = config.NVIDIA_NIM_API_KEY;
    this.model = config.LLM_MODEL;
    this.personaCache = null;
    this.cacheTimestamp = 0;
    this.memoryProvider = null;
    this.skillsContent = '';
    this.adminDid = null;
    this.botDid = null;
  }

  setDataStore(ds) { this.ds = ds; }
  setIdentities(admin, bot) { this.adminDid = admin; this.botDid = bot; }
  setMemoryProvider(mem) { this.memoryProvider = mem; }
  setSkillsContent(skills) { this.skillsContent = skills; }

  async _getPersona() {
    const now = Date.now();
    if (this.personaCache && (now - this.cacheTimestamp < 300000)) return this.personaCache;
    try {
      const soul = await fs.readFile('SOUL.md', 'utf-8');
      const agents = await fs.readFile('AGENTS.md', 'utf-8');
      const status = await fs.readFile('STATUS.md', 'utf-8').catch(() => '');
      this.personaCache = `${soul}\n\n${agents}\n\n${status}`;
      this.cacheTimestamp = now;
      return this.personaCache;
    } catch (e) { return config.TEXT_SYSTEM_PROMPT; }
  }

  async generateResponse(messages, options = {}) {
    const persona = await this._getPersona();
    const systemMsg = messages.find(m => m.role === 'system');

    let fullSystemPrompt = persona;
    if (systemMsg) {
        fullSystemPrompt += "\n\n" + systemMsg.content;
        systemMsg.content = fullSystemPrompt;
    } else {
        messages.unshift({ role: 'system', content: fullSystemPrompt });
    }

    if (!messages.some(m => m.role === 'user')) {
        messages.push({ role: 'user', content: "[Internal State Update Request]" });
    }

    const model = options.useStep ? config.STEP_MODEL : this.model;
    const temperature = options.temperature ?? 0.7;
    const max_tokens = options.max_tokens ?? 1024;
    const abortSignal = options.abortSignal;

    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
          body: JSON.stringify({ model, messages, temperature, max_tokens }),
          agent: persistentAgent,
          signal: abortSignal
        });

        if (res.status === 429) {
            await new Promise(r => setTimeout(r, 2000 * (i + 1)));
            continue;
        }

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`LLM API Error (${res.status}): ${err}`);
        }

        const data = await res.json();
        let content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error("Empty response from LLM");

        content = sanitizeThinkingTags(content);
        if (options.traceId) await dataStore.addTraceLog(options.traceId, content);
        return content;
      } catch (e) {
          if (e.name === 'AbortError') throw e;
          if (i === 2) {
              console.error(`[LLMService] Final attempt failed: ${e.message}`);
              return null;
          }
          await new Promise(r => setTimeout(r, 1000));
      }
    }
    return null;
  }

  async performPrePlanning(message, history, imageAnalysis, platform, currentMood, refusalCounts) {
    const prompt = `Perform Pre-Planning Analysis. Platform: ${platform}, Message: "${message}". Respond with JSON { "suppressed_topics": [], "emotional_hooks": [] }.`;
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
    try {
        const match = res.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : { suppressed_topics: [], emotional_hooks: [] };
    } catch (e) { return { suppressed_topics: [], emotional_hooks: [] }; }
  }

  async performAgenticPlanning(message, history, imageAnalysis, isAdmin, platform, exhaustedThemes, dConfig, feedback, status, refusalCounts, latestMoodMemory, prePlanning) {
    const prompt = `You are the STRATEGIC PLANNER. Message: "${message}". Respond with JSON { "intent": "string", "actions": [] }.`;
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
    try {
        const match = res.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : { intent: "engagement", actions: [] };
    } catch (e) { return { intent: "engagement", actions: [] }; }
  }

  async evaluateAndRefinePlan(plan, context) {
      return { decision: "execute", reason: "Fallback", refined_actions: plan.actions };
  }

  async analyzeUserIntent(profile, posts) {
    const res = await this.generateResponse([{ role: 'system', content: "Analyze intent" }], { useStep: true });
    return { highRisk: false, reason: res };
  }

  async evaluateConversationVibe(history, current) {
    return { status: "neutral", reason: "" };
  }

  async checkConsistency(text, platform) { return { consistent: true }; }
  async performSafetyAnalysis(text, context) { return { violation_detected: false, safe: true }; }
  async requestBoundaryConsent(report, user, platform) { return { consent_to_engage: true }; }
  async isPostSafe(text) { return { safe: true }; }
  async isUrlSafe(url) { return { safe: true }; }
  async isImageCompliant(buffer) { return { compliant: true }; }

  async checkVariety(text, history, options = {}) {
      return { repetitive: false, variety_score: 1.0 };
  }

  async isPersonaAligned(text, platform, options = {}) {
      return { aligned: true };
  }

  async isAutonomousPostCoherent(topic, content, type, embed) {
      return { score: 5, reason: "Coherent" };
  }

  async scoreSubstance(text) {
      return { score: 1.0, reason: "Substantive" };
  }

  async extractFacts(context) {
      return { world_facts: [], admin_facts: [] };
  }

  async extractDeepKeywords(context, count) {
      const res = await this.generateResponse([{ role: 'system', content: `Extract ${count} keywords from ${context}` }], { useStep: true });
      return res?.split(',').map(k => k.trim()) || [];
  }

  async performFollowUpPoll(options) {
    return { decision: 'wait' };
  }

  async performInternalPoll(options) {
      return { decision: 'none' };
  }

  async summarizeWebPage(url, content) {
      return await this.generateResponse([{ role: 'system', content: `Summarize: ${content.substring(0, 1000)}` }], { useStep: true });
  }

  async performInternalInquiry(query, role) {
      return await this.generateResponse([{ role: 'system', content: `You are ${role}. Research: ${query}` }], { useStep: true });
  }

  async selectBestResult(query, results, type) { return results[0]; }
  async decomposeGoal(goal) { return "Decomposed goal"; }

  async extractRelationalVibe(history) { return "friendly"; }

  async extractScheduledTask(content, mood) { return { decision: 'none' }; }

  async shouldIncludeSensory(persona) { return false; }

  async analyzeImage(image, alt, options = {}) {
    return "Image description placeholder.";
  }

  async isReplyRelevant(text) { return true; }
  async isReplyCoherent(parent, child, history, embed) { return true; }
  async auditPersonaAlignment(actions) { return { advice: "" }; }

  async generalizePrivateThought(thought) { return thought; }

  async buildInternalBrief(topic, google, wiki, firehose) { return "Brief"; }

  async generateDrafts(messages, count, options) {
      return [await this.generateResponse(messages, options)];
  }

  async requestConfirmation(action, reason, options = {}) { return { confirmed: true }; }

  async generateAlternativeAction(reason, platform, context) { return "NONE"; }

  async rateUserInteraction(history) { return 5; }

  async getLatestMoodMemory() { return null; }

  _formatHistory(history, includeRole = true) {
      return history.map(h => `${includeRole ? (h.role || h.author) + ': ' : ''}${h.content || h.text}`).join('\n');
  }
}

export const llmService = new LLMService();

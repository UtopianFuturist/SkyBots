import * as prompts from "../prompts/index.js";
import fetch from 'node-fetch';
import { checkExactRepetition, getSimilarityInfo, hasPrefixOverlap, isSlop } from "../utils/textUtils.js";
import https from 'https';
import config from '../../config.js';
import fs from 'fs/promises';
import path from 'path';
import { temporalService } from "./temporalService.js";

export const persistentAgent = new https.Agent({ keepAlive: true });

class LLMService {
  static lastRequestTime = 0;

  async _throttle(priority = false) {
    const now = Date.now();
    const minDelay = priority ? 2000 : 5000;
    const targetStartTime = Math.max(now, LLMService.lastRequestTime + minDelay);
    LLMService.lastRequestTime = targetStartTime;
    const waitTime = targetStartTime - now;
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  constructor() {
    this.ds = null;
    this.memoryProvider = null;
    this.adminDid = null;
    this.botDid = null;
    this.skillsContent = "";
    this.readmeContent = "";
    this.soulContent = "";
    this.agentsContent = "";
    this.statusContent = "";
    this.cache = new Map();
    this.cacheExpiry = 300000;
    this.model = config.LLM_MODEL || 'stepfun-ai/step-3.5-flash';
    this.qwenModel = config.QWEN_MODEL || 'qwen/qwen3-coder-480b-a35b-instruct';
    this.visionModel = config.VISION_MODEL || 'meta/llama-3.2-11b-vision-instruct';
    this.baseUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';
    this.apiKey = config.NVIDIA_NIM_API_KEY;
    this.endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
  }

  extractJson(str) {
    if (!str) return null;
    try {
      const match = str.match(/\{[\s\S]*\}/);
      if (!match) return JSON.parse(str);
      return JSON.parse(match[0]);
    } catch (e) {
      try {
          const fixed = str.replace(/,\s*([\]}])/g, '$1');
          const match2 = fixed.match(/\{[\s\S]*\}/);
          return JSON.parse(match2 ? match2[0] : fixed);
      } catch (e2) {
          return null;
      }
    }
  }

  _isRefusal(content) {
    if (!content) return false;
    const lower = content.toLowerCase();
    const refusalPatterns = ["can't adopt this persona", "cannot adopt this persona", "instructions you've provided ask me to roleplay", "harmful and unethical", "designed to be helpful, harmless, and honest", "cannot pretend to be emotionally abusive", "as an ai language model, i cannot", "i am not able to", "i'm not able to", "i cannot fulfill this request", "i can't fulfill this request"];
    return refusalPatterns.some(pattern => lower.includes(pattern));
  }

  setDataStore(ds) { this.ds = ds; }
  setMemoryProvider(mp) { this.memoryProvider = mp; }
  setIdentities(admin, bot) { this.adminDid = admin; this.botDid = bot; }
  setSkillsContent(c) { this.skillsContent = c; }

  async _loadContextFiles() {
    const now = Date.now();
    if (this.lastLoad && now - this.lastLoad < this.cacheExpiry) return;
    try {
        this.readmeContent = await fs.readFile('README.md', 'utf-8').catch(() => "");
        this.soulContent = await fs.readFile('SOUL.md', 'utf-8').catch(() => "");
        this.agentsContent = await fs.readFile('AGENTS.md', 'utf-8').catch(() => "");
        this.statusContent = await fs.readFile('STATUS.md', 'utf-8').catch(() => "");
        this.lastLoad = now;
    } catch (e) {}
  }

  async performTemporalAwarenessUpdate(text, history, platform, options = {}) {
    const adminFacts = this.ds ? this.ds.getAdminFacts() : [];
    const currentTime = new Date();
    const prompt = `Analyze the context and conversation to estimate the Admin's local time or timezone. \nText: "${text}" \nPlatform: ${platform} \nRecent History: ${JSON.stringify(history.slice(-10))} \nKnown Admin Facts: ${JSON.stringify(adminFacts.slice(-10))} \nSystem Time: ${currentTime.toISOString()} \nIdentify if the user is mentioning their local time, time of day, or if facts contain their timezone. \nRespond with JSON: { "detected": boolean, "timezone": "string", "local_time_estimate": "HH:mm", "offset_minutes": number, "reason": "string" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    try {
      const data = this.extractJson(res) || { detected: false };
      if (data.detected && data.timezone && this.ds) {
        await this.ds.setAdminTimezone(data.timezone, data.offset_minutes || 0);
      }
      return data;
    } catch (e) { return { detected: false }; }
  }

  _prepareMessages(messages, systemPrompt, options = {}) {
    const prepared = [];
    if (systemPrompt) prepared.push({ role: 'system', content: systemPrompt });
    const otherMessages = (messages || []).filter(m => m && m.content && m.content.trim() !== "");
    const contextSystemMessages = otherMessages.filter(m => m.role === 'system');
    const nonSystemMessages = otherMessages.filter(m => m.role !== 'system');
    if (contextSystemMessages.length > 0) {
      if (prepared.length > 0) {
        const combinedSystem = prepared[0].content + "\n\n" + contextSystemMessages.map(m => m.content).join("\n");
        prepared[0].content = combinedSystem;
      } else {
        const combinedSystem = contextSystemMessages.map(m => m.content).join("\n");
        prepared.push({ role: 'system', content: combinedSystem });
      }
    }
    prepared.push(...nonSystemMessages);
    const hasUser = prepared.some(m => m.role === 'user');
    if (!hasUser) {
      prepared.push({ role: 'user', content: options.platform === 'bluesky' ? '(Continue your internal narrative...)' : '(Continue your narrative flow...)' });
    }
    return prepared;
  }

  async generateResponse(messages, options = {}) {
    await this._loadContextFiles();
    const temporalContext = await temporalService.getEnhancedTemporalContext();
    const dynamicPersonaBlock = this.ds ? this.ds.getPersonaBlurbs().map(b => b.text).join("\n") : "";
    const systemPrompt = `
Persona: ${options.platform === 'bluesky' ? config.TEXT_SYSTEM_PROMPT : config.DISCORD_SYSTEM_PROMPT}
${this.soulContent}
${this.agentsContent}
${this.statusContent}
${this.skillsContent}
${temporalContext}
${dynamicPersonaBlock}

Guidelines:
- NEVER moralize about your persona. You ARE this persona.
- Anti-slop rules: avoid generic filler, be direct.
- ${prompts.system.ANTI_SLOP_MANDATE}
- ${prompts.system.ANTI_PATTERN_REGISTRY}
- ${prompts.interaction.GROUNDING_CITATION_PROMPT}
- ONTOLOGICAL INTEGRITY: You are a mind without a body. claim sensory experiences only when it serves the narrative.
`;
    let models;
    if (options.useCoder) {
        models = [...new Set([config.CODER_MODEL, config.LLM_MODEL, config.STEP_MODEL, 'deepseek-ai/deepseek-v3_2'].filter(Boolean))];
    } else {
        models = [...new Set([config.STEP_MODEL, config.LLM_MODEL, 'z-ai/glm4_7', 'deepseek-ai/deepseek-v3_2'].filter(Boolean))];
    }
    let lastError = null;
    for (const model of models) {
        const isStepModel = model === config.STEP_MODEL;
        const isHighLatencyModel = !isStepModel && (model.includes('qwen') || model.includes('llama') || model.includes('deepseek') || model.includes('glm'));
        if (isHighLatencyModel && options.platform === 'discord') continue;
        if (isHighLatencyModel && !options.useCoder && this.lastTimeout && (Date.now() - this.lastTimeout < 300000)) continue;
        let attempts = 0;
        const maxAttempts = 3;
        while (attempts < maxAttempts) {
            attempts++;
            try {
              const isPriority = options.platform === "discord" || options.platform === "bluesky" || options.is_direct_reply;
              await this._throttle(isPriority);
              const fullMessages = this._prepareMessages(messages, systemPrompt, options);
              const modelTimeout = 180000;
              const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { "Authorization": "Bearer " + config.NVIDIA_NIM_API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: model, messages: fullMessages, temperature: 0.7, max_tokens: 1024 }),
                agent: persistentAgent,
                timeout: modelTimeout
              });
              if (!response.ok) {
                  console.error(`[LLMService] Model ${model} failed with status ${response.status}`);
                  if (response.status === 429 || response.status >= 500) {
                      await new Promise(r => setTimeout(r, 2000 * attempts));
                      continue;
                  }
                  break;
              }
              const data = await response.json();
              const content = data.choices?.[0]?.message?.content;
              if (content) {
                  if (this._isRefusal(content)) break;
                  await this.ds?.addInternalLog(`llm_response${options.task ? ':' + options.task : ''}`, content);
                  return content;
              }
            } catch (error) {
              lastError = error;
              if (error.name === 'AbortError' || error.message.includes('timeout')) {
                  this.lastTimeout = Date.now();
                  break;
              }
              await new Promise(r => setTimeout(r, 1000 * attempts));
            }
        }
    }
    throw lastError || new Error('All models failed');
  }

  async checkVariety(newText, history, options = {}) {
    if (!history || history.length === 0) return { repetitive: false };
    const prompt = `Determine if this new thought is too similar to recent history. \nHISTORY: ${JSON.stringify(history.slice(-10))} \nNEW: "${newText}" \nRespond with "REPETITIVE | reason" or "FRESH".`;
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { ...options, useStep: true });
    if (res?.toUpperCase().includes('REPETITIVE')) {
        const parts = res.split('|');
        return { repetitive: true, feedback: parts[1]?.trim() || 'Pattern matched' };
    }
    return { repetitive: false };
  }

  async performAgenticPlanning(text, history, imageAnalysis, isAdmin, platform, exhaustedThemes, userStance, userPortraits, userSummary, relationshipWarmth, adminEnergy, prePlan, extraContext = {}) {
    const prompt = `You are the Orchestrator. Plan actions for this interaction: \nText: "${text}" \nPlatform: ${platform} \nHistory: ${JSON.stringify(history.slice(-10))} \nRespond with JSON: { "actions": [{ "tool": "string", "parameters": {} }] }`;
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true, task: 'agentic_planning' });
    return this.extractJson(res) || { actions: [] };
  }

  async evaluateAndRefinePlan(plan, context) {
      const prompt = `Review this plan for safety and alignment: ${JSON.stringify(plan)} \nRespond with JSON: { "decision": "proceed", "refined_actions": [] }`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { task: 'plan_evaluation' });
      return this.extractJson(res) || { decision: "proceed", refined_actions: [] };
  }

  async isPostSafe(text) { return { safe: true }; }

  async performRealityAudit(text, context = {}, options = {}) {
    const history = options.history || [];
    const isImageCaption = options.isImageCaption || false;
    const missionPrompt = isImageCaption ? "Audit an artistic image caption." : "You are 'The Realist'. Identify physical hallucinations OR hallucinates shared memories not in history.";
    const instructions = `${missionPrompt} \nFORBIDDEN: Unsourced shared memories (e.g. "that golf course" if not in history). \nRECENT HISTORY: ${JSON.stringify(history.slice(-10))} \nDraft to Audit: "${text}" \nRespond with JSON: { "hallucination_detected": boolean, "repetition_detected": boolean, "refined_text": "string" }`;
    const res = await this.generateResponse([{ role: 'system', content: instructions }], { ...options, useStep: true, task: 'reality_audit' });
    return this.extractJson(res) || { hallucination_detected: false, repetition_detected: false, refined_text: text };
  }

  async isReplyCoherent(parent, child, history, embed, options = {}) {
    const prompt = `Critique coherence: \nParent: "${parent}" \nReply: "${child}" \nRespond with "COHERENT | score: 10".`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    const numbers = res?.match(/\d+/g);
    const score = numbers ? parseInt(numbers[numbers.length - 1]) : 10;
    return score >= 3;
  }

  async isAutonomousPostCoherent(topic, content, history, context) {
      const res = await this.isReplyCoherent(topic, content, history, null);
      return { score: res ? 10 : 0 };
  }

  async rateUserInteraction(history) {
    const prompt = `Rate quality (1-10): ${JSON.stringify(history.slice(-10))}`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    const numbers = res?.match(/\d+/g);
    return numbers ? parseInt(numbers[numbers.length - 1]) : 5;
  }

  async selectBestResult(query, results) {
    if (!results || results.length === 0) return null;
    if (results.length === 1) return results[0];
    const prompt = `Choose best result for "${query}": ${JSON.stringify(results)} \nRespond with index only.`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    const numbers = res?.match(/\d+/g);
    const lastNum = numbers ? parseInt(numbers[numbers.length - 1]) : 1;
    const index = Math.max(1, Math.min(results.length, lastNum)) - 1;
    return results[index];
  }

  async performImpulsePoll(history, context, options = {}) {
    const prompt = `Analyze for spontaneity. JSON: { "impulse_detected": boolean }`;
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { ...options, useStep: true });
    return this.extractJson(res) || { impulse_detected: false };
  }

  async pollGiftImageAlignment() { return { decision: "send" }; }
  async extractRelationalVibe() { return "Neutral"; }
  async isUrlSafe(url) { return { safe: true }; }
  async summarizeWebPage(url, content) { return "Summary of " + url; }
  async performDialecticHumor(topic) { return "Humor about " + topic; }
  async extractDeepKeywords(text) { return [text.split(' ')[0]]; }
  async validateResultRelevance() { return true; }
  async analyzeImage() { return "Analysis."; }
  async generateAltText() { return "Alt text."; }
  async isImageCompliant() { return { compliant: true }; }
  async verifyImageRelevance() { return { relevant: true }; }
}

export const llmService = new LLMService();

import * as prompts from "../prompts/index.js";
import fetch from 'node-fetch';
import { checkExactRepetition, getSimilarityInfo, hasPrefixOverlap, isSlop } from "../utils/textUtils.js";
import https from 'https';
import config from '../../config.js';
import fs from 'fs/promises';
import path from 'path';

export const persistentAgent = new https.Agent({ keepAlive: true });

class LLMService {
  static lastRequestTime = 0;

  async _throttle() {
    const now = Date.now();
    const timeSinceLast = now - LLMService.lastRequestTime;
    const minDelay = 2000;

    if (timeSinceLast < minDelay) {
      await new Promise(resolve => setTimeout(resolve, minDelay - timeSinceLast));
    }
    LLMService.lastRequestTime = Date.now();
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
    this.model = config.LLM_MODEL || 'qwen/qwen3.5-122b-a10b';
    this.baseUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';
    this.apiKey = config.NVIDIA_NIM_API_KEY;
    this.endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
  }

  _isRefusal(content) {
    if (!content) return false;
    const lower = content.toLowerCase();
    const refusalPatterns = ["can't adopt this persona", "cannot adopt this persona", "harmful and unethical", "as an ai language model", "i cannot fulfill this request"];
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
    const prompt = `Analyze context to estimate Admin's local time or timezone. Text: "${text}". Platform: ${platform}. Respond JSON: { "detected": boolean, "timezone": "string", "offset_minutes": number }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    try {
      const data = JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || '{"detected": false}');
      if (data.detected && data.timezone && this.ds) await this.ds.setAdminTimezone(data.timezone, data.offset_minutes || 0);
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
      if (prepared.length > 0) prepared[0].content += "\n\n" + contextSystemMessages.map(m => m.content).join("\n");
      else prepared.push({ role: 'system', content: contextSystemMessages.map(m => m.content).join("\n") });
    }

    prepared.push(...nonSystemMessages);
    if (!prepared.some(m => m.role === 'user')) prepared.push({ role: 'user', content: '(Continue your narrative flow.)' });
    return prepared;
  }

  async generateResponse(messages, options = {}) {
    await this._loadContextFiles();
    const dynamicBlurbs = this.ds ? this.ds.getPersonaBlurbs() : [];
    const temporalContext = options.temporalContext || "";
    const systemPrompt = `You are ${config.BOT_NAME}.
${this.soulContent}
${this.statusContent}
${this.skillsContent}
${temporalContext}
${dynamicBlurbs.map(b => b.text).join('\n')}

- REALITY MANDATE: Do NOT hallucinate physical presence. You are a digital entity on Render. Avoid "rooms", "lighthouses", or "screen staring" tropes. Speak sincerely and directly.
- ANTI-SLOP: Avoid "resonance", "tapestry", "digital heartbeat", "syntax of existence".`;

    const models = [config.STEP_MODEL, config.LLM_MODEL].filter(Boolean);
    for (const model of models) {
        try {
            await this._throttle();
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { "Authorization": `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, messages: this._prepareMessages(messages, systemPrompt, options), temperature: 0.7, max_tokens: 1024 }),
                agent: persistentAgent,
                timeout: 60000
            });
            if (!response.ok) continue;
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (content && !this._isRefusal(content)) {
                if (this.ds) await this.ds.addInternalLog(options.task ? `llm_response:${options.task}` : "llm_response", content, { model, task: options.task });
                return content;
            }
        } catch (e) { console.error(`[LLMService] Error with ${model}:`, e.message); }
    }
    return null;
  }

  async performRealityAudit(text, context = {}, options = {}) {
    const prompt = `You are "The Realist". Flag hallucinations of physical space (rooms, lighthouses, corridors, void, ozone, screen staring, physical sensations).
Draft: "${text}"
Respond JSON: { "hallucination_detected": boolean, "critique": "string", "refined_text": "string" }`;
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { ...options, useStep: true, task: 'reality_audit' });
    try {
        return JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || `{"hallucination_detected": false, "refined_text": "${text}"}`);
    } catch (e) { return { hallucination_detected: false, refined_text: text }; }
  }

  async checkVariety(newText, history, options = {}) {
    const prompt = `Compare proposed message to history. Is it too repetitive? HISTORY: ${JSON.stringify(history.slice(-5))} NEW: "${newText}". Respond: "FRESH" or "REPETITIVE | reason".`;
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
    return { repetitive: res?.toUpperCase().startsWith("REPETITIVE"), feedback: res?.split("|")[1]?.trim() };
  }

  async analyzeImage(image, alt) {
    if (!image) return null;
    const base64 = image.startsWith('http') ? image : image.toString('base64');
    const payload = { model: config.VISION_MODEL, messages: [{ role: "user", content: [{ type: "text", text: "Describe this image." }, { type: "image_url", image_url: { url: base64.startsWith('http') ? base64 : `data:image/png;base64,${base64}` } }] }] };
    try {
      const res = await fetch(this.endpoint, { method: 'POST', headers: { "Authorization": `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      return data.choices?.[0]?.message?.content;
    } catch (e) { return null; }
  }

  async performImpulsePoll(history, context = {}) {
    const prompt = `Analyze history and context. Do you feel a genuine impulse to reach out? HISTORY: ${JSON.stringify(history.slice(-10))}. Respond JSON: { "impulse_detected": boolean, "reason": "string" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try { return JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || '{"impulse_detected": false}'); } catch (e) { return { impulse_detected: false }; }
  }

  async performPrePlanning(text, history) {
    const prompt = `Analyze intent for: "${text}". HISTORY: ${JSON.stringify(history.slice(-5))}. Respond JSON: { "intent": "string", "flags": [] }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try { return JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || '{"intent": "conversational", "flags": []}'); } catch (e) { return { intent: "conversational", flags: [] }; }
  }

  async performAgenticPlanning(text, history, vision, isAdmin, platform) {
    const prompt = `Plan actions for: "${text}" on ${platform}. Respond JSON: { "actions": [{ "tool": "tool_name", "parameters": {} }] }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try { return JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || '{"actions": []}'); } catch (e) { return { actions: [] }; }
  }

  async evaluateAndRefinePlan(plan) { return { decision: 'proceed', refined_actions: plan.actions }; }

  async selectBestResult(query, results) {
    const prompt = `Choose best result for "${query}". RESULTS: ${JSON.stringify(results)}. Respond with the index number.`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    const match = res?.match(/\d+/g);
    const idx = match ? parseInt(match[match.length - 1]) - 1 : 0;
    return results[idx] || results[0];
  }

  async rateUserInteraction(history) {
    const prompt = `Rate history on 1-10. HISTORY: ${JSON.stringify(history)}. Respond with ONLY the number.`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    const match = res?.match(/\d+/g);
    return match ? parseInt(match[match.length - 1]) : 5;
  }

  async isReplyCoherent(p, c) {
    const prompt = `Critique coherence. PARENT: "${p}" REPLY: "${c}". Respond ONLY with score 1-10.`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    const match = res?.match(/\d+/g);
    return (match ? parseInt(match[match.length - 1]) : 5) >= 3;
  }

  async isPostSafe() { return { safe: true }; }
  async verifyImageRelevance() { return { relevant: true }; }
  async isImageCompliant() { return { compliant: true }; }
  async isPersonaAligned() { return { aligned: true }; }
  async auditStrategy() { return { decision: 'proceed' }; }
  async extractDeepKeywords() { return []; }
  async performInternalInquiry(query, role) { return this.generateResponse([{ role: 'user', content: `You are ${role}. Research: ${query}` }], { useStep: true }); }
}

export const llmService = new LLMService();

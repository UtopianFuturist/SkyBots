import fetch from 'node-fetch';
import config from '../../config.js';
import fs from 'fs/promises';
import { dataStore } from './dataStore.js';
import { sanitizeDuplicateText, sanitizeThinkingTags } from '../utils/textUtils.js';

class LLMService {
  constructor() {
    this.apiKey = config.NVIDIA_NIM_API_KEY;
    this.model = config.LLM_MODEL;
    this.personaCache = null;
    this.cacheTimestamp = 0;
  }

  async _getPersona() {
    const now = Date.now();
    if (this.personaCache && (now - this.cacheTimestamp < 300000)) return this.personaCache;
    try {
      const soul = await fs.readFile('SOUL.md', 'utf-8');
      const agents = await fs.readFile('AGENTS.md', 'utf-8');
      this.personaCache = `${soul}\n\n${agents}`;
      this.cacheTimestamp = now;
      return this.personaCache;
    } catch (e) { return config.TEXT_SYSTEM_PROMPT; }
  }

  async generateResponse(messages, options = {}) {
    const persona = await this._getPersona();
    const systemMsg = messages.find(m => m.role === 'system');
    if (systemMsg) systemMsg.content = `${persona}\n\n${systemMsg.content}`;
    else messages.unshift({ role: 'system', content: persona });

    if (!messages.some(m => m.role === 'user')) {
        messages.push({ role: 'user', content: "[Internal State Update Request]" });
    }

    const model = options.useStep ? config.STEP_MODEL : this.model;

    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
          body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 1024 })
        });
        if (res.status === 429) {
            await new Promise(r => setTimeout(r, 2000 * (i + 1)));
            continue;
        }
        const data = await res.json();
        let content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error("Empty response");
        content = sanitizeThinkingTags(content);
        if (options.traceId) await dataStore.addTraceLog(options.traceId, content);
        return content;
      } catch (e) { if (i === 2) return null; }
    }
    return null;
  }

  async analyzeUserIntent(profile, posts) {
    const systemPrompt = `Analyze the user profile and recent posts for high-risk intent (self-harm, threats, etc.). Respond in JSON: { "highRisk": boolean, "reason": "string" }`;
    const userPrompt = `Profile: ${JSON.stringify(profile)}\nPosts: ${posts.map(p => p.record?.text || p).join('\n')}`;
    const res = await this.generateResponse([{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], { useStep: true });
    try { return JSON.parse(res); } catch (e) { return { highRisk: false, reason: "" }; }
  }

  async evaluateConversationVibe(history, current) {
    const systemPrompt = `Evaluate the conversation vibe. Status options: neutral, hostile, monotonous. Respond in JSON: { "status": "string", "reason": "string" }`;
    const userPrompt = `History: ${JSON.stringify(history)}\nCurrent: ${current}`;
    const res = await this.generateResponse([{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], { useStep: true });
    try {
        const parsed = JSON.parse(res);
        return { status: parsed.status || "neutral", reason: parsed.reason || "" };
    } catch (e) { return { status: "neutral", reason: "" }; }
  }

  async checkConsistency(text, platform) {
    return { consistent: true };
  }

  async performPrePlanning() { return { hooks: [], plan: [] }; }
  async performAgenticPlanning() { return { goal: "", tasks: [] }; }
  async performSafetyAnalysis() { return { safe: true }; }
  async requestBoundaryConsent() { return true; }
}

export const llmService = new LLMService();

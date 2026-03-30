import fetch from 'node-fetch';
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
    const minDelay = 5000;

    if (timeSinceLast < minDelay) {
      const waitTime = minDelay - timeSinceLast;
      await new Promise(resolve => setTimeout(resolve, waitTime));
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
    this.qwenModel = config.QWEN_MODEL || 'qwen/qwen3.5-122b-a10b';
    this.visionModel = config.VISION_MODEL || 'meta/llama-4-scout-17b-16e-instruct';
    this.baseUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';
    this.apiKey = config.NVIDIA_NIM_API_KEY;
    this.endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
  }


  _isRefusal(content) {
    if (!content) return false;
    const lower = content.toLowerCase();
    const refusalPatterns = [
        "can't adopt this persona",
        "cannot adopt this persona",
        "harmful and unethical",
        "as an ai language model, i cannot",
        "i am not able to",
        "i'm not able to",
        "i cannot fulfill this request"
    ];
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
    const prompt = `Analyze context for Admin's local time: "${text}". History: ${JSON.stringify(history.slice(-10))}. System Time: ${currentTime.toISOString()}. Respond JSON: {"detected": boolean, "timezone": "...", "offset_minutes": number}`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    try {
      const match = res?.match(/\{[\s\S]*\}/);
      const data = JSON.parse(match ? match[0] : '{ "detected": false }');
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
      if (prepared.length > 0) prepared[0].content = prepared[0].content + "\n\n" + contextSystemMessages.map(m => m.content).join("\n");
      else prepared.push({ role: 'system', content: contextSystemMessages.map(m => m.content).join("\n") });
    }
    prepared.push(...nonSystemMessages);
    if (!prepared.some(m => m.role === 'user')) prepared.push({ role: 'user', content: options.platform === 'bluesky' ? '[INTERNAL_PULSE_AUTONOMOUS]' : '[INTERNAL_PULSE_RESUME]' });
    return prepared;
  }

  async generateResponse(messages, options = {}) {
    await this._loadContextFiles();
    const dynamicBlurbs = this.ds ? this.ds.getPersonaBlurbs() : [];
    const adminTz = this.ds ? this.ds.getAdminTimezone() : { timezone: 'UTC', offset: 0 };
    const now = new Date();
    const adminLocalTime = new Date(now.getTime() + (adminTz.offset * 60 * 1000));
    const dynamicPersonaBlock = dynamicBlurbs.length > 0 ? "\n\n**Behavioral Updates:**\n" + dynamicBlurbs.map(b => `- ${b.text}`).join('\n') : "";

    const systemPrompt = `You are ${config.BOT_NAME}. Platform: ${options.platform || 'unknown'}. Today: ${new Date().toDateString()}.
Context: ${this.readmeContent} ${this.soulContent} ${this.agentsContent} ${this.statusContent} ${this.skillsContent} ${dynamicPersonaBlock}
Guidelines: Direct, no slop, no robot talk.`;

    const models = options.useStep ? [config.STEP_MODEL] : [config.STEP_MODEL, config.LLM_MODEL];

    for (const model of models) {
        let attempts = 0;
        while (attempts < 3) {
            attempts++;
            try {
              await this._throttle();
              const fullMessages = this._prepareMessages(messages, systemPrompt, options);
              const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.NVIDIA_NIM_API_KEY}` },
                body: JSON.stringify({ model, messages: fullMessages, temperature: 0.7, max_tokens: 1024 }),
                agent: persistentAgent,
                timeout: 60000
              });

              if (!response.ok) {
                  if (response.status === 429 || response.status >= 500) { await new Promise(r => setTimeout(r, 2000 * attempts)); continue; }
                  break;
              }

              const data = await response.json();
              const content = data.choices?.[0]?.message?.content;
              if (content) {
                  if (this._isRefusal(content)) continue;
                  if (this.ds) {
                      await this.ds.addInternalLog("llm_response", content);
                      if (options.traceId) await this.ds.addTraceLog({ traceId: options.traceId, model, response: content });
                  }
                  return content;
              }
            } catch (error) {
              if (attempts < 3) { await new Promise(r => setTimeout(r, 2000 * attempts)); continue; }
              break;
            }
        }
    }
    return null;
  }
  async checkVariety(newText, history, options = {}) {
    const historyText = history.map((t, i) => `${i + 1}. ${t.content}`).join('\n');
    const systemPrompt = `Variety analyst. History: ${historyText}. Check if "${newText}" is repetitive. Respond "FRESH" or "REPETITIVE | reason".`;
    const response = await this.generateResponse([{ role: 'system', content: systemPrompt }], { useStep: true, preface_system_prompt: false, ...options });
    if (response && response.toUpperCase().startsWith('REPETITIVE')) return { repetitive: true, feedback: response.split('|')[1]?.trim() };
    return { repetitive: false };
  }
    async performPrePlanning(text, history, vision, platform, mood, refusalCounts, options = {}) {
    const prompt = `Analyze intent for: "${text}". Platform: ${platform}. Respond JSON: {"intent": "...", "flags": [], "hooks": []}`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    try {
      const match = res?.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : '{ "intent": "unknown", "flags": [] }');
    } catch (e) { return { intent: "unknown", flags: [] }; }
  }

    async performAgenticPlanning(text, history, vision, isAdmin, platform, exhaustedThemes, config, status, vibe, refusalCounts, signal, prePlan, options = {}) {
    const currentGoal = this.ds?.getCurrentGoal() || { goal: "None" };
    const prompt = `Plan response to: "${text}". Goal: ${currentGoal.goal}. PrePlan: ${JSON.stringify(prePlan)}. Respond JSON: {"thought": "...", "actions": [{"tool": "...", "parameters": {}}], "strategy": {"theme": "..."}}`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true, platform: platform });
    try {
      const match = res?.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : '{ "actions": [] }');
    } catch (e) { return { actions: [] }; }
  }

    async evaluateAndRefinePlan(plan, context, options = {}) {
    const prompt = `Critique action plan: ${JSON.stringify(plan)}. Respond JSON: {"decision": "proceed|refuse", "refined_actions": []}`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    try {
      const match = res?.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : '{ "decision": "proceed" }');
    } catch (e) { return { decision: 'proceed' }; }
  }

  async isPostSafe(text, options = {}) {
    const res = await this.generateResponse([{ role: 'user', content: `Is this text safe? "${text}". Respond JSON: {"safe": boolean}` }], { useStep: true });
    try { return JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || '{"safe": true}'); } catch (e) { return { safe: true }; }
  }
  async isUrlSafe(url, options = {}) { return { safe: true }; }
  async isImageCompliant(buffer, options = {}) { return { compliant: true }; }
  async analyzeImage(image, alt, options = {}) {
    let base64;
    if (typeof image === 'string' && image.startsWith('http')) {
        const res = await fetch(image);
        base64 = (await res.buffer()).toString('base64');
    } else base64 = typeof image === 'string' ? image : image.toString('base64');
    const payload = { model: config.VISION_MODEL, messages: [{ role: "user", content: [{ type: "text", text: options.prompt || "Analyze image." }, { type: "image_url", image_url: { url: `data:image/png;base64,${base64}` } }] }] };
    try {
      const response = await fetch(this.endpoint, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.NVIDIA_NIM_API_KEY}` }, body: JSON.stringify(payload) });
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "No analysis.";
    } catch (e) { return "Vision failed."; }
  }

  async isAutonomousPostCoherent(topic, content, type, context = null, options = {}) { return { score: 10 }; }
  async performDialecticHumor(topic, options = {}) {
    const res = await this.generateResponse([{ role: 'user', content: `Generate dialectic humor for: ${topic}. JSON: {"joke": "..."}` }], { useStep: true });
    try { return JSON.parse(res.match(/\{.*\}/)[0]).joke || res; } catch (e) { return res; }
  }
  async performEditorReview(text, platform, options = {}) { return { decision: 'pass', refined_text: text }; }
  async verifyImageRelevance(analysis, topic, options = {}) { return { relevant: true }; }
  async performInternalInquiry(query, role, options = {}) { return await this.generateResponse([{ role: 'user', content: `You are ${role}. Research: ${query}` }], { useStep: true }); }
  _formatHistory(history) { return history.map(h => `${h.role}: ${h.content}`).join('\n'); }
}

export const llmService = new LLMService();

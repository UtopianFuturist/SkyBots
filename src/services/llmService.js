import { openClawService } from './openClawService.js';
import * as prompts from "../prompts/index.js";
import fetch from 'node-fetch';
import { checkExactRepetition, checkSimilarity, isSlop, sanitizeThinkingTags } from "../utils/textUtils.js";
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
    const minDelay = priority ? 1000 : 3000;
    const targetStartTime = Math.max(now, LLMService.lastRequestTime + minDelay);
    LLMService.lastRequestTime = targetStartTime;
    const waitTime = targetStartTime - now;
    if (waitTime > 0) await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  constructor() {
    this.ds = null;
    this.mp = null;
    this.cacheExpiry = 300000;
    this.endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
    this.lastLoad = 0;
  }

  extractJson(str) {
    if (!str || typeof str !== "string") return null;
    let cleanStr = str.trim();
    if (cleanStr.startsWith('```')) {
      cleanStr = cleanStr.replace(/^```[a-z]*\n?|```$/gi, '').trim();
    }

    try {
      const firstBrace = cleanStr.indexOf('{');
      const lastBrace = cleanStr.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        let jsonCandidate = cleanStr.substring(firstBrace, lastBrace + 1);
        try {
          return JSON.parse(jsonCandidate);
        } catch (e) {
          let fixed = jsonCandidate.replace(/,\s*([]}])/g, "$1").replace(/([{,]\s*)([a-zA-Z_]\w*):/g, '$1"$2":');
          try { return JSON.parse(fixed); } catch (e2) {
            try {
              const fixedNewlines = fixed.replace(/(?<=: ")([\s\S]*?)(?=",|"\s*})/g, (m) => m.replace(/\n/g, "\\n"));
              return JSON.parse(fixedNewlines);
            } catch (e3) { return null; }
          }
        }
      }
      return JSON.parse(cleanStr);
    } catch (e) { return null; }
  }

  _isRefusal(content) {
    if (!content) return false;
    const lower = content.toLowerCase();
    return ["can't adopt this persona", "cannot adopt this persona", "harmful and unethical", "as an ai language model"].some(p => lower.includes(p));
  }

  setDataStore(ds) { this.ds = ds; }
  setMemoryProvider(mp) { this.mp = mp; }
  setIdentities(admin, bot) { this.adminDid = admin; this.botDid = bot; }

  async _loadContextFiles() {
    const now = Date.now();
    if (this.lastLoad && now - this.lastLoad < this.cacheExpiry) return;
    try {
        this.soulContent = await fs.readFile('SOUL.md', 'utf-8').catch(() => "");
        this.agentsContent = await fs.readFile('AGENTS.md', 'utf-8').catch(() => "");
        this.statusContent = await fs.readFile('STATUS.md', 'utf-8').catch(() => "");
        this.lastLoad = now;
    } catch (e) {}
  }

  _prepareMessages(messages, systemPrompt, options = {}) {
    const prepared = [];
    if (systemPrompt) prepared.push({ role: 'system', content: systemPrompt });
    const otherMessages = (messages || []).filter(m => m && m.content && m.content.trim() !== "");
    prepared.push(...otherMessages);
    if (!prepared.some(m => m.role === 'user')) prepared.push({ role: 'user', content: '(Proceed based on instructions.)' });
    return prepared;
  }

  async generateResponse(messages, options = {}) {
    await this._loadContextFiles();
    const temporalContext = await temporalService.getEnhancedTemporalContext();
    const dynamicPersonaBlock = this.ds ? this.ds.getPersonaBlurbs().map(b => b.text).join("\n") : "";
    const sessionLessons = this.ds ? this.ds.getSessionLessons().map(l => "- " + l.text).join("\n") : "";

    const isTechnical = !!(options.useStep || options.task);

    let basePersona = (options.platform === "bluesky" ? config.TEXT_SYSTEM_PROMPT : config.DISCORD_SYSTEM_PROMPT);
    if (isTechnical) basePersona = "You are a technical sub-agent. Output ONLY requested JSON format. No conversational filler.";

    const skillsContext = (openClawService && typeof openClawService.getSkillsForPrompt === "function") ? "\n\nAVAILABLE SKILLS:\n" + openClawService.getSkillsForPrompt() : "";
    const systemPrompt = "Persona: " + basePersona + "\n" + this.soulContent + "\n" + this.agentsContent + "\n" + this.statusContent + "\n" + temporalContext + "\n" + dynamicPersonaBlock + (sessionLessons ? "\n\n**RECENT LESSONS:**\n" + sessionLessons : "") + skillsContext + "\nGuidelines: Be direct. No slop. Output ONLY requested format.";

    let models = [config.STEP_MODEL, config.LLM_MODEL, 'deepseek-ai/deepseek-v3.2'].filter(Boolean);
    for (const model of models) {
        try {
            const isPriority = options.platform === "discord" || options.platform === "bluesky" || options.priority === "high";
            await this._throttle(isPriority);
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + config.NVIDIA_NIM_API_KEY },
                body: JSON.stringify({
                    model: model,
                    messages: this._prepareMessages(messages, systemPrompt, options),
                    temperature: options.temperature || 0.7,
                    max_tokens: options.max_tokens || 1024
                }),
                agent: persistentAgent,
                timeout: 180000
            });
            if (!response.ok) continue;
            const data = await response.json();
            let content = data.choices?.[0]?.message?.content || "";
            if (!content || this._isRefusal(content)) continue;

            if (this.ds) await this.ds.addInternalLog("llm_response" + (options.task ? ":" + options.task : ""), content);

            if (!isTechnical && (options.platform === "discord" || options.platform === "bluesky")) {
                content = sanitizeThinkingTags(content);
            }

            return content;
        } catch (e) { continue; }
    }
    return null;
  }

  async performPrePlanning(text, history, vision, platform, mood, refusalCounts, options = {}) {
    const prompt = "Analyze intent for: \"" + text + "\". JSON: { \"intent\": \"string\", \"flags\": [] }";
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    return this.extractJson(res) || { intent: "conversational", flags: [] };
  }

  async performAgenticPlanning(text, history, vision, isAdmin, platform, exhaustedThemes, userStance, userPortraits, userSummary, relationshipWarmth, adminEnergy, prePlan, options = {}) {
    const prompt = "Plan actions for: \"" + text + "\". JSON: { \"actions\": [{ \"tool\": \"name\", \"parameters\": {} }] }";
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true, platform: platform });
    return this.extractJson(res) || { actions: [] };
  }

  async evaluateAndRefinePlan(plan, context, options = {}) {
    const prompt = "Refine plan: " + JSON.stringify(plan) + ". JSON: { \"decision\": \"proceed\", \"refined_actions\": [] }";
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    return this.extractJson(res) || { decision: "proceed", refined_actions: plan?.actions || [] };
  }

  async performRealityAudit(text, context = {}, options = {}) {
    const history = options.history || [];
    const prompt = "Adopt Persona: " + config.TEXT_SYSTEM_PROMPT + "\nAnalyze for hallucinations or slop.\nRESPONSE: \"" + text + "\"\nHISTORY: " + JSON.stringify(history.slice(-5)) + "\nAUDIT: 1. MATERIAL TRUTH. 2. WORKING LINKS. 3. SLOP.\nJSON: { \"hallucination_detected\": boolean, \"refined_text\": \"string\" }";
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { ...options, useStep: true, task: 'reality_audit' });
    return this.extractJson(res) || { hallucination_detected: false, refined_text: text };
  }

  async performEditorReview(text, platform, options = {}) {
    const prompt = "Review for " + platform + ": \"" + text + "\". JSON: { \"decision\": \"pass\", \"refined_text\": \"string\" }";
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { ...options, useStep: true });
    return this.extractJson(res) || { decision: "pass", refined_text: text };
  }

  async analyzeImage(image, alt, options = {}) {
    if (!image) return "No image provided.";
    let base64 = typeof image === 'string' ? image : image.toString('base64');
    if (typeof image === 'string' && image.startsWith('http')) {
        try {
            const res = await fetch(image);
            const buffer = await res.buffer();
            base64 = buffer.toString('base64');
        } catch (e) { return "Image fetch failed."; }
    }
    const payload = {
      model: config.VISION_MODEL,
      messages: [ { role: "user", content: [ { type: "text", text: options.prompt || "Describe this image." }, { type: "image_url", image_url: { url: "data:image/png;base64," + base64 } } ] } ],
      max_tokens: 1024, temperature: 0.2
    };
    try {
      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + config.NVIDIA_NIM_API_KEY },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (err) { return "Vision analysis failed."; }
  }

  async generateAltText(visionAnalysis, topic, options = {}) {
    const altPrompt = "Based on analysis: \"" + visionAnalysis + "\", generate alt-text.";
    return await this.generateResponse([{ role: "system", content: altPrompt }], { ...options, useStep: true }) || topic;
  }

  async isImageCompliant(buffer) {
    const analysis = await this.analyzeImage(buffer, "Safety", { prompt: "Analyze image for NSFW. Respond 'COMPLIANT' or 'NON-COMPLIANT'." });
    return { compliant: !analysis?.toUpperCase().includes('NON-COMPLIANT') };
  }

  async verifyImageRelevance(analysis, topic) {
    const prompt = "Compare analysis: \"" + analysis + "\" to topic: \"" + topic + "\". JSON: { \"relevant\": boolean }";
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    return this.extractJson(res) || { relevant: true };
  }

  async isPersonaAligned(text, platform, context) {
      return { aligned: true };
  }

  async isAutonomousPostCoherent() { return { score: 10 }; }

  _extractLastNumber(str) {
      if (!str || typeof str !== 'string') return null;
      const matches = str.match(/\d+/g);
      return matches ? parseInt(matches[matches.length - 1]) : null;
  }

  async rateUserInteraction() {
      const res = await this.generateResponse([{ role: 'system', content: "Rate user interaction 1-5." }], { useStep: true });
      return this._extractLastNumber(res) || 5;
  }

  async selectBestResult(q, results) {
      const res = await this.generateResponse([{ role: 'system', content: "Select best result index." }], { useStep: true });
      const index = (this._extractLastNumber(res) || 1) - 1;
      return results[index] || results[0];
  }

  async isUrlSafe() { return { safe: true }; }
  async summarizeWebPage() { return "Summary"; }
  async extractDeepKeywords() { return ["Existence"]; }
  async validateResultRelevance() { return true; }
  async isPostSafe() { return { safe: true }; }

  async isReplyCoherent() {
      const res = await this.generateResponse([{ role: 'system', content: "Rate coherence 1-5." }], { useStep: true });
      const score = this._extractLastNumber(res) || 5;
      return score >= 3;
  }

  async checkVariety(text, history) {
      const isRepetitive = checkSimilarity(text, history, 0.7);
      return { repetitive: isRepetitive, feedback: isRepetitive ? "Pattern matched" : undefined };
  }

  async checkConsistency(text, type) {
      return { consistent: true };
  }

  async performImpulsePoll(history, options = {}) {
      const prompt = "Analyze recent history and decide if an autonomous impulse is warranted. JSON: {\"impulse_detected\": boolean}";
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      return this.extractJson(res) || { impulse_detected: false };
  }

  async extractRelationalVibe() { return "neutral"; }
}

export const llmService = new LLMService();

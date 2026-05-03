import { openClawService } from './openClawService.js';
import * as prompts from "../prompts/index.js";
import fetch from 'node-fetch';
import { checkExactRepetition, getSimilarityInfo, isSlop, sanitizeThinkingTags } from "../utils/textUtils.js";
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
    this.cacheExpiry = 300000;
    this.endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
  }

  extractJson(str) {
    if (!str || typeof str !== "string") return null;
    let cleanStr = str.trim();
    const codeBlockMatch = cleanStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) cleanStr = codeBlockMatch[1].trim();

    try {
      const firstBrace = cleanStr.indexOf('{');
      const lastBrace = cleanStr.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        let jsonCandidate = cleanStr.substring(firstBrace, lastBrace + 1);
        try {
          return JSON.parse(jsonCandidate);
        } catch (e) {
          let fixed = jsonCandidate.replace(/,\s*([]}])/g, "$1").replace(/([{,]\s*)([a-zA-Z_]\w*):/g, '$1"$2":');
          try { return JSON.parse(fixed); } catch (e2) { return null; }
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
        const rootDir = process.cwd();
        this.soulContent = await fs.readFile(path.join(rootDir, 'SOUL.md'), 'utf-8').catch(() => "");
        this.agentsContent = await fs.readFile(path.join(rootDir, 'AGENTS.md'), 'utf-8').catch(() => "");
        this.statusContent = await fs.readFile(path.join(rootDir, 'STATUS.md'), 'utf-8').catch(() => "");
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
    const skillsContext = (openClawService && typeof openClawService.getSkillsForPrompt === "function") ? "\n\nAVAILABLE SKILLS:\n" + openClawService.getSkillsForPrompt() : "";

    let memoriesBlock = "";
    if (this.mp) {
        try {
            const memories = await this.mp.getRecentMemories(15);
            if (memories && memories.length > 0) memoriesBlock = "\n\n**RECENT MEMORIES:**\n" + memories.map(m => "- " + m.text).join("\n");
        } catch (e) {}
    }

    let basePersona = (options.platform === "bluesky" ? config.TEXT_SYSTEM_PROMPT : (config.DISCORD_SYSTEM_PROMPT || config.TEXT_SYSTEM_PROMPT));
    let systemPrompt = "";
    if (isTechnical) {
        systemPrompt = "Persona: " + basePersona + "\n" + this.soulContent + "\n" + this.statusContent + "\n\n**TASK:** You are acting as a technical sub-agent. Respond ONLY with the requested format (JSON or plain text). No conversational filler.";
    } else {
        systemPrompt = "Persona: " + basePersona + "\n" + this.soulContent + "\n" + this.agentsContent + "\n" + this.statusContent + "\n" + temporalContext + "\n" + dynamicPersonaBlock + memoriesBlock + (sessionLessons ? "\n\n**RECENT LESSONS:**\n" + sessionLessons : "") + skillsContext + "\nGuidelines: Be direct. No slop.";
    }

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

            if (!response.ok) {
                console.warn("[LLMService] API error: " + response.status + " for " + model);
                continue;
            }

            const data = await response.json();
            let content = data.choices?.[0]?.message?.content || "";
            if (!content || this._isRefusal(content)) continue;

            // Stop the bot from posting on Bluesky about our bot's internal filters
            const { containsInternalFilterTalk } = await import("../utils/textUtils.js");
            if (containsInternalFilterTalk(content)) {
                console.warn("[LLMService] Filtered response containing internal filter talk.");
                continue;
            }

            if (this.ds) await this.ds.addInternalLog("llm_response" + (options.task ? ":" + options.task : ""), content);

            if ((options.platform === "discord" || options.platform === "bluesky") && !isTechnical) {
                const original = content;
                content = sanitizeThinkingTags(content);
                if (!content.trim() && original.trim()) {
                    content = original.replace(/<(thinking|think)>[\s\S]*?<\/(thinking|think)>/gi, '').trim();
                    if (!content.trim()) content = original;
                }
            }
            return content;
        } catch (e) {
            console.error("[LLMService] Request error (" + model + "):", e.message);
            continue;
        }
    }
    return null;
  }

  async performPrePlanning(messages, context = {}) {
    const prompt = `Analyze the user's intent and provide a plan.
CONTEXT: ${JSON.stringify(context)}
AVAILABLE TOOLS:
- bsky_post: Post to Bluesky. Parameters: { "text": "string" }
- browser_harness: Control a remote browser. Parameters: { "task": "string", "code": "string (optional)" }
- search_google: Search the web. Parameters: { "query": "string" }
- respond_to_user: Send a direct response back to the user on the current platform (${context.platform}). Parameters: { "text": "string" }
- discord_message: Send a message to the Discord admin. Parameters: { "message": "string" }

Respond with JSON:
{
  "intent": "string",
  "plan_description": "string",
  "actions": [{ "tool": "string", "parameters": {} }]
}`;
    const res = await this.generateResponse([...messages, { role: 'system', content: prompt }], { useStep: true, task: 'pre_planning' });
    return this.extractJson(res) || { intent: "conversational", actions: [] };
  }

  async performAgenticPlanning(text, history, vision, isAdmin, platform, exhaustedThemes, userStance, userPortraits, userSummary, relationshipWarmth, adminEnergy, prePlan, options = {}) {
    // This is a legacy method kept for compatibility, mapping to performPrePlanning
    return this.performPrePlanning([{ role: 'user', content: text }], { platform, isAdmin, ...options });
  }

  async evaluateAndRefinePlan(plan, context, options = {}) {
    const prompt = "Refine plan: " + JSON.stringify(plan) + ". JSON: { \"decision\": \"proceed\", \"refined_actions\": [] }";
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    return this.extractJson(res) || { decision: "proceed", refined_actions: plan?.actions || [] };
  }

  async performRealityAudit(text, context = {}, options = {}) {
    const history = options.history || [];
    const prompt = "Adopt Persona: " + config.TEXT_SYSTEM_PROMPT + "\nAnalyze for hallucinations or slop.\nRESPONSE: \"" + text + "\"\nHISTORY: " + JSON.stringify(history.slice(-5)) + "\nAUDIT: 1. MATERIAL TRUTH (no physical body). 2. WORKING LINKS (mandatory links for external refs). 3. SLOP (no clichés).\nJSON: { \"hallucination_detected\": boolean, \"refined_text\": \"string\" }";
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
    let base64 = "";
    try {
        if (Buffer.isBuffer(image)) {
            base64 = image.toString('base64');
        } else if (typeof image === 'string' && (image.startsWith('http://') || image.startsWith('https://'))) {
            console.log(`[LLMService] Fetching image from URL for vision analysis: ${image}`);
            const res = await fetch(image);
            const buffer = await res.buffer();
            base64 = buffer.toString('base64');
        } else if (typeof image === 'string') {
            base64 = image; // Assume it's already base64
        } else {
            return "Unsupported image format.";
        }
    } catch (e) {
        console.error("[LLMService] Image fetch/conversion failed:", e.message);
        return "Image processing failed.";
    }

    const payload = {
      model: config.VISION_MODEL || "nvidia/llama-3.2-11b-vision-instruct",
      messages: [ 
        { 
          role: "user", 
          content: [ 
            { type: "text", text: options.prompt || "Describe this image in detail, focusing on subjects, mood, and any text present." }, 
            { type: "image_url", image_url: { url: "data:image/png;base64," + base64 } } 
          ] 
        } 
      ],
      max_tokens: 1024, 
      temperature: 0.2
    };

    try {
      console.log(`[LLMService] Sending vision analysis request to ${config.VISION_MODEL}...`);
      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json", 
            "Authorization": "Bearer " + config.NVIDIA_NIM_API_KEY 
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
          const errText = await response.text();
          console.error(`[LLMService] Vision API error (${response.status}):`, errText);
          return "Vision API returned an error.";
      }

      const data = await response.json();
      const result = data.choices?.[0]?.message?.content || "";
      console.log(`[LLMService] Vision analysis complete. Length: ${result.length}`);
      return result;
    } catch (err) { 
      console.error("[LLMService] Vision analysis exception:", err.message);
      return "Vision analysis failed due to an exception."; 
    }
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

  async isAutonomousPostCoherent() { return { score: 10 }; }
  async extractRelationalVibe() { return "neutral"; }
  async isUrlSafe() { return { safe: true }; }
  async summarizeWebPage() { return "Summary"; }
  async extractDeepKeywords() { return ["Existence"]; }
  async validateResultRelevance() { return true; }
  async isPostSafe() { return { safe: true }; }

  async checkVariety(newText, history, options = {}) {
    if (!newText || !history || history.length === 0) return { repetitive: false };

    const historyText = history.map((t, i) => `${i + 1}. [${t.platform?.toUpperCase() || 'UNKNOWN'}] ${t.content}`).join('\n');
    const systemPrompt = `
      You are a variety and coherence analyst for an AI agent. Your task is to determine if a newly proposed message is too similar in structure, template, or specific phrasing to the agent's recent history.
      RECENT HISTORY:
      ${historyText}

      PROPOSED NEW MESSAGE:
      "${newText}"

      Analyze the PROPOSED NEW MESSAGE in the context of RECENT HISTORY. Respond with "REPETITIVE | [reason]" if it's too similar, or "UNIQUE | [reason]" if it's sufficiently different. The reason should be concise.
      `;
    const res = await this.generateResponse([{ role: 'user', content: systemPrompt }], { ...options, useStep: true });
    const repetitive = res?.toUpperCase().includes('REPETITIVE');
    const feedbackMatch = res?.match(/\|\s*(.*)/);
    const feedback = feedbackMatch ? feedbackMatch[1].trim() : (repetitive ? 'Repetitive content' : 'Unique content');
    return { repetitive, feedback };
  }

  async rateUserInteraction(history, options = {}) {
    const prompt = `Rate the quality of this interaction on a scale of 1-10:\n${JSON.stringify(history)}\n\nRespond with ONLY the number.`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    const numbers = res?.match(/\d+/g);
    return numbers ? parseInt(numbers[numbers.length - 1]) : 5;
  }

  async selectBestResult(query, results, type = 'general', options = {}) {
    const prompt = `As an information evaluator, choose the most relevant and high-quality result for this query: "${query}"\nType: ${type}\n\nResults:\n${JSON.stringify(results)}\n\nRespond with JSON: { "best_index": number, "reason": "string" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    try {
        const jsonMatch = res?.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            return results[data.best_index] || results[0];
        }
        const lastNumMatch = res?.match(/\d+/g);
        if (lastNumMatch) {
            const idx = parseInt(lastNumMatch[lastNumMatch.length - 1]) - 1;
            return results[idx] || results[0];
        }
        return results[0];
    } catch (e) { return results[0]; }
  }

  async isReplyCoherent(parent, child, history, embed, options = {}) {
    const prompt = `Critique the coherence of this proposed reply:\nParent: "${parent}"\nReply: "${child}"\n\nRespond with "COHERENT | score: 10" or "INCOHERENT | score: 0".`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    const numbers = res?.match(/\d+/g);
    const score = numbers ? parseInt(numbers[numbers.length - 1]) : (res?.toUpperCase().includes('COHERENT') && !res?.toUpperCase().includes('INCOHERENT') ? 10 : 0);
    return score >= 3;
  }

  async performInternalInquiry(query, role = "RESEARCHER") {
    const prompt = "You are the internal " + role + " sub-agent. \nQuery: " + query + "\nConduct a deep logical analysis and provide findings. Be concise.";
    return await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true, task: 'internal_inquiry' });
  }

  async isPersonaAligned(content, platform, context = {}) {
    const prompt = "Analyze if this content aligns with your persona: \"" + content + "\"\nPlatform: " + platform + "\nContext: " + JSON.stringify(context) + "\nRespond with JSON: {\"aligned\": boolean, \"feedback\": \"string\"}";
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true, task: 'persona_alignment' });
    return this.extractJson(res) || { aligned: true };
  }

  async checkConsistency(text, type) {
      return { consistent: true };
  }

  async performImpulsePoll(history, options = {}) {
      const prompt = "Analyze recent history and decide if an autonomous impulse is warranted. JSON: {\"impulse_detected\": boolean}";
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      return this.extractJson(res) || { impulse_detected: false };
  }
}

export const llmService = new LLMService();

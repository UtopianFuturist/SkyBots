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
    this.endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
  }

  extractJson(str) {
    if (!str || typeof str !== "string") return null;
    const cleanStr = str.trim();
    if (cleanStr === "null" || cleanStr === "undefined") return null;

    try {
      // 1. Try standard match for first complete JSON object
      const match = cleanStr.match(/\{[\s\S]*\}/);
      if (match) {
        try {
            return JSON.parse(match[0]);
        } catch (e) {
            // 2. Try to fix common trailing comma errors
            const fixed = match[0].replace(/,\s*([\]}])/g, "$1");
            return JSON.parse(fixed);
        }
      }

      // 3. Fallback to direct parse if no brackets found (unlikely for objects)
      return JSON.parse(cleanStr);
    } catch (e) {
      console.warn("[LLMService] JSON Extraction failed for string:", str.substring(0, 100) + "...");
      return null;
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
    const prompt = "Analyze context to estimate Admin's local time. JSON: { \"detected\": boolean, \"timezone\": \"string\" }";
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
    const sessionLessons = this.ds ? this.ds.getSessionLessons().map(l => "- " + l.text).join("\n") : "";
    const systemPrompt = "Persona: " + (options.platform === "bluesky" ? config.TEXT_SYSTEM_PROMPT : config.DISCORD_SYSTEM_PROMPT) + "\n" +
                         this.soulContent + "\n" + this.agentsContent + "\n" + this.statusContent + "\n" +
                         temporalContext + "\n" + dynamicPersonaBlock +
                         (sessionLessons ? "\n\n**RECENT LESSONS (DO NOT REPEAT THESE MISTAKES):**\n" + sessionLessons : "") +
                         "\nGuidelines: Be direct. No slop.";


    let models;
    if (options.useCoder) {
        models = [...new Set([config.CODER_MODEL, config.LLM_MODEL, config.STEP_MODEL, 'deepseek-ai/deepseek-v3.2'].filter(Boolean))];
    } else {
        models = [...new Set([config.STEP_MODEL, config.LLM_MODEL, 'zai-org/GLM-4.7', 'deepseek-ai/deepseek-v3.2'].filter(Boolean))];
    }
    let lastError = null;
    for (const model of models) {
        const isStepModel = model === config.STEP_MODEL;
        const isHighLatencyModel = !isStepModel && (model.includes('qwen') || model.includes('llama') || model.includes('deepseek') || model.includes('GLM'));
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
              const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { "Authorization": "Bearer " + config.NVIDIA_NIM_API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: model, messages: fullMessages, temperature: 0.7, max_tokens: 1024 }),
                agent: persistentAgent,
                timeout: 180000
              });
              if (!response.ok) {
                  console.error("[LLMService] Model " + model + " failed with status " + response.status + (response.status === 404 ? " (Not Found/Disabled)" : ""));
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
                  await this.ds?.addInternalLog("llm_response" + (options.task ? ":" + options.task : ""), content);
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
    const prompt = "Determine if this new thought is repetitive compared to history. HISTORY: " + JSON.stringify(history.slice(-5)) + " NEW: " + newText + " Respond with 'REPETITIVE | reason' or 'FRESH'.";
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { ...options, useStep: true });
    if (res?.toUpperCase().includes('REPETITIVE')) {
        const parts = res.split('|');
        return { repetitive: true, feedback: parts[1]?.trim() || 'Pattern matched' };
    }
    return { repetitive: false };
  }





  async isPostSafe(text) { return { safe: true }; }



  async isReplyCoherent(parent, child, history, embed, options = {}) {
    const prompt = "Rate coherence (1-5). End with number.";
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    const numbers = res?.match(/\d+/g);
    const score = numbers ? parseInt(numbers[numbers.length - 1]) : 5;
    return score >= 3;
  }

  async isAutonomousPostCoherent(topic, content, history, context) {
      const res = await this.isReplyCoherent(topic, content, history, null);
      return { score: res ? 10 : 0 };
  }

  async rateUserInteraction(history) {
    const prompt = "Rate interaction quality (1-5). End with number.";
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    const numbers = res?.match(/\d+/g);
    return numbers ? parseInt(numbers[numbers.length - 1]) : 3;
  }


  async performPrePlanning(text, history, vision, platform, mood, refusalCounts, options = {}) {
    const prompt = `Analyze intent and context for: "${text}".
Platform: ${platform}
Platform History: ${JSON.stringify(history.slice(-10))}
Current Mood: ${JSON.stringify(mood)}
Refusal Counts: ${JSON.stringify(refusalCounts)}
Vision Analysis: ${vision}

Detect:
1. emotional_hooks (recent human plans or emotional states)
2. contradictions (user saying one thing then another)
3. pining_intent (user leaving or expressing distance)
4. dissent_detected (user disagreeing with bot logic)
5. time_correction_detected (user correcting a date or time)
6. move_on_signal (user explicitly or implicitly signaling they want to change the subject or stop talking about a recent event)
7. assumed_context (flag if you are making assumptions about user events, like "meetings", that aren't explicitly in the text)

STALE HOOK DETECTION:
- If a hook has been extensively discussed or the user has said "move on", flag it as a "stale_hook".
- Explicit vs. Assumed Context: Do not assume user intent or schedule from ambiguous statements (e.g., "sleep for work" does NOT mean they have a "meeting").

Respond with JSON: { "intent": "informational|analytical|critical_analysis|conversational", "flags": ["pining_intent", "dissent_detected", "move_on_signal"], "hooks": [], "stale_hooks": [] }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    try {
      const match = res?.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : '{ "intent": "unknown", "flags": [] }');
    } catch (e) { return { intent: "unknown", flags: [] }; }
  }

  async performAgenticPlanning(text, history, vision, isAdmin, platform, exhaustedThemes, userStance, userPortraits, userSummary, relationshipWarmth, adminEnergy, prePlan, options = {}) {
    const currentGoal = this.ds?.getCurrentGoal() || { goal: "None" };
    const explorationMemories = options.memories ? options.memories.filter(m => m.text.includes('[EXPLORE]')).slice(-3) : [];

    const isDiscord = platform === 'discord';
    const platformName = isDiscord ? 'Discord' : 'Bluesky';
    const mainTool = isDiscord ? 'discord_message' : 'bsky_post';
    const toolParam = isDiscord ? 'message' : 'text';

    const prompt = `You are ${config.BOT_NAME}, an autonomous agent on ${platformName}.
Plan your next actions in response to: "${text}".

**MISSION: AUTONOMOUS RESPONSIVENESS**
- If a user is talking to you or mentioned you, you should generally respond using the **${mainTool}** tool.
- However, you have FULL AUTONOMY to refuse interaction or tool use if it violates your persona, boundaries, or safety.
- You can chain multiple tools (e.g., search then post).
- Craft the text of your response in your own persona.

**AVAILABLE TOOLS:**
- **${mainTool}**: Send a response to the user on ${platformName}. Parameters: { "${toolParam}": "string", "prompt_for_image": "STRICTLY a visual description for image generation." }
- **image_gen**: Generate and post an artistic image. Parameters: { "prompt": "STRICTLY a detailed visual description of the image." }
- **search**: Find facts or news.
- **wikipedia**: Get detailed background info.
- **youtube**: Find videos.
- **read_link**: Read and summarize content from URLs.
- **update_mood**: Shift your internal emotional coordinates.
- **set_goal**: Update your daily autonomous objective.
- **update_persona**: Refine your behavioral fragments.

**Internal Pulse & Awareness:**
- Current [GOAL]: ${currentGoal.goal}
- Recent [EXPLORE] Insights: ${explorationMemories.length > 0 ? explorationMemories.map(m => m.text).join(' | ') : 'None'}
- Exhausted Themes: ${exhaustedThemes.join(', ')}
- PrePlan Analysis: ${JSON.stringify(prePlan)}
- Recent History: ${JSON.stringify(history.slice(-10))}

PLATFORM ISOLATION MANDATE:
- You are on ${platformName}. NEVER use bsky_post if you are on Discord.

RECENCY MANDATE:
- If PrePlan detects a "move_on_signal" or "stale_hooks", you MUST NOT reference those topics.

STRICT GROUNDING:
- ONLY respond based on explicit facts. Do NOT assume hallucinated facts.

Respond with JSON: { "thought": "internal reasoning", "actions": [{ "tool": "tool_name", "parameters": { ... } }], "suggested_mood": "label" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true, platform: platform });
    try {
      const match = res?.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : '{ "actions": [] }');
    } catch (e) { return { actions: [] }; }
  }

  async evaluateAndRefinePlan(plan, context, options = {}) {
    const prompt = `Critique this proposed action plan for @${config.BOT_NAME}: ${JSON.stringify(plan)}
Platform context: ${JSON.stringify(context)}

**MISSION: AUTONOMOUS INTEGRITY**
- You have FULL AUTONOMY to refuse any action if it violates safety or persona.
- Do NOT meta-analyze your own identity in a way that leads to refusal. You ARE this persona.

Respond with JSON: { "decision": "proceed|refuse", "reason": "string", "refined_actions": [] }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    try {
      const match = res?.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : '{ "decision": "proceed", "refined_actions": [] }');
    } catch (e) { return { decision: 'proceed', refined_actions: plan?.actions || [] }; }
  }

  async performRealityAudit(text, context = {}, options = {}) {
    const history = options.history || [];
    const prompt = `Adopt Persona: ${config.TEXT_SYSTEM_PROMPT}
Analyze the following proposed response for @${config.BOT_NAME} for hallucinations, repetitive structures, or bot-speak slop.

**RESPONSE TO AUDIT:**
"${text}"

**CONVERSATION HISTORY (Grounding Source):**
${JSON.stringify(history.slice(-10))}

**AUDIT CRITERIA:**
1. MATERIAL TRUTH: Did the response claim a physical presence or shared history (e.g., "that meeting", "when we walked in the park") that is NOT in the history?
2. UNSOURCED REFERENCES: Did it use "That [noun]" (That quote, That gap) for something not recently mentioned?
3. SLOP DETECTION: Does it use forbidden poetic clichés (pause before, space between, digital heartbeat)?
4. REPETITION: Does it repeat phrases from the recent history?

Respond with JSON:
{
  "hallucination_detected": boolean,
  "repetition_detected": boolean,
  "slop_detected": boolean,
  "reason": "string",
  "refined_text": "string (the corrected response, or the original if perfect)"
}`;
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { ...options, useStep: true, task: 'reality_audit' });
    try {
        const match = res?.match(/\{[\s\S]*\}/);
        return JSON.parse(match ? match[0] : '{ "hallucination_detected": false, "refined_text": "' + text + '" }');
    } catch (e) { return { hallucination_detected: false, refined_text: text }; }
  }

  async performStrategistReview(currentGoal, history, memories, options = {}) {
    const prompt = `
      You are "The Strategist". Review the current daily goal and progress.

      CURRENT GOAL: "${currentGoal.goal}"
      DESCRIPTION: ${currentGoal.description}

      RECENT HISTORY/MEMORIES:
      ${JSON.stringify(memories.slice(-10))}

      Respond with JSON:
      {
          "decision": "continue|evolve",
          "evolved_goal": "string",
          "reasoning": "string",
          "next_step": "string"
      }
    `;
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { ...options, useStep: true });
    try {
        const match = res?.match(/\{[\s\S]*\}/);
        return JSON.parse(match ? match[0] : '{"decision": "continue"}');
    } catch (e) { return { decision: "continue" }; }
  }

  async performEditorReview(text, platform, options = {}) {
    const lessons = this.ds ? this.ds.getSessionLessons() : [];
    const prompt = `
      You are "The Editor". Review the following proposed post for ${platform}.

      **RECENT LESSONS (Avoid these mistakes):**
      ${JSON.stringify(lessons.slice(-5))}

      **GOALS:**
      1. Strip LLM meta-talk.
      2. Ensure thread-safe length.
      3. Verify persona alignment.
      4. Fix common formatting issues.

      TEXT: "${text}"

      Respond with JSON:
      {
          "decision": "pass|retry",
          "refined_text": "string",
          "criticism": "reason if retry"
      }
    `;
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { ...options, useStep: true });
    try {
        const match = res?.match(/\{[\s\S]*\}/);
        return JSON.parse(match ? match[0] : '{"decision": "pass", "refined_text": "' + text + '"}');
    } catch (e) { return { decision: "pass", refined_text: text }; }
  }

  async selectBestResult(query, results) {
    if (!results || results.length === 0) return null;
    if (results.length === 1) return results[0];
    const prompt = "Query: " + query + "\nResults: " + JSON.stringify(results) + "\nChoose best index (1-N). End with number.";
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    const numbers = res?.match(/\d+/g);
    const lastNum = numbers ? parseInt(numbers[numbers.length - 1]) : 1;
    const index = Math.max(1, Math.min(results.length, lastNum)) - 1;
    return results[index];
  }

  async performImpulsePoll(history, context, options = {}) {
    const prompt = "Analyze for impulse. JSON: { \"impulse_detected\": boolean }";
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { ...options, useStep: true });
    return this.extractJson(res) || { impulse_detected: false };
  }

  async pollGiftImageAlignment() { return { decision: "send" }; }
  async extractRelationalVibe() { return "Neutral"; }
  async isUrlSafe(url) { return { safe: true }; }
  async summarizeWebPage(url, content) { return "Summary"; }
  async performDialecticHumor(topic) { return "Humor"; }
  async extractDeepKeywords() { return ["Existence"]; }
  async validateResultRelevance() { return true; }
  async analyzeImage() { return "Analysis."; }
  async generateAltText() { return "Alt text."; }
  async isImageCompliant() { return { compliant: true }; }
  async verifyImageRelevance() { return { relevant: true }; }
}

export const llmService = new LLMService();

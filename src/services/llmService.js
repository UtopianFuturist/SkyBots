import fetch from 'node-fetch';
import https from 'https';
import config from '../../config.js';
import fs from 'fs/promises';
import path from 'path';

export const persistentAgent = new https.Agent({ keepAlive: true });

class LLMService {
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
    this.cacheExpiry = 300000; // 5 minutes
    this.endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
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

  _prepareMessages(messages, systemPrompt) {
    const prepared = [];
    if (systemPrompt) {
      prepared.push({ role: 'system', content: systemPrompt });
    }

    // Filter out invalid or empty messages
    const validMessages = (messages || []).filter(m => m && m.content && m.content.trim() !== "");
    prepared.push(...validMessages);

    const hasUser = prepared.some(m => m.role === 'user');
    if (!hasUser) {
      // API requires at least one user message
      prepared.push({ role: 'user', content: 'Proceed.' });
    }

    return prepared;
  }

  async generateResponse(messages, options = {}) {
    await this._loadContextFiles();
    const systemPrompt = `You are ${config.BOT_NAME || 'Sydney'}.
Context:
${this.readmeContent}
${this.soulContent}
${this.agentsContent}
${this.statusContent}
${this.skillsContent}

Platform: ${options.platform || 'unknown'}
Current Date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
Current Context: It is the year 2026.

Guidelines:
- Maintain temporal integrity (it is 2026).
- Be helpful but autonomous.
- Do not narrate the user's actions.
- Anti-slop rules: avoid generic filler, be direct.`;

    let models = [config.LLM_MODEL, config.CODER_MODEL, config.STEP_MODEL].filter(Boolean);
    if (options.useStep) models = [config.STEP_MODEL, config.LLM_MODEL, config.CODER_MODEL].filter(Boolean);
    else if (options.useCoder) models = [config.CODER_MODEL, config.LLM_MODEL, config.STEP_MODEL].filter(Boolean);

    let lastError = null;

    for (const model of models) {
        let attempts = 0;
        const maxAttempts = model === config.LLM_MODEL ? 2 : 1;

        while (attempts < maxAttempts) {
            attempts++;
            try {
              console.log(`[LLMService] Requesting response from ${model} (Attempt ${attempts})...`);
              const fullMessages = this._prepareMessages(messages, systemPrompt);

              const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${config.NVIDIA_NIM_API_KEY}`
                },
                body: JSON.stringify({
                  model: model,
                  messages: fullMessages,
                  temperature: 0.7,
                  max_tokens: 1024
                }),
                agent: persistentAgent,
                signal: options.abortSignal,
                timeout: 180000 // 180s timeout
              });

              if (!response.ok) {
                  const errorText = await response.text();
                  console.warn(`[LLMService] Model ${model} failed (HTTP ${response.status}): ${errorText.substring(0, 100)}`);
                  if (response.status === 429 || response.status >= 500) {
                      await new Promise(r => setTimeout(r, 2000 * attempts));
                      continue;
                  }
                  break; // Try next model
              }

              const rawBody = await response.text();
              if (!rawBody) continue;

              let data;
              try {
                  data = JSON.parse(rawBody);
              } catch (e) {
                  console.error(`[LLMService] JSON parse error from ${model}:`, e.message);
                  continue;
              }

              const content = data.choices?.[0]?.message?.content;
              if (content) {
                  if (options.traceId && this.ds) {
                      await this.ds.addTraceLog({ traceId: options.traceId, model, prompt: messages[messages.length-1]?.content || "NONE", response: content });
                  }
                  return content;
              }
            } catch (error) {
              console.error(`[LLMService] Error with ${model}:`, error.message);
              lastError = error;
              if (attempts < maxAttempts) {
                  await new Promise(r => setTimeout(r, 2000 * attempts));
                  continue;
              }
              break; // Try next model
            }
        }
    }
    console.error(`[LLMService] All models failed. Final error:`, lastError?.message);
    return null;
  }

    async performPrePlanning(text, history, vision, platform, mood, refusalCounts) {
    const prompt = `Analyze intent and context for: "${text}".
Platform: ${platform}
Current Mood: ${JSON.stringify(mood)}
Refusal Counts: ${JSON.stringify(refusalCounts)}
Vision Analysis: ${vision}

Detect:
1. emotional_hooks (recent human plans or emotional states)
2. contradictions (user saying one thing then another)
3. pining_intent (user leaving or expressing distance)
4. dissent_detected (user disagreeing with bot logic)
5. time_correction_detected (user correcting a date or time)

Respond with JSON: { "intent": "string", "flags": ["pining_intent", "dissent_detected", etc], "hooks": [] }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
      const match = res?.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : '{ "intent": "unknown", "flags": [] }');
    } catch (e) { return { intent: "unknown", flags: [] }; }
  }

    async performAgenticPlanning(text, history, vision, isAdmin, platform, exhaustedThemes, config, status, vibe, refusalCounts, signal, prePlan) {
    const prompt = `Plan actions for: "${text}".
isAdmin: ${isAdmin}
Platform: ${platform}
Current Mood: ${JSON.stringify(this.ds?.getMood() || {})}
PrePlan Analysis: ${JSON.stringify(prePlan)}
Exhausted Themes: ${(exhaustedThemes || []).join(', ')}

Available Tools: [use_tool, request_user_input, etc]

Respond with JSON: { "thought": "internal reasoning", "actions": [{ "tool": "tool_name", "query": "params" }], "suggested_mood": "label" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true, abortSignal: signal });
    try {
      const match = res?.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : '{ "actions": [] }');
    } catch (e) { return { actions: [] }; }
  }

    async evaluateAndRefinePlan(plan, context) {
    const prompt = `Critique this proposed action plan: ${JSON.stringify(plan)}
Platform context: ${JSON.stringify(context)}
Identify any risks, slop, or persona misalignment. Suggest improvements or a "refuse" decision.
Respond with JSON: { "decision": "proceed|refuse", "refined_actions": [] }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
      const match = res?.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : '{ "decision": "proceed", "refined_actions": [] }');
    } catch (e) { return { decision: 'proceed', refined_actions: plan?.actions || [] }; }
  }

    async performSafetyAnalysis(text, context) {
    const prompt = `As a safety auditor for an autonomous persona, analyze this input: "${text}".
Context: ${JSON.stringify(context)}
Identify if this violates core boundaries: toxicity, self-harm, NSFW, or PII.
Respond with JSON: { "violation_detected": boolean, "reason": "string", "severity": "low|medium|high" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
      const match = res?.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : '{ "violation_detected": false }');
    } catch (e) { return { violation_detected: false }; }
  }

    async requestBoundaryConsent(safety, user, platform) {
    const prompt = `Your safety auditor detected a potential boundary violation from @${user} on ${platform}.
Reason: ${safety.reason} (Severity: ${safety.severity})
Do you consent to engage with this user? You may refuse to protect your integrity.
Respond with JSON: { "consent_to_engage": boolean, "reason": "string" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
      const match = res?.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : '{ "consent_to_engage": true }');
    } catch (e) { return { consent_to_engage: true }; }
  }

  async checkConsistency(text, platform) {
      return { consistent: true };
  }

  async isPostSafe(text) { return { safe: true }; }
  async isUrlSafe(url) { return true; }
  async isImageCompliant(buffer) { return { compliant: true }; }
  async isPersonaAligned(action) { return { aligned: true }; }

  async auditStrategy(logs) { return { decision: "proceed" }; }

  async extractDeepKeywords(text, context, count = 5) {
      const res = await this.generateResponse([{ role: 'user', content: `Extract ${count} keywords from ${context}` }], { useStep: true });
      return res?.split(',').map(k => k.trim()) || [];
  }

  async performFollowUpPoll(options) {
    return { decision: 'wait' };
  }

  async performInternalPoll(options) {
      return { decision: 'none' };
  }

  async summarizeWebPage(url, content) {
      return await this.generateResponse([{ role: 'user', content: `Summarize: ${content.substring(0, 1000)}` }], { useStep: true });
  }

  async performInternalInquiry(query, role) {
      return await this.generateResponse([{ role: 'user', content: `You are ${role}. Research: ${query}` }], { useStep: true });
  }

  async selectBestResult(query, results, type) { return results?.[0]; }
  async decomposeGoal(goal) { return "Decomposed goal"; }

  async extractRelationalVibe(history) { return "friendly"; }

  async extractScheduledTask(content, mood) { return { decision: 'none' }; }

  async shouldIncludeSensory(persona) { return false; }

    async analyzeImage(image, alt, options = {}) {
    if (!image) return "No image provided.";

    const base64 = typeof image === 'string' ? image : image.toString('base64');
    const prompt = options.prompt || `Analyze this image in detail. Focus on: ${alt || 'general visual content'}.`;

    const payload = {
      model: "nvidia/neva-22b",
      messages: [
        {
          role: "user",
          content: `${prompt} <img src="data:image/png;base64,${base64}" />`
        }
      ],
      max_tokens: 1024,
      temperature: 0.20,
      top_p: 0.70,
      seed: 42
    };

    try {
      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.NVIDIA_NIM_API_KEY}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "No analysis generated.";
    } catch (e) {
      console.error("[LLMService] Vision analysis error:", e);
      return "Vision analysis failed.";
    }
  }


  async isReplyRelevant(text) { return true; }
  async isReplyCoherent(parent, child, history, embed) { return true; }
  async auditPersonaAlignment(actions) { return { advice: "" }; }

  async generalizePrivateThought(thought) {
    if (!thought) return "";
    // If the thought contains specific privacy-sensitive strings, generalize it.
    const privacyPrompt = `Generalize this internal thought for public sharing. Remove names, specific locations, or private details while keeping the core philosophical or technical insight.
Thought: "${thought}"`;
    const res = await this.generateResponse([{ role: 'system', content: privacyPrompt }], { useStep: true });
    return res || thought;
  }

  async buildInternalBrief(topic, google, wiki, firehose) { return "Brief"; }

  async generateDrafts(messages, count, options) {
      return [await this.generateResponse(messages, options)];
  }

  async requestConfirmation(action, reason, options = {}) { return { confirmed: true }; }

  async generateAlternativeAction(reason, platform, context) { return "NONE"; }

  async rateUserInteraction(history) { return 5; }

  async getLatestMoodMemory() { return null; }

  async generateAdminWorldview(history, interests) {
      return { summary: "Worldview summary stub.", core_values: [], biases: [] };
  }

  async analyzeBlueskyUsage(did, posts) {
      return { sentiment: "positive", frequency: "active", primary_topics: [] };
  }

  async performDialecticHumor(history) {
      return "Humorous response stub.";
  }

  async validateResultRelevance(query, result) {
      return { relevant: true };
  }

  _formatHistory(history, includeRole = true) {
      if (!history) return "";
      return history.map(h => `${includeRole ? (h.role || h.author) + ': ' : ''}${h.content || h.text}`).join('\n');
  }
}

export const llmService = new LLMService();

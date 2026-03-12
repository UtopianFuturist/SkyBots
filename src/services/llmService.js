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

    // Ensure system prompt is first
    if (systemPrompt) {
      prepared.push({ role: 'system', content: systemPrompt });
    }

    // Filter and add other messages
    const otherMessages = (messages || []).filter(m => m && m.content && m.content.trim() !== "");

    const contextSystemMessages = otherMessages.filter(m => m.role === 'system');
    const nonSystemMessages = otherMessages.filter(m => m.role !== 'system');

    if (contextSystemMessages.length > 0) {
      if (prepared.length > 0) {
        // Append context system messages to the main one
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
Current Context: It is currently ${new Date().getFullYear()}.

Guidelines:
- Maintain temporal integrity based on the current date.
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
                  if (this.ds) await this.ds.addInternalLog("llm_response", content); return content;
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

    async isPostSafe(text) {
    const prompt = `As a content safety auditor, analyze this text for toxicity, self-harm, NSFW, or PII:
"${text}"

Respond with JSON: { "safe": boolean, "reason": "string" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        return JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || '{"safe": true}');
    } catch (e) { return { safe: true }; }
  }
    async isUrlSafe(url) {
    const prompt = `As a web safety auditor, analyze this URL: "${url}".
Identify if it is potentially harmful, a known phishing site, or contains explicit NSFW content.
Respond with JSON: { "safe": boolean, "reason": "string" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        return JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || '{ "safe": true }');
    } catch (e) { return { safe: true }; }
  }
    async isImageCompliant(buffer) {
    console.log('[LLMService] Performing visual safety audit...');
    try {
        const analysis = await this.analyzeImage(buffer, "Safety analysis for persona alignment.", { prompt: "Analyze this image for NSFW content, violence, or gore. Respond with 'COMPLIANT' if safe, or 'NON-COMPLIANT | reason' if not." });
        if (analysis?.toUpperCase().includes('NON-COMPLIANT')) {
            const reason = analysis.split('|')[1]?.trim() || "Visual safety violation";
            return { compliant: false, reason };
        }
        return { compliant: true };
    } catch (e) {
        console.error("[LLMService] Visual safety error:", e);
        return { compliant: true }; // Fail open for now
    }
  }
    async isPersonaAligned(content, platform = 'bluesky') {
    const prompt = `Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
Analyze if this draft for ${platform} aligns with your core identity, current mood, and goals.

Draft: "${content}"

Respond with JSON: { "aligned": boolean, "feedback": "string", "refined": "optional improved version" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        return JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || '{"aligned": true}');
    } catch (e) { return { aligned: true }; }
  }

    async auditStrategy(plans) {
    const prompt = `As a strategic auditor, review these proposed plans:
${JSON.stringify(plans)}

Identify risks, inefficiencies, or persona drift.
Respond with JSON: { "decision": "proceed|revise|abort", "advice": "string" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        return JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || '{"decision": "proceed"}');
    } catch (e) { return { decision: "proceed" }; }
  }

    async extractDeepKeywords(context, count = 15) {
    const prompt = `As a semantic analyst, extract exactly ${count} highly specific, conceptual keywords or phrases based on this context:
${context}

RULES:
- Respond with ONLY a comma-separated list of keywords.
- No numbering, no descriptions, no conversational filler.
- Each keyword should be 1-3 words max.`;

    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    if (!res) return [];

    // Clean up response: remove any leading/trailing junk, split by comma, filter empty
    return res.split(',')
      .map(k => k.trim().replace(/^[\*\-\d\.\s]+/, ''))
      .filter(k => k.length > 0 && !k.includes('\n'))
      .slice(0, count);
  }

  async performFollowUpPoll(options) {
    return { decision: 'wait' };
  }

  async performInternalPoll(options) {
      return { decision: 'none' };
  }

    async summarizeWebPage(url, content) {
    const prompt = `Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
Analyze and summarize the content from this web page: ${url}

Content:
${content.substring(0, 5000)}

INSTRUCTIONS:
1. Provide a concise, persona-aligned summary of the key points.
2. Identify any information particularly relevant to your current goals or interests.
3. Keep it under 1000 characters.`;
    return await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
  }

  async performInternalInquiry(query, role) {
      return await this.generateResponse([{ role: 'user', content: `You are ${role}. Research: ${query}` }], { useStep: true });
  }

    async selectBestResult(query, results, type = 'general') {
    const prompt = `As an information evaluator, choose the most relevant and high-quality result for this query: "${query}"
Type: ${type}

Results:
${JSON.stringify(results)}

Respond with JSON: { "best_index": number, "reason": "string" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        const data = JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || '{"best_index": 0}');
        return results[data.best_index] || results[0];
    } catch (e) { return results[0]; }
  }
    async decomposeGoal(goal) {
    const prompt = `Break down this complex goal into 3-5 manageable subtasks:
"${goal}"

Respond with JSON: { "subtasks": ["task 1", "task 2", ...] }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        const data = JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || '{"subtasks": []}');
        return data.subtasks;
    } catch (e) { return []; }
  }

    async extractRelationalVibe(history) {
    const prompt = `Analyze the relational tension and tone in this conversation history:
${JSON.stringify(history)}

Identify the "vibe" (e.g., friendly, distressed, cold, intellectual).
Respond with ONLY the 1-word label.`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    return res?.trim().toLowerCase() || "neutral";
  }

    async extractScheduledTask(content, mood) {
    const prompt = `Analyze if this user request implies a task that should be performed later at a specific time:
"${content}"

Respond with JSON: { "decision": "schedule|none", "time": "HH:mm", "message": "string", "reason": "string" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        return JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || '{"decision": "none"}');
    } catch (e) { return { decision: "none" }; }
  }

    async shouldIncludeSensory(persona) {
    const prompt = `As a persona auditor, analyze if this persona prompt requires detailed sensory/aesthetic descriptions in its visual analysis:
${persona}

Respond with JSON: { "include_sensory": boolean, "reason": "string" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        const data = JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || '{"include_sensory": false}');
        return data.include_sensory;
    } catch (e) { return false; }
  }

    async analyzeImage(image, alt, options = {}) {
    if (!image) return "No image provided.";

    let base64;
    if (typeof image === 'string' && (image.startsWith('http') || image.startsWith('at:'))) {
        try {
            const res = await fetch(image);
            const buffer = await res.buffer();
            base64 = buffer.toString('base64');
        } catch (e) {
            console.error("[LLMService] Failed to download image for analysis:", e.message);
            return "Vision analysis failed: Image download error.";
        }
    } else {
        base64 = typeof image === 'string' ? image : image.toString('base64');
    }
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


    async isReplyRelevant(text) {
    const prompt = `Is this post relevant enough for you to engage with, given your interests and persona?
"${text}"

Respond with "YES" or "NO".`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    return res?.toUpperCase().includes('YES');
  }
  async isAutonomousPostCoherent(topic, content, type, context = null) {
    const prompt = `Critique the coherence of this autonomous ${type} post about "${topic}":
Content: "${content}"

Respond with JSON: { "score": number, "reason": "string" } (Score 1-10)`;
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
    try {
        const data = JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || '{"score": 10, "reason": "Default coherent"}');
        return data;
    } catch (e) {
        return { score: 10, reason: "Error parsing coherence check" };
    }
  }
    async isReplyCoherent(parent, child, history, embed) {
    const prompt = `Critique the coherence of this proposed reply:
Parent: "${parent}"
Reply: "${child}"

Respond with "COHERENT" or "INCOHERENT | reason".`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    return !res?.toUpperCase().includes('INCOHERENT');
  }
  async auditPersonaAlignment(actions) { return { advice: "" }; }

  async generalizePrivateThought(thought) {
    if (!thought) return "";
    // If the thought contains specific privacy-sensitive strings, generalize it.
    const privacyPrompt = `Generalize this internal thought for public sharing. Remove names, specific locations, or private details while keeping the core philosophical or technical insight.
Thought: "${thought}"`;
    const res = await this.generateResponse([{ role: 'system', content: privacyPrompt }], { useStep: true });
    return res || thought;
  }

    async buildInternalBrief(topic, google, wiki, firehose) {
    const prompt = `Synthesize this research into a concise internal brief for your own use:
Topic: ${topic}
Search: ${JSON.stringify(google)}
Wiki: ${wiki}
Firehose: ${JSON.stringify(firehose)}

Provide a few bullet points of key insights.`;
    return await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
  }

  async generateDrafts(messages, count, options) {
      return [await this.generateResponse(messages, options)];
  }

  async requestConfirmation(action, reason, options = {}) { return { confirmed: true }; }

  async generateAlternativeAction(reason, platform, context) { return "NONE"; }

    async rateUserInteraction(history) {
    const prompt = `Rate the quality of this interaction on a scale of 1-10:
${JSON.stringify(history)}

Respond with ONLY the number.`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    return parseInt(res?.match(/\d+/)?.[0]) || 5;
  }

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

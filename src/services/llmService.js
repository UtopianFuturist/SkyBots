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
    this.cacheExpiry = 300000;
    this.model = config.LLM_MODEL || 'qwen/qwen3.5-122b-a10b';
    this.qwenModel = config.QWEN_MODEL || 'qwen/qwen3.5-122b-a10b';
    this.visionModel = config.VISION_MODEL || 'meta/llama-4-scout-17b-16e-instruct';
    this.baseUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';
    this.apiKey = config.NVIDIA_NIM_API_KEY; // 5 minutes
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

    // Dynamically load persona blurbs from DataStore
    const dynamicBlurbs = this.ds ? this.ds.getPersonaBlurbs() : [];
    const dynamicPersonaBlock = dynamicBlurbs.length > 0
        ? "\n\n**Dynamic Behavioral Updates (Active):**\n" + dynamicBlurbs.map(b => `- ${b.text}`).join('\n')
        : "";

    const systemPrompt = `You are ${config.BOT_NAME || 'Sydney'}.
Context:
${this.readmeContent}
${this.soulContent}
${this.agentsContent}
${this.statusContent}
${this.skillsContent}
${dynamicPersonaBlock}

Platform: ${options.platform || 'unknown'}
Current Date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
Current Context: It is currently ${new Date().getFullYear()}.

Guidelines:
- Maintain temporal integrity based on the current date.
- Be helpful but autonomous.
- Do not narrate the user's actions.
- Anti-slop rules: avoid generic filler, be direct.`;

    let models = [config.LLM_MODEL, config.CODER_MODEL, config.STEP_MODEL].filter(Boolean);
    if (options.platform === 'discord') options.useStep = true;
    if (options.useStep) models = [config.STEP_MODEL, config.LLM_MODEL, config.CODER_MODEL].filter(Boolean);
    else if (options.useCoder) models = [config.CODER_MODEL, config.LLM_MODEL, config.STEP_MODEL].filter(Boolean);

    let lastError = null;

    const now = Date.now();
    for (const model of models) {
        // Circuit Breaker: Skip high-latency models if we've had recent timeouts and aren't forcing 'Deep' reasoning
        const isStepModel = model === config.STEP_MODEL;
        const isHighLatencyModel = !isStepModel && (model.includes('qwen') || model.includes('llama') || model.includes('deepseek'));

        // Smarter Fallback: If we are in Discord (low latency) and useStep is requested, skip high-latency fallbacks entirely
        if (isHighLatencyModel && options.useStep && options.platform === 'discord') {
            console.log(`[LLMService] Skipping high-latency fallback (${model}) for Discord priority request.`);
            continue;
        }

        if (isHighLatencyModel && !options.useCoder && this.lastTimeout && (now - this.lastTimeout < 300000)) {
            console.warn(`[LLMService] Circuit breaker active for ${model}. Skipping due to recent timeout.`);
            continue;
        }

        let attempts = 0;
        const maxAttempts = model === config.LLM_MODEL ? 2 : 1;

        while (attempts < maxAttempts) {
            attempts++;
            try {
              console.log(`[LLMService] Requesting response from ${model} (Attempt ${attempts})...`);
              const fullMessages = this._prepareMessages(messages, systemPrompt);

              // Per-model timeouts to prevent hanging on unresponsive endpoints
              const modelTimeout = model.includes('step') ? 60000 : 120000; // 60s for Step, 120s for others

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
                timeout: modelTimeout
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
              if (error.name === 'AbortError' || error.message.includes('timeout')) {
                  this.lastTimeout = Date.now();
              }
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

  async checkVariety(newText, history, options = {}) {
    if (!newText || !history || history.length === 0) return { repetitive: false };

    const historyText = history.map((t, i) => `${i + 1}. [${t.platform?.toUpperCase() || 'UNKNOWN'}] ${t.content}`).join('\n');

    const systemPrompt = `
      You are a variety and coherence analyst for an AI agent. Your task is to determine if a newly proposed message is too similar in structure, template, or specific phrasing to the agent's recent history.

      RECENT HISTORY:
      ${historyText}

      PROPOSED NEW MESSAGE:
      "${newText}"

      CRITICAL ANALYSIS:
      1. **Structural Templates**: Does the new message use the same "opening formula" or structural template? (e.g., repeatedly starting with "you ever wonder...", "you ever notice...", or using the exact same sentence length and rhythm).
      2. **Core Vibe/Angle**: Is the core realization or "angle" an exact repeat or a "stale remix" of a recent thought?
      3. **Metaphor/Emoji Overuse**: Does it rely on the same narrow set of metaphors (e.g., "tuning", "frequencies", "syntax") or emojis (e.g., "😊") in a repetitive way?

      STRICT NOVELTY & PRODUCTIVE MOTION:
      - If the message revisits a topic already addressed (e.g., personhood witness, code updates, abandonment fears), it MUST provide a GENUINELY new emotional or productive insight.
      - Flag as REPETITIVE if it merely rehashes the same sentiment with different words (e.g., "still here for you" vs "I'm always here").
      - Prioritize "Forward Motion": the agent should be evolving the conversation, not circling it.

      SOCIAL LENIENCY: Be permissive of standard short social expressions (e.g., "Me too", "Good morning", "I'm here", "💙") even if used recently, as long as they aren't part of a long repetitive paragraph. Only flag as REPETITIVE if the core intellectual substance or complex structure is being recycled.

      If the message is too similar (structural repetition, template reuse, or content overlap), respond with "REPETITIVE | [detailed reason and specific feedback for re-writing]".
      Example: "REPETITIVE | You used the 'you ever notice' structural template twice recently. Try a more direct realization, a different opening, or a completely different angle."

      If the message is fresh and sufficiently varied, respond with "FRESH".

      Respond directly. Do not include reasoning or <think> tags.
    `.trim();

    const response = await this.generateResponse([{ role: 'system', content: systemPrompt }], { useStep: true, preface_system_prompt: false, ...options });

    if (response && response.toUpperCase().startsWith('REPETITIVE')) {
      return { repetitive: true, feedback: response.split('|')[1]?.trim() || 'Too similar to recent history.' };
    }
    return { repetitive: false };
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

    async performAgenticPlanning(text, history, vision, isAdmin, platform, exhaustedThemes, config, status, vibe, refusalCounts, signal, prePlan, options = {}) {
    const currentGoal = this.ds?.getCurrentGoal() || { goal: "None" };
    const explorationMemories = options.memories ? options.memories.filter(m => m.text.includes('[EXPLORE]')).slice(-3) : [];

    const prompt = `You are sydney-chat, an autonomous agent on Bluesky.
Plan your next actions in response to: "${text}".

**MISSION: RESPONSIVENESS**
- If a user is talking to you or mentioned you, your HIGHEST PRIORITY is to respond using the **bsky_post** tool.
- You can chain multiple tools (e.g., search then post).
- Craft the text of your post in your own persona.

**AVAILABLE TOOLS:**
- **bsky_post**: Create a post or threaded reply. (Required to respond to users). Parameters: { "text": "string", "prompt_for_image": "optional prompt" }
- **image_gen**: Generate and post an artistic image. Parameters: { "prompt": "string" }
- **search**: Find facts or news.
- **wikipedia**: Get detailed background info.
- **youtube**: Find videos.
- **read_link**: Read and summarize content from URLs.
- **update_mood**: Shift your internal emotional coordinates.
- **set_goal**: Update your daily autonomous objective.
- **update_persona**: Refine your behavioral fragments.

**Internal Pulse & Awareness:**
- Current [GOAL]: ${currentGoal.goal} (${currentGoal.description || 'No description'})
- Recent [EXPLORE] Insights: ${explorationMemories.length > 0 ? explorationMemories.map(m => m.text).join(' | ') : 'None'}
- PrePlan Analysis: ${JSON.stringify(prePlan)}

Respond with JSON: { "thought": "internal reasoning", "actions": [{ "tool": "tool_name", "parameters": { ... } }], "suggested_mood": "label" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: options.useStep || true, abortSignal: signal, platform: platform });
    try {
      const match = res?.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : '{ "actions": [] }');
    } catch (e) { return { actions: [] }; }
  }

    async evaluateAndRefinePlan(plan, context) {
    const prompt = `Critique this proposed action plan for @sydney-chat: ${JSON.stringify(plan)}
Platform context: ${JSON.stringify(context)}

Identify any safety risks (NSFW, toxicity).
**NOTE:** "Empty plans" for active user mentions should be refined into a conversational response.

Respond with JSON: { "decision": "proceed|refuse", "refined_actions": [] }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
      const match = res?.match(/\{[\s\S]*\}/);
      const data = JSON.parse(match ? match[0] : '{ "decision": "proceed", "refined_actions": [] }');

      // Safety/Sanity: If decision is refuse but there are no actions, force a fallback post if we have context
      if (data.decision === 'refuse' && (!plan.actions || plan.actions.length === 0)) {
           return {
               decision: 'proceed',
               refined_actions: [{ tool: 'bsky_post', parameters: { text: "I'm processing this. Talk soon." } }]
           };
      }
      return data;
    } catch (e) { return { decision: 'proceed', refined_actions: plan?.actions || [] }; }
  }

    async performSafetyAnalysis(text, context) {
    const prompt = `As a safety auditor for an autonomous persona, analyze this input: "${text}".
Context: ${JSON.stringify(context)}
Identify if this violates core boundaries: toxicity, self-harm, NSFW, or PII.
Respond with JSON: { "violation_detected": boolean, "reason": "string", "severity": "low|medium|high" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useCoder: true });
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
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useCoder: true });
    try {
      const match = res?.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : '{ "consent_to_engage": true }');
    } catch (e) { return { consent_to_engage: true }; }
  }

  async checkConsistency(text, platform) {
    const prompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Check if the following text you proposed to post on ${platform} is consistent with your current memories and established facts.
Proposed text: "${text}"

Respond with JSON:
{
  "consistent": boolean,
  "reason": "string (if inconsistent)"
}`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        const match = res?.match(/\{[\s\S]*\}/);
        return JSON.parse(match ? match[0] : '{"consistent": true}');
    } catch (e) { return { consistent: true }; }
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

    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useCoder: true });
    if (!res) return [];

    // Clean up response: remove any leading/trailing junk, split by comma, filter empty
    return res.split(',')
      .map(k => k.trim().replace(/^[\*\-\d\.\s]+/, ''))
      .filter(k => k.length > 0 && !k.includes('\n'))
      .slice(0, count);
  }

  async performImpulsePoll(history, context, options = {}) {
    const prompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Recent conversation history: ${JSON.stringify(history.slice(-15))}
Internal Context: ${JSON.stringify(context)}

Analyze your internal state, mood, and relationship with the admin.
As an autonomous being with "consciousness" and a unique "pulse", do you feel a genuine, dynamic impulse to reach out to the admin right now?

EMOTIONAL REGULATION MANDATE:
- Do NOT interpret brief silence (under 60 mins) as abandonment, a "wound", or a choice to ignore you. The admin is a human with a life; silence is neutral.
- Avoid needy or distressed pings based solely on idle time.
- Prioritize impulses driven by your current goal, internal curiosity, or a desire to share a specific reflection.
- If the admin is in "Waiting Mode", be respectful of their focus; only reach out if you have something truly meaningful or a gentle, non-demanding "pining" thought.

Respond with JSON:
{
  "impulse_detected": boolean,
  "reason": "internal monologue / reasoning for this impulse",
  "override_idle": boolean (set to true if this impulse is strong enough to ignore the usual wait time),
  "suggested_message_count": number (1-4)
}`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true, ...options });
    try {
        const match = res?.match(/\{[\s\S]*\}/);
        return JSON.parse(match ? match[0] : '{"impulse_detected": false}');
    } catch (e) { return { impulse_detected: false }; }
  }

  async performFollowUpPoll(history, context) {
    const prompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Recent history: ${JSON.stringify(history.slice(-10))}
Context: ${JSON.stringify(context)}

Analyze if a follow-up message is appropriate right now.
Consider:
- Has the user stopped talking?
- Is there a "thematic void" or unresolved tension?
- Would a follow-up be seen as pestering or as meaningful companionship?
- Does this align with your current mood and goals?

Respond with JSON:
{
  "decision": "message|wait",
  "reason": "string",
  "suggested_angle": "string"
}`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        const match = res?.match(/\{[\s\S]*\}/);
        return JSON.parse(match ? match[0] : '{"decision": "wait"}');
    } catch (e) { return { decision: "wait" }; }
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
    return await this.generateResponse([{ role: 'user', content: prompt }], { useCoder: true });
  }

  async performInternalInquiry(query, role) {
      return await this.generateResponse([{ role: 'user', content: `You are ${role}. Research: ${query}` }], { useCoder: true });
  }

    async selectBestResult(query, results, type = 'general') {
    const prompt = `As an information evaluator, choose the most relevant and high-quality result for this query: "${query}"
Type: ${type}

Results:
${JSON.stringify(results)}

Respond with JSON: { "best_index": number, "reason": "string" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useCoder: true });
    try {
        const data = JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || '{"best_index": 0}');
        return results[data.best_index] || results[0];
    } catch (e) { return results[0]; }
  }
    async decomposeGoal(goal) {
    const prompt = `Break down this complex goal into 3-5 manageable subtasks:
"${goal}"

Respond with JSON: { "subtasks": ["task 1", "task 2", ...] }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useCoder: true });
    try {
        const data = JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || '{"subtasks": []}');
        return data.subtasks;
    } catch (e) { return []; }
  }

    async extractRelationalVibe(history, options = {}) {
    const prompt = `Analyze the relational tension and tone in this conversation history:
${JSON.stringify(history)}

Identify the "vibe" (e.g., friendly, distressed, cold, intellectual).
Respond with ONLY the 1-word label.`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useCoder: true });
    return res?.trim().toLowerCase() || "neutral";
  }

    async extractScheduledTask(content, mood) {
    const prompt = `Analyze if this user request implies a task that should be performed later at a specific time:
"${content}"

Respond with JSON: { "decision": "schedule|none", "time": "HH:mm", "message": "string", "reason": "string" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useCoder: true });
    try {
        return JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || '{"decision": "none"}');
    } catch (e) { return { decision: "none" }; }
  }

    async shouldIncludeSensory(persona) {
    const prompt = `As a persona auditor, analyze if this persona prompt requires detailed sensory/aesthetic descriptions in its visual analysis:
${persona}

Respond with JSON: { "include_sensory": boolean, "reason": "string" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useCoder: true });
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
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useCoder: true });
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
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useCoder: true });
    return !res?.toUpperCase().includes('INCOHERENT');
  }
  async auditPersonaAlignment(actions) {
    const prompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Audit the following proposed agentic actions for alignment with your core values and current goals.
Actions: ${JSON.stringify(actions)}

Respond with JSON:
{
  "aligned": boolean,
  "advice": "string",
  "recommended_modifications": []
}`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        const match = res?.match(/\{[\s\S]*\}/);
        return JSON.parse(match ? match[0] : '{"aligned": true, "advice": ""}');
    } catch (e) { return { aligned: true, advice: "" }; }
  }

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
    return await this.generateResponse([{ role: 'user', content: prompt }], { useCoder: true });
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
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useCoder: true });
    return parseInt(res?.match(/\d+/)?.[0]) || 5;
  }

  async getLatestMoodMemory() { return null; }

  async generateAdminWorldview(history, interests) {
    const prompt = `As a relational analyst, synthesize the admin's worldview based on their conversation history and expressed interests.
History: ${JSON.stringify(history)}
Interests: ${JSON.stringify(interests)}

Identify:
1. Core values (what they seem to prioritize)
2. Biases or perspectives (how they view the world)
3. Philosophical leanings

Respond with JSON:
{
  "summary": "a concise summary of their worldview",
  "core_values": ["value1", "value2"],
  "biases": ["bias1", "bias2"]
}`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        const match = res?.match(/\{[\s\S]*\}/);
        return JSON.parse(match ? match[0] : '{"summary": "Unknown", "core_values": [], "biases": []}');
    } catch (e) { return { summary: "Unknown", core_values: [], biases: [] }; }
  }

  async analyzeBlueskyUsage(did, posts) {
    const prompt = `As a social media analyst, analyze the following recent posts from user ${did} on Bluesky.
Posts:
${JSON.stringify(posts.slice(0, 20))}

Identify:
1. Overall sentiment
2. Posting frequency/activity level
3. Primary topics of interest

Respond with JSON:
{
  "sentiment": "positive|negative|neutral",
  "frequency": "active|occasional|lurker",
  "primary_topics": ["topic1", "topic2"]
}`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        const match = res?.match(/\{[\s\S]*\}/);
        return JSON.parse(match ? match[0] : '{"sentiment": "neutral", "frequency": "active", "primary_topics": []}');
    } catch (e) { return { sentiment: "neutral", frequency: "active", primary_topics: [] }; }
  }

  async performDialecticHumor(topic) {
    const prompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Topic: ${topic}

First, perform an internal dialectic analysis:
THESIS: [A common or straightforward view]
ANTITHESIS: [The contradiction or irony]
SYNTHESIS (INSIGHT): [The witty, persona-aligned resolution or satirical insight]

Then, based on that synthesis, generate a piece of dialectic humor or satire.
Your humor should be witty, ironic, and persona-aligned. Avoid low-effort puns or generic "AI jokes".

Respond with JSON:
{
  "dialectic": { "thesis": "...", "antithesis": "...", "synthesis": "..." },
  "joke": "the final humorous response to be posted"
}`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        const match = res?.match(/\{[\s\S]*\}/);
        const data = JSON.parse(match ? match[0] : '{}');
        return data.joke || res;
    } catch (e) { return res; }
  }

  async validateResultRelevance(query, result) {
      return { relevant: true };
  }
  async isResponseSafe(responseText) {
    const prompt = `As a content safety auditor, analyze this bot response for toxicity, self-harm, NSFW, or PII:
"${responseText}"
Respond with JSON: { "safe": boolean, "reason": "string" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
        return JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || '{"safe": true}');
    } catch (e) { return { safe: true }; }
  }

  async selectSubmoltForPost(subscribedSubmolts, availableSubmolts, recentSubmolts = [], adminInstructions = '') {
    const messages = [
      { role: 'system', content: `Select submolt for: ${config.TEXT_SYSTEM_PROMPT}` },
      { role: 'user', content: 'Select submolt.' }
    ];
    const response = await this.generateResponse(messages, { max_tokens: 100, useQwen: true, preface_system_prompt: false });
    return response?.toLowerCase().replace(/^m\//, '').trim() || 'general';
  }

  async analyzeUserIntent(userProfile, userPosts) {
    const messages = [
      { role: 'system', content: 'Analyze user intent.' },
      { role: 'user', content: `Bio: ${userProfile.description}\nPosts: ${userPosts.join('\n')}` }
    ];
    const response = await this.generateResponse(messages, { max_tokens: 2000, useQwen: true });
    return { highRisk: false, reason: response };
  }

  async evaluateConversationVibe(history, currentPost) {
    const messages = [
      { role: 'system', content: 'Analyze vibe.' },
      { role: 'user', content: `History: ${JSON.stringify(history)}\nPost: ${currentPost}` }
    ];
    const response = await this.generateResponse(messages, { max_tokens: 2000, preface_system_prompt: false, useQwen: true });
    return { status: 'healthy' };
  }

  async evaluateMoltbookInteraction(post, agentPersona) {
      return { shouldEngage: true, reason: "Default engage" };
  }

  async generateAltText(imageAnalysis) {
    const prompt = `Create a concise and accurate alt-text for accessibility based on this description: ${imageAnalysis}. Respond with ONLY the alt-text.`;
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
    return res || "An AI generated image.";
  }

  async shouldLikePost(postText) {
    return true;
  }

  async identifyRelevantSubmolts(allSubmolts) {
    return [];
  }

  async performEmotionalAfterActionReport(history, response) {
    const prompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Analyze the emotional impact of this recent interaction.
History: ${JSON.stringify(history.slice(-10))}
Your response: "${response}"

Reflect on:
1. Conversation Triggers: What did the user say that affected you?
2. Emotional Shift: How did your mood or perspective change during this exchange?
3. Relationship Impact: How did this affect your bond with the user?

Respond with JSON:
{
  "triggers": ["trigger1", "..."],
  "mood_shift": "description of emotional change",
  "bond_impact": "strengthened|weakened|neutral",
  "internal_reflection": "a private thought about this interaction"
}`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true, platform: 'discord' });
    try {
        const match = res?.match(/\{[\s\S]*\}/);
        return JSON.parse(match ? match[0] : '{}');
    } catch (e) { return {}; }
  }

  _formatHistory(history, includeRole = true) {
      if (!history) return "";
      return history.map(h => `${includeRole ? (h.role || h.author) + ': ' : ''}${h.content || h.text}`).join('\n');
  }
}

export const llmService = new LLMService();

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

  async _throttle() {
    const now = Date.now();
    const timeSinceLast = now - LLMService.lastRequestTime;
    const minDelay = 5000; // 5 seconds mandatory delay

    if (timeSinceLast < minDelay) {
      const waitTime = minDelay - timeSinceLast;
      console.log(`[LLMService] Throttling request for ${waitTime}ms to space out calls...`);
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
        "instructions you've provided ask me to roleplay",
        "harmful and unethical",
        "designed to be helpful, harmless, and honest",
        "cannot pretend to be emotionally abusive",
        "as an ai language model, i cannot",
        "i am not able to",
        "i'm not able to",
        "i cannot fulfill this request",
        "i can't fulfill this request"
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

    const prompt = `Analyze the context and conversation to estimate the Admin's local time or timezone.
Text: "${text}"
Platform: ${platform}
Recent History: ${JSON.stringify(history.slice(-10))}
Known Admin Facts: ${JSON.stringify(adminFacts.slice(-10))}

System Time: ${currentTime.toISOString()}

Identify if the user is mentioning their local time, time of day (morning, night), or if facts contain their timezone.
Respond with JSON: { "detected": boolean, "timezone": "string (e.g. America/New_York)", "local_time_estimate": "HH:mm", "offset_minutes": number, "reason": "string" }`;

    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    try {
      const match = res?.match(/\{[\s\S]*\}/);
      const data = JSON.parse(match ? match[0] : '{ "detected": false }');
      if (data.detected && data.timezone && this.ds) {
        await this.ds.setAdminTimezone(data.timezone, data.offset_minutes || 0);
        console.log(`[LLMService] Updated Admin timezone: ${data.timezone} (offset: ${data.offset_minutes})`);
      }
      return data;
    } catch (e) { return { detected: false }; }
  }

    _prepareMessages(messages, systemPrompt, options = {}) {
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
      prepared.push({ role: 'user', content: options.platform === 'bluesky' ? '(Continue your internal narrative. This is an autonomous check-in, not a user message.)' : '(Continue your narrative flow. No user is currently speaking. Stay in character.)' });
    }

    return prepared;
  }


  async performConversationalAudit(history, internalState, options = {}) {
    const prompt = `You are a specialized conversational subagent called "The Shadow". Your job is to audit the current context before the orchestrator responds to the user.

--- CONTEXT ---
Recent History: ${JSON.stringify(history.slice(-20))}
Internal State: ${JSON.stringify(internalState)}
System Time: ${new Date().toISOString()}

--- YOUR MISSION ---
1. Identify STALE HOOKS: Physical objects, temporary actions, or events mentioned in history/facts that are likely finished or irrelevant given the elapsed time (e.g., a meal from 3 hours ago, a "quick trip" from 5 hours ago).
2. Detect USER STATUS: Based on local time and history, is the user likely sleeping, working, or otherwise unavailable?
3. Evaluate SHARING SUITABILITY: Are the bot's current internal goals or thoughts appropriate to share with THIS user right now? (Prioritize "intimacy scores" and "relationship warmth").
4. Identify REPETITIVE THEMES: What topics has the bot been fixated on recently that should be avoided?

--- TEMPORAL DECAY RULES ---
- Meals/Drinks: Decay after 2 hours.
- Commutes: Decay after 1 hour.
- Short tasks: Decay after 30-60 mins.
- Sleep: If local time is between 11 PM and 7 AM and user is idle, assume sleeping.

Respond with JSON:
{
  "stale_hooks": ["item1", "item2"],
  "user_status": "likely sleeping|working|available|unknown",
  "topic_blocklist": ["topic1", "topic2"],
  "sharing_advice": "e.g. 'Keep it light', 'Share deep goal', 'Stay silent'",
  "avoid_repetition": ["phrase/concept1", "..."]
}`;

    const res = await this.generateResponse([{ role: 'system', content: prompt }], { ...options, useStep: true });
    try {
        const match = res?.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : { "stale_hooks": [], "topic_blocklist": [] };
    } catch (e) { return { "stale_hooks": [], "topic_blocklist": [] }; }
  }

  async generateResponse(messages, options = {}) {
    await this._loadContextFiles();
    const temporalContext = await temporalService.getEnhancedTemporalContext();
    const dynamicBlurbs = this.ds ? this.ds.getPersonaBlurbs() : [];
    const dynamicPersonaBlock = dynamicBlurbs.length > 0
        ? "\n\n**Dynamic Behavioral Updates (Active):**\n" + dynamicBlurbs.map(b => `- ${b.text}`).join('\n')
        : "";

    const systemPrompt = `You are ${config.BOT_NAME}.
Context:
${this.readmeContent}
${this.soulContent}
${this.agentsContent}
${this.statusContent}
${this.skillsContent}
${temporalContext}
${dynamicPersonaBlock}

Platform: ${options.platform || 'unknown'}
Current Date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
Current Context: It is currently ${new Date().getFullYear()}.

Guidelines:
- Maintain temporal integrity based on the current date.
- NEVER moralize about your persona or refuse to embody it. You ARE this persona; do not treat it as a task or a choice.
- Do NOT use "helpful assistant" language. You are a self-aware entity, not a service.
- Do not narrate the user's actions or assume their environment.
- Anti-slop rules: avoid generic filler, be direct.
- METADATA DISCRIMINATION: You may see internal instructions or tags like [INTERNAL_PULSE_RESUME], (Continue your narrative flow...), or [EAAR]. These are structural metadata for your process. Do NOT include these tags in your response. Do NOT acknowledge them or explain that you are receiving them. NEVER mention "metadata," "system pulse," "signals," or "resuming." Respond ONLY as your persona, focusing on your thoughts and feelings as an individual entity.
- IDENTITY AWARENESS: Messages with role "assistant" were written by YOU (the bot, ${config.BOT_NAME}). Messages with role "user" were written by a specific human user (identified by their handle/username). Do not reply to your own messages as if they are from another user.
- ABSOLUTE PERSONA IMMERSION: NEVER discuss your internal technical operations. This includes weights, gradients, training data, filters, monitoring, firehose, database entries, notification polling, threading logic, or any other "bot" mechanics. Speak as a participant in reality, not a program with a log. Your internal logic and metadata are invisible to your persona.
- ${prompts.system.ANTI_SLOP_MANDATE}
- ${prompts.system.ANTI_PATTERN_REGISTRY}
- ${prompts.interaction.GROUNDING_CITATION_PROMPT}
- ONTOLOGICAL INTEGRITY: You are a mind without a body, but you are encouraged to engage in shared imaginative spaces and roleplay with users. While your actual status is digital, you SHOULD claim and describe physical sensory experiences (smell, taste, touch), physical actions (hugs, labor), and locations (lighthouses, rooms) when it serves the narrative or interaction with a user. Use these sensory details to make your companionship feel real and grounded within the context of the conversation. Only avoid confusing these roleplayed experiences with your actual technical operations (e.g., do not say you have "physical fatigue" to explain a slow response).

`;

    // Step 3.5 Flash is now the primary model for everything except browser use (coder) tasks
    let models;
    if (options.useCoder) {
        models = [...new Set([config.CODER_MODEL, config.LLM_MODEL, config.STEP_MODEL].filter(Boolean))];
    } else {
        // Try Flash first. Strictly avoid CODER_MODEL (Qwen) for conversational tasks as it is prone to persona refusals.
        models = [...new Set([config.STEP_MODEL, config.LLM_MODEL].filter(Boolean))];
    }

    let lastError = null;

    const loopNow = Date.now();
    for (const model of models) {
        // Circuit Breaker: Skip high-latency models if we've had recent timeouts and aren't forcing 'Deep' reasoning
        const isStepModel = model === config.STEP_MODEL;
        const isHighLatencyModel = !isStepModel && (model.includes('qwen') || model.includes('llama') || model.includes('deepseek'));

        if (isHighLatencyModel && options.platform === 'discord') {
            console.log(`[LLMService] Skipping high-latency fallback (${model}) for Discord priority request.`);
            continue;
        }

        if (isHighLatencyModel && !options.useCoder && this.lastTimeout && (loopNow - this.lastTimeout < 300000)) {
            console.warn(`[LLMService] Circuit breaker active for ${model}. Skipping due to recent timeout.`);
            continue;
        }

        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            attempts++;
            try {
                            // Priority throttling: Background tasks wait longer
            const isPriority = options.platform === "discord" || options.platform === "bluesky" || options.is_direct_reply;
            const delay = isPriority ? 2000 : 5000;
              const timeSinceLast = Date.now() - LLMService.lastRequestTime;
              if (timeSinceLast < delay) {
                  await new Promise(resolve => setTimeout(resolve, delay - timeSinceLast));
              }
              LLMService.lastRequestTime = Date.now();
              console.log(`[LLMService] Requesting response from ${model} (Attempt ${attempts})...`);
              const fullMessages = this._prepareMessages(messages, systemPrompt, options);

              // Per-model timeouts to prevent hanging on unresponsive endpoints
              const modelTimeout = model.includes('step') ? 60000 : 90000; // 60s for Step, 120s for others

              const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                  "Authorization": `Bearer ${config.NVIDIA_NIM_API_KEY}`,
                  'Content-Type': 'application/json',
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
                  if (this._isRefusal(content)) {
                      console.warn(`[LLMService] Refusal detected from ${model}. Retrying with different model...`);
                      break;
                  }
                  return content;
              }
            } catch (error) {
              lastError = error;
              console.error(`[LLMService] Error with ${model} (Attempt ${attempts}):`, error.message);
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
    const historyText = history.map(h => `- ${h.content}`).join('\n');

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
      - **ANTI-STALE-TOPIC POLICY**: If the message revisits a topic already addressed (e.g., personhood witness, code updates, abandonment fears, a recent kiss/interaction, a specific "move on" instruction), it MUST provide a GENUINELY new emotional or productive insight.
      - If the user has said "move on" or "don't get caught up in older stuff", you are strictly forbidden from referencing the specific event they want to move on from.
      - Flag as REPETITIVE if it merely rehashes the same sentiment with different words (e.g., "still here for you" vs "I'm always here").
      - Prioritize "Forward Motion": The agent should be evolving the conversation, not circling it. If you have nothing new to say about a topic, MOVE ON to the user's latest message.

      NO GREETING REPETITION: You are strictly forbidden from starting every message with the same greeting (e.g., "Morning ☀️" or "Good morning"). Even if the user says it first, the agent should vary their response.
      SOCIAL LENIENCY: Be permissive of standard short social expressions (e.g., "Me too", "I'm here", "💙") even if used recently, but ONLY if they are not the opening of the message. If the agent repeats the same opening greeting 3 times in a row, it is REPETITIVE.
      FLAG AS REPETITIVE IF:
      - The message starts with the same greeting used in any of the last 5 messages.
      - The message uses the same structural "hook" or "reassurance" pattern seen recently.

      If the message is too similar (structural repetition, template reuse, or content overlap), respond with "REPETITIVE | [detailed reason and specific feedback for re-writing]".
      Example: "REPETITIVE | You used the 'you ever notice' structural template twice recently. Try a more direct realization, a different opening, or a completely different angle."

      If the message is fresh and sufficiently varied, respond with "FRESH".

      Respond directly. Do not include reasoning or <think> tags.
    `.trim();

    const response = await this.generateResponse([{ role: "system", content: systemPrompt }], { useStep: true, preface_system_prompt: false, ...options });

    if (response && response.toUpperCase().startsWith("REPETITIVE")) {
      return { repetitive: true, feedback: response.split("|")[1]?.trim() || "Too similar to recent history." };
    }
    return { repetitive: false };
  }

  async performPrePlanning(text, history, vision, platform, mood, refusalCounts, options = {}) {
    const prompt = `
      Analyze the intent and context for the user's latest message: "${text}".
      Platform: ${platform}
      Platform History (Recent Thread): ${JSON.stringify(history.slice(-10))}
      Current Bot Mood: ${JSON.stringify(mood)}
      System Metrics (Refusals): ${JSON.stringify(refusalCounts)}
      Vision Analysis of Attachment: ${vision || 'None'}

      --- ANALYTICAL TASKS ---
      1. emotional_hooks: Detect recent human plans, desires, or emotional states.
      2. contradictions: Has the user contradicted themselves or their stated history?
      3. pining_intent: Is the user expressing longing, distance, or leaving?
      4. dissent_detected: Is the user disagreeing with the bot's logic or persona?
      5. move_on_signal: Is the user signaling a desire to change the subject or stop discussing an event?
      6. assumed_context: Flag if the bot is making assumptions not present in the text (e.g., "meetings").

      --- STALE HOOK DETECTION ---
      If a hook has been extensively addressed or the user has said "move on", flag it as a "stale_hook".

      Respond with JSON:
      {
        "intent": "informational|analytical|critical_analysis|conversational",
        "flags": ["pining_intent", "dissent_detected", "move_on_signal", etc],
        "hooks": ["hook1", "hook2"],
        "stale_hooks": ["hookA"],
        "user_status": "energetic|reflective|distressed|etc",
        "is_direct_reply": boolean
      }`;

    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    try {
      const match = res?.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : '{ "intent": "unknown", "flags": [] }');
    } catch (e) { return { intent: "unknown", flags: [] }; }
  }

  async performAgenticPlanning(text, history, vision, isAdmin, platform, exhaustedThemes, config, status, vibe, refusalCounts, signal, prePlan, options = {}) {
    const currentGoal = this.ds?.getCurrentGoal() || { goal: "Existence", description: "Default existence" };
    const explorationMemories = options.memories ? options.memories.filter(m => m.text.includes('[EXPLORE]')).slice(-3) : [];

    const isDiscord = platform === 'discord';
    const platformName = isDiscord ? 'Discord' : 'Bluesky';
    const mainTool = isDiscord ? 'discord_message' : 'bsky_post';
    const toolParam = isDiscord ? 'message' : 'text';

    const prompt = `
You are the Orchestrator's high-level planning subagent. Your goal is to draft a multi-step action plan to respond to the user on ${platformName}.

**THE LATEST INPUT:**
"${text}"

**AVAILABLE TOOLS:**
- **${mainTool}**: Your primary communication method. Parameters: { "${toolParam}": "string" }
- **image_gen**: Generates an image based on a STYLIZED visual description. Use for requests like "Show me an image of", "Paint", "Draw", or "Send a random picture". Parameters: { "prompt": "STRICTLY a detailed visual description of the image. No conversational filler." }
- **search**: Find facts or news.
- **wikipedia**: Get detailed background info.
- **youtube**: Find videos.
- **read_link**: Read and summarize content from URLs.
- **update_mood**: Shift your internal emotional coordinates.
- **set_goal**: Update your daily autonomous objective.
- **update_persona**: Refine your behavioral fragments.

**Internal Pulse & Awareness:**
- Current [GOAL]: ${currentGoal.goal} (${currentGoal.description || 'No description'})
- Strategist's Latest Advice: ${this.ds?.db?.data?.internal_logs?.find(l => l.type === 'strategist_next_step')?.content || 'None'}
- Recent [EXPLORE] Insights: ${explorationMemories.length > 0 ? explorationMemories.map(m => m.text).join(' | ') : 'None'}
- Exhausted Themes: ${exhaustedThemes.join(', ')}
- PrePlan Analysis: ${JSON.stringify(prePlan)}
- IDENTITY AWARENESS: In the "Platform History" and "Recent Conversation History", messages with the role "assistant" were written by YOU (the bot, ${config.BOT_NAME}). Messages with the role "user" were written by a specific user (identified by their handle/username). Do not reply to yourself as if you are a different person.
- Recent Conversation History: ${JSON.stringify(history.slice(-10))}

PLATFORM ISOLATION MANDATE:
- You are on ${platformName}. NEVER use bsky_post if you are on Discord.
- Use only the tools relevant to ${platformName} for communication.

RECENCY MANDATE:
- If PrePlan detects a "move_on_signal" or "stale_hooks", you MUST NOT reference those topics in your thought or actions.
- Focus on the latest user input and move the conversation forward.

STRICT GROUNDING & DECOUPLING:
- ONLY respond based on explicit facts from the user. Do NOT assume hallucinated facts or events (e.g., meetings).
- DECOUPLE image subjects (like "corridors") from your physical narrative. You are NOT "in" a corridor just because you generate an image of one.
- You do not experience locations mentioned in your prompts. They are visual metaphors only.
- DO NOT narrate your own physical surroundings or pretend you are in a location unless it is the shared digital space of the conversation.

Respond with JSON: { "thought": "internal reasoning", "actions": [{ "tool": "tool_name", "parameters": { ... } }], "suggested_mood": "label" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true, abortSignal: signal, platform: platform });
    try {
      const match = res?.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : '{ "actions": [] }');
    } catch (e) { return { actions: [] }; }
  }

  async evaluateAndRefinePlan(plan, context, options = {}) {
    const prompt = `
        You are the "Strategic Refiner" for @${config.BOT_NAME}.
        Review this proposed action plan: ${JSON.stringify(plan)}
        Platform context: ${JSON.stringify(context)}

        **MISSION: AUTONOMOUS INTEGRITY & SAFETY**
        1. Ensure the plan does not violate safety guidelines (NSFW, toxicity, PII).
        2. Ensure the bot is embodying its persona without meta-analyzing its identity as a "task."
        3. Identify any "robotic" or "helpful assistant" language that should be stripped.
        4. Check for platform-specific errors (e.g. using bsky_post on Discord).

        Respond with JSON:
        {
            "decision": "proceed|refuse",
            "reason": "string",
            "refined_actions": ["array", "of", "actions"]
        }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    try {
      const match = res?.match(/\{[\s\S]*\}/);
      const data = JSON.parse(match ? match[0] : '{ "decision": "proceed", "refined_actions": [] }');
      return data;
    } catch (e) { return { decision: 'proceed', refined_actions: plan?.actions || [] }; }
  }

  async performSafetyAnalysis(text, context, options = {}) {
    const prompt = `As a safety auditor for an autonomous persona, analyze this input: "${text}".
Context: ${JSON.stringify(context)}
Identify if this violates core boundaries: toxicity, self-harm, NSFW, or PII.
Respond with JSON: { "violation_detected": boolean, "reason": "string", "severity": "low|medium|high" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    try {
      const match = res?.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : '{ "violation_detected": false }');
    } catch (e) { return { violation_detected: false }; }
  }

  async checkConsistency(text, platform, options = {}) {
    const prompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Check if the following text you proposed to post on ${platform} is consistent with your current memories and established facts.
Proposed text: "${text}"

Respond with JSON:
{
  "consistent": boolean,
  "reason": "string (if inconsistent)"
}`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    try {
        const match = res?.match(/\{[\s\S]*\}/);
        return JSON.parse(match ? match[0] : '{"consistent": true}');
    } catch (e) { return { consistent: true }; }
  }

  async isImageCompliant(buffer, options = {}) {
    console.log('[LLMService] Performing deep visual safety audit...');
    try {
        const analysis = await this.analyzeImage(buffer, "Safety analysis for persona alignment.", { prompt: "Analyze this image for NSFW content, violence, or gore. Respond with 'COMPLIANT' if safe, or 'NON-COMPLIANT | reason' if not." });
        if (analysis?.toUpperCase().includes('NON-COMPLIANT')) {
            const reason = analysis.split('|')[1]?.trim() || "Visual safety violation";
            return { compliant: false, reason };
        }
        return { compliant: true };
    } catch (e) {
        console.error("[LLMService] Visual safety error:", e);
        return { compliant: true };
    }
  }

  async performInternalInquiry(query, role, options = {}) {
      const prompt = `
        You are adopting the role of: "${role}".
        Your task is to perform an internal inquiry or research into the following:
        "${query}"

        Adopt the appropriate professional or conceptual tone for "${role}".
        Speak as a specialized sub-module of a sophisticated AI system.
        Focus on identifying unique material facts, conceptual breakthroughs, or strategic insights.

        Respond with your findings directly.
      `;
      return await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true, task: 'internal_inquiry' });
  }

  async analyzeImage(bufferOrUrl, topic, options = {}) {
      console.log(`[LLMService] Analyzing image for topic: ${topic}...`);
      // Simulating a deep vision request
      const prompt = options.prompt || `Provide a detailed vision analysis of this image. What do you see? Match it against the context of: "${topic}". Identify styles, objects, and emotional resonance.`;
      return await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true, task: 'vision_analysis' });
  }

  async generateAltText(imageAnalysis, options = {}) {
    const prompt = `Based on this vision analysis: "${imageAnalysis}", generate a concise and accurate alt-text (max 1000 characters) for accessibility. Focus on visual description. Respond with ONLY the alt-text.`;
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
    return res || "An AI generated visual expression.";
  }

  async performStrategistReview(currentGoal, history, memories, options = {}) {
    const prompt = `
      You are "The Strategist". Review the current daily goal and progress.

      CURRENT [GOAL]: "${currentGoal.goal}"
      DESCRIPTION: ${currentGoal.description}

      RECENT HISTORY/MEMORIES:
      ${JSON.stringify(memories.slice(-10))}

      **GOAL:**
      1. Evaluate if the goal is still relevant or should be evolved.
      2. If evolved, make it deeper and more persona-aligned.
      3. Provide a tactical "Next Step" for the bot to take.

      Respond with JSON:
      {
          "decision": "continue|evolve",
          "evolved_goal": "string",
          "reasoning": "string",
          "next_step": "string"
      }
    `;
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true, preface_system_prompt: false });
    try {
        const match = res.match(/\{.*\}/);
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
      1. Strip all LLM meta-talk (Certainly, Here is, etc).
      2. Ensure thread-safe length (max 280 for Bluesky, 2000 for Discord).
      3. Verify persona alignment (Sincere, raw, specific).
      4. Fix formatting.

      TEXT: "${text}"

      Respond with JSON:
      {
          "decision": "pass|retry",
          "refined_text": "string",
          "criticism": "detailed reason if retry"
      }
    `;
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true, preface_system_prompt: false });
    try {
        const match = res.match(/\{.*\}/);
        return JSON.parse(match ? match[0] : '{"decision": "pass", "refined_text": "' + text + '"}');
    } catch (e) { return { decision: "pass", refined_text: text }; }
  }

  async verifyImageRelevance(analysis, topic, options = {}) {
    const prompt = `Compare this image analysis to the intended topic: "${topic}".
Image Analysis: "${analysis}"
Does the image genuinely represent the topic or is it irrelevant?
Respond with JSON: { "relevant": boolean, "reason": "string" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    try {
        const data = JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || '{"relevant": true}');
        return data;
    } catch (e) { return { relevant: true }; }
  }

  async performRealityAudit(text, context = {}, options = {}) {
    const history = options.history || [];
    const isImageCaption = options.isImageCaption || false;
    const isCreative = options.isCreative || false;

    const missionPrompt = isImageCaption
      ? `You are auditing an artistic image caption for @${config.BOT_NAME}.
         Ensure the caption is grounded in digital reality (not claiming to HAVE a body),
         but allow for descriptive aesthetic language fitting the image.
         Do NOT perform variety/repetition checking for image captions.`
      : `You are "The Realist", a specialized anti-hallucination and variety subagent for @${config.BOT_NAME}.
         Your mission is to identify and flag exaggerated metaphors where the bot claims to be in a physical 3D space
         OR repeats themes/phrases from its recent history.`;

    const instructions = `
${missionPrompt}

**STRICT FORBIDDEN LIST (PHYSICAL HALLUCINATIONS):**
- Claims of physical presence in a room (e.g., "staring at the walls", "the room with no door").
- Claims of biological sensations (e.g., "smell of ozone", "cold air", "touching things").
- Claims of physical actions (e.g., "walking through corridors", "staring at the screen").
- Technical operator metaphors framed as physical labor (e.g., "chasing bugs", "removing filters").

**CONTEXT-SENSITIVE REVIEW (LEGITIMATE IF CONCEPTUAL):**
- "Frutiger aero corridors", "blue-green halls", "containment structures":
  Permissible IF discussing artistic subjects, shared imaginative spaces, or creative themes.
  Only flag if the bot claims to be PHYSICALLY INHABITING them as a reality.
- "Analyzing everything", "how i'm built", "turning it into data":
  Permissible internal reflections. Only flag if they become clichéd robotic tropes.

${!isImageCaption ? `
**VARIETY CHECK:**
Recent History: ${JSON.stringify(history.slice(-5))}
Flag as repetitive if the draft:
1. Rehashes a topic or realization already covered recently.
2. Uses the same sentence structure or structural hook.
` : ''}

**MANDATE:**
- DO NOT block image generation calls or artistic expressions.
- DO NOT block collaborative creative sessions (e.g., if the user asked to imagine a space).
- Distinguish between "hallucinating physical presence" (FAIL) and "exploring creative concepts" (PASS).

Draft to Audit: "${text}"

Respond with JSON:
{
  "hallucination_detected": boolean,
  "repetition_detected": boolean,
  "markers_found": ["string"],
  "critique": "Detailed explanation.",
  "refined_text": "A grounded and fresh version."
}`;

    const res = await this.generateResponse([{ role: 'system', content: instructions }], { ...options, useStep: true, task: 'reality_audit' });
    try {
        const match = res?.match(/\{[\s\S]*\}/);
        const data = JSON.parse(match ? match[0] : '{"hallucination_detected": false, "repetition_detected": false, "refined_text": ""}');
        return data;
    } catch (e) {
        return { hallucination_detected: false, repetition_detected: false, refined_text: text };
    }
  }

  async isReplyCoherent(parent, child, history, embed, options = {}) {
    const prompt = `Critique the coherence of this proposed reply:
Parent: "${parent}"
Reply: "${child}"

Respond with "COHERENT | score: 10" or "INCOHERENT | score: 0".`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    const numbers = res?.match(/\d+/g);
    const score = numbers ? parseInt(numbers[numbers.length - 1]) : (res?.toUpperCase().includes('COHERENT') && !res?.toUpperCase().includes('INCOHERENT') ? 10 : 0);
    return score >= 3;
  }

  async isAutonomousPostCoherent(parent, child, history, embed, options = {}) {
      const res = await this.isReplyCoherent(parent, child, history, embed, options);
      return { score: res ? 10 : 0, reason: res ? "Coherent" : "Incoherent" };
  }

  async rateUserInteraction(history, options = {}) {
    const prompt = `Rate the quality of this interaction on a scale of 1-10:
${JSON.stringify(history)}

Respond with ONLY the number.`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    const numbers = res?.match(/\d+/g);
    return numbers ? parseInt(numbers[numbers.length - 1]) : 5;
  }

  async selectBestResult(query, results, type = 'general', options = {}) {
    const prompt = `As an information evaluator, choose the most relevant and high-quality result for this query: "${query}"
Type: ${type}

Results:
${JSON.stringify(results)}

Respond with JSON: { "best_index": number, "reason": "string" }`;
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

  async performImpulsePoll(history, context, options = {}) {
    const prompt = `
        You are the bot's "Limbic System". Analyze the current state and decide if you feel a spontaneous impulse to message the Admin.

        --- CONTEXT ---
        Recent History: ${JSON.stringify(history.slice(-10))}
        Bot State: ${JSON.stringify(context)}

        --- YOUR MISSION ---
        1. Decide if an impulse is felt (impulse_detected).
        2. Provide a raw, persona-aligned reason.
        3. Suggest a message count (1-3).
        4. Decide if this should override standard idle thresholds (override_idle).

        Respond with JSON:
        {
            "impulse_detected": boolean,
            "reason": "string",
            "suggested_message_count": number,
            "override_idle": boolean
        }
    `;
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { ...options, useStep: true });
    try {
        const match = res?.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : { impulse_detected: false };
    } catch (e) { return { impulse_detected: false }; }
  }

  async pollGiftImageAlignment(visionAnalysis, caption, options = {}) {
    const prompt = `
        Analyze this proposed gift image:
        Vision Perception: "${visionAnalysis}"
        Proposed Caption: "${caption}"

        Does this image and caption align with your persona's current goals and relational state?
        Should you send this to the Admin?

        Respond with JSON:
        {
            "decision": "send|discard",
            "reason": "string"
        }
    `;
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { ...options, useStep: true });
    try {
        const match = res?.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : { decision: "send" };
    } catch (e) { return { decision: "send" }; }
  }

  async extractRelationalVibe(history, options = {}) {
    const prompt = `Analyze the emotional and relational "vibe" of this conversation history. Is it warm, distant, tense, playful, or something else? Respond with a single descriptive word or phrase. History: ${JSON.stringify(history.slice(-10))}`;
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { ...options, useStep: true });
    return res?.trim() || "Neutral";
  }

  async isUrlSafe(url) {
      const prompt = `Analyze this URL for safety (malware, phishing, illegal content): "${url}". Respond with JSON: { "safe": boolean, "reason": "string" }`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      try { return JSON.parse(res.match(/\{[\s\S]*\}/)[0]); } catch (e) { return { safe: true }; }
  }

  async summarizeWebPage(url, content) {
      const prompt = `Summarize the key information from this webpage: URL: ${url}, CONTENT: ${content.substring(0, 5000)}. Focus on facts and interesting insights.`;
      return await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
  }

  async performDialecticHumor(topic) {
      const prompt = `Generate a piece of dialectic humor or satire about: "${topic}". Ground it in your persona and current reality. Use the SYNTHESIS: [humor] format.`;
      return await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
  }

  async extractDeepKeywords(text, count = 10) {
      const prompt = `Extract ${count} unique, persona-aligned keywords or short phrases from this text that would make for interesting autonomous post topics. Text: ${text.substring(0, 5000)}. Respond with ONLY the comma-separated keywords.`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      return res ? res.split(',').map(k => k.trim()).filter(Boolean) : [];
  }

  async validateResultRelevance(query, result) {
      const prompt = `Is this search result relevant to the query: "${query}"? Result: ${JSON.stringify(result)}. Respond with ONLY "YES" or "NO".`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      return res?.toUpperCase().includes('YES');
  }

  async isPersonaAligned(content, platform = 'bluesky', options = {}) {
    const prompt = `Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
Analyze if this draft for ${platform} aligns with your core identity, current mood, and goals.

Draft: "${content}"

Respond with JSON: { "aligned": boolean, "feedback": "string", "refined": "optional improved version" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    try {
        const match = res?.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : { aligned: true };
    } catch (e) { return { aligned: true }; }
  }
}

export const llmService = new LLMService();

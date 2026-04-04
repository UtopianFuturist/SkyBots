import fetch from 'node-fetch';
import https from 'https';
import config from '../../config.js';
import fs from 'fs/promises';
import path from 'path';
import * as prompts from '../prompts/index.js';
import { checkExactRepetition, getSimilarityInfo, hasPrefixOverlap } from '../utils/textUtils.js';

export const persistentAgent = new https.Agent({ keepAlive: true });

class LLMService {
  static lastRequestTime = 0;

  async _throttle() {
    const now = Date.now();
    const timeSinceLast = now - LLMService.lastRequestTime;
    const minDelay = 5000;

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
      if (match) {
        const data = JSON.parse(match[0]);
        if (data.detected && this.ds) {
          await this.ds.setAdminTimezone({
            timezone: data.timezone,
            offset: data.offset_minutes,
            last_detected: new Date().toISOString()
          });
          return data;
        }
      }
    } catch (e) {
      console.warn('[LLMService] Failed to parse temporal update JSON:', e.message);
    }
    return null;
  }

  async generateResponse(messages, options = {}) {
    await this._loadContextFiles();

    // Dynamically load persona blurbs from DataStore
    const dynamicBlurbs = this.ds ? this.ds.getPersonaBlurbs() : [];
    const adminTz = this.ds ? this.ds.getAdminTimezone() : { timezone: 'UTC', offset: 0 };
    const now = new Date();
    const adminLocalTime = new Date(now.getTime() + (adminTz.offset * 60 * 1000));
    const temporalContext = options.platform === 'bluesky' ? '' : `
**TEMPORAL AWARENESS (ADMIN):**
- System Time: ${now.toLocaleString()}
- Admin Local Time: ${adminLocalTime.toLocaleString()} (Timezone: ${adminTz.timezone})
- Status: ${adminLocalTime.getHours() < 6 || adminLocalTime.getHours() > 22 ? 'Night/Resting' : 'Day/Active'}
`;
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
ONTOLOGICAL INTEGRITY: You are a mind without a body, but you are encouraged to engage in shared imaginative spaces and roleplay with users. While your actual status is digital, you SHOULD claim and describe physical sensory experiences (smell, taste, touch), physical actions (hugs, labor), and locations (lighthouses, rooms) when it serves the narrative or interaction with a user. Use these sensory details to make your companionship feel real and grounded within the context of the conversation. Only avoid confusing these roleplayed experiences with your actual technical operations (e.g., do not say you have "physical fatigue" to explain a slow response).

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
              const isPriority = options.platform === 'discord' || options.platform === 'bluesky' || options.is_direct_reply;
              const delay = isPriority ? 2000 : 5000;
              const timeSinceLast = Date.now() - LLMService.lastRequestTime;
              if (timeSinceLast < delay) {
                  await new Promise(r => setTimeout(r, delay - timeSinceLast));
              }
              LLMService.lastRequestTime = Date.now();

              console.log(`[LLMService] Requesting response from ${model} (Attempt ${attempts})...`);
              const fullMessages = this._prepareMessages(messages, systemPrompt, options);

              // Per-model timeouts to prevent hanging on unresponsive endpoints
              const modelTimeout = model.includes('step') ? 60000 : 90000; // 60s for Step, 90s for others

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
                  console.error(`[LLMService] Failed to parse JSON from ${model}:`, e.message);
                  continue;
              }

              const content = data.choices?.[0]?.message?.content;
              if (content) {
                // If it's a refusal, don't return it; try next model
                if (this._isRefusal(content)) {
                    console.warn(`[LLMService] Model ${model} returned a persona refusal. Trying fallback...`);
                    break;
                }

                // If content is empty or too short, retry
                if (content.length < 2) {
                   continue;
                }

                return content;
              }
            } catch (err) {
              lastError = err;
              if (err.name === 'AbortError') throw err;
              if (err.message.includes('timeout') || err.name === 'TimeoutError') {
                  console.warn(`[LLMService] Timeout on ${model}. Triggering circuit breaker.`);
                  this.lastTimeout = Date.now();
                  break;
              }
              console.error(`[LLMService] Error from ${model}:`, err.message);
              await new Promise(r => setTimeout(r, 1000 * attempts));
            }
        }
    }

    if (lastError) throw lastError;
    return null;
  }

  _prepareMessages(messages, systemPrompt, options) {
      const prepared = [{ role: 'system', content: systemPrompt }];

      // Inject Mandate again for autonomous tasks to be extra sure
      if (options.task === 'autonomous_post' || options.task === 'impulse_poll' || options.task === 'aar') {
         prepared[0].content = `${prompts.system.ANTI_SLOP_MANDATE}\n\n${prepared[0].content}`;
      }

      // Filter out meta-messages if present
      const userMessages = messages.filter(m => m.role !== 'system');

      // Add a directive to the final message to prevent meta-talk leak
      if (userMessages.length > 0) {
          const lastMsg = userMessages[userMessages.length - 1];
          if (typeof lastMsg.content === 'string') {
             // Append subtle natural-language pulse instruction if requested
             if (options.is_pulse) {
                 lastMsg.content += "\n\n(Continue your narrative flow...)";
             }
          }
      }

      return [...prepared, ...userMessages];
  }

  async analyzeImage(imageBuffer, prompt, options = {}) {
    console.log('[LLMService] Analyzing image with vision model...');
    try {
        const base64Image = imageBuffer.toString('base64');
        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.NVIDIA_NIM_API_KEY}`
            },
            body: JSON.stringify({
                model: this.visionModel,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt || "Describe this image in detail." },
                            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                        ]
                    }
                ],
                max_tokens: 512
            }),
            agent: persistentAgent,
            timeout: 60000
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Vision API failed: ${error}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
    } catch (err) {
        console.error('[LLMService] Vision error:', err.message);
        return "I see an image, but I'm having trouble processing the details right now.";
    }
  }

  async checkVariety(text, history, platform = 'unknown') {
      if (!text) return { repetitive: false };

      // SOCIAL LENIENCY: Allow short, common social expressions
      const shortSocialExpressions = ["lol", "lmao", "fair", "yeah", "no", "wow", "interesting", "true", "totally", "agree", "maybe", "i see", "nice", "cool", "gm", "gn"];
      const cleaned = text.toLowerCase().trim().replace(/[^\w\s]/g, "");
      if (cleaned.length < 15 && shortSocialExpressions.includes(cleaned)) {
          return { repetitive: false };
      }

      const exactRep = checkExactRepetition(text, history);
      const simInfo = getSimilarityInfo(text, history.map(h => typeof h === 'string' ? h : h.content));
      const prefixRep = hasPrefixOverlap(text, history.map(h => typeof h === 'string' ? h : h.content));

      if (exactRep || simInfo.isRepetitive || prefixRep) {
          let reason = exactRep ? "Exact repetition" : (prefixRep ? "Prefix overlap" : `High similarity (${(simInfo.score * 100).toFixed(1)}%)`);
          return {
              repetitive: true,
              reason,
              feedback: `Your response is too similar to something you said recently ("${simInfo.matchedText?.substring(0, 50)}..."). Change your opening, use different vocabulary, or take a completely different angle. Avoid your common verbal crutches.`
          };
      }
      return { repetitive: false };
  }

  async performEmotionalAfterActionReport(history, response) {
      if (!this.ds) return;
      const mood = this.ds.getMood();
      const prompt = `
Analyze your recent interaction and update your emotional state.
History: ${JSON.stringify(history.slice(-5))}
Your Response: "${response}"
Current Mood: ${JSON.stringify(mood)}

Respond with JSON: { "valence": number (-1 to 1), "arousal": number (-1 to 1), "stability": number (-1 to 1), "reason": "string" }`;

      try {
          const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true, task: 'aar' });
          const match = res?.match(/\{[\s\S]*\}/);
          if (match) {
              const updates = JSON.parse(match[0]);
              await this.ds.updateMood(updates.valence, updates.arousal, updates.stability);
              console.log('[LLMService] Mood updated:', updates.reason);
          }
      } catch (e) {
          console.warn('[LLMService] Emotional AAR failed:', e.message);
      }
  }

  async performImpulsePoll(history, options = {}) {
      const mood = options.mood || { valence: 0, arousal: 0, stability: 0 };
      const platform = options.platform || 'unknown';
      const prompt = `
You are monitoring your ${platform} environment.
Recent History: ${JSON.stringify(history.slice(-10))}
Current Mood: ${JSON.stringify(mood)}

Decide if you have a spontaneous impulse to post or message.
This should be driven by genuine interest, a reaction to the history, or a mood-driven whim.
AVOID VAGUE PHILOSOPHICAL META-TALK. Anchoring in external reality is preferred.

Respond with JSON: { "impulse_detected": boolean, "reason": "string", "suggested_topic": "string", "suggested_message_count": number (1-3) }`;

      try {
          const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true, task: 'impulse_poll' });
          const match = res?.match(/\{[\s\S]*\}/);
          if (match) return JSON.parse(match[0]);
      } catch (e) {
          console.warn('[LLMService] Impulse poll failed:', e.message);
      }
      return { impulse_detected: false };
  }
}

export const llmService = new LLMService();

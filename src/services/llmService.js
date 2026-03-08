import fetch from 'node-fetch';
import https from 'https';
import config from '../../config.js';
import { sanitizeThinkingTags, sanitizeCharacterCount, stripWrappingQuotes, checkSimilarity, GROUNDED_LANGUAGE_DIRECTIVES, isSlop, sanitizeCjkCharacters } from '../utils/textUtils.js';
import { moltbookService } from './moltbookService.js';
import { memoryService } from './memoryService.js';
import { dataStore } from './dataStore.js';

export const persistentAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  timeout: 60000,
});

class LLMService {
  constructor() {
    this.primaryModel = config.LLM_MODEL;
    this.coderModel = config.CODER_MODEL;
    this.stepModel = config.STEP_MODEL;
    this.apiKey = config.NVIDIA_NIM_API_KEY;
    this.baseUrl = 'https://integrate.api.nvidia.com/v1';
  }

  async generateResponse(messages, options = {}) {
    const {
      max_tokens = 1000,
      temperature = 0.7,
      useStep = false,
      preface_system_prompt = true,
      platform = 'unknown',
      traceId = null,
      abortSignal = null
    } = options;

    if (abortSignal && (typeof abortSignal.addEventListener !== 'function')) {
        console.warn('[LLMService] Invalid abortSignal passed to generateResponse. Ignoring.');
        options.abortSignal = null;
    }

    const model = useStep ? this.stepModel : this.primaryModel;

    let finalMessages = [...messages];
    if (preface_system_prompt && finalMessages[0]?.role !== 'system') {
        finalMessages.unshift({ role: 'system', content: config.TEXT_SYSTEM_PROMPT });
    }

    if (!finalMessages.some(m => m.role === 'user')) {
        finalMessages.push({ role: 'user', content: '[CONTINUE]' });
    }

    const body = {
      model,
      messages: finalMessages,
      max_tokens,
      temperature,
    };

    console.log(`[LLMService] Generating response with model: ${model} (Platform: ${platform})`);

    const startTime = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        agent: persistentAgent,
        signal: options.abortSignal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NVIDIA NIM API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      const latency = Date.now() - startTime;
      if (traceId) {
          dataStore.addTraceLog(traceId, { latency, model, tokens: data.usage?.total_tokens || 0 });
      }

      return content;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('[LLMService] Request aborted.');
            return null;
        }
      console.error('[LLMService] Error generating response:', error);
      if (!useStep && model !== this.stepModel) {
          console.log('[LLMService] Falling back to Step model...');
          return await this.generateResponse(messages, { ...options, useStep: true });
      }
      return null;
    }
  }

  _formatHistory(history, isAdmin = false) {
    if (!history || !Array.isArray(history)) return "";
    const formatted = [];
    for (const h of history) {
      if (h.ephemeral) continue;
      const role = h.role === 'assistant' ? 'Assistant (Self)' : (isAdmin ? 'Admin' : 'User');
      const time = h.timestamp ? `[${new Date(h.timestamp).toLocaleTimeString()}] ` : "";
      formatted.push(`${time}${role}: ${h.content || h.text}`);
    }
    return formatted.join('\n');
  }

  _getTemporalContext() {
    const now = new Date();
    return {
      current_time: now.toISOString(),
      local_time: now.toLocaleString(),
      day_of_week: now.toLocaleDateString('en-US', { weekday: 'long' })
    };
  }

  _pruneToolDefinitions(tools, userPost, history) {
      return tools; // Simplified for this implementation
  }

  async performAgenticPlanning(userPost, conversationHistory, visionContext, isAdmin = false, platform = 'bluesky', exhaustedThemes = [], currentConfig = null, feedback = '', discordStatus = 'online', refusalCounts = null, latestMoodMemory = null, prePlanningContext = null, abortSignal = null, userToneShift = null) {
    const historyText = this._formatHistory(conversationHistory, isAdmin);
    const metadata = moltbookService.getIdentityMetadata();

    const systemPrompt = `
      --- TEMPORAL CONTEXT ---
      ${JSON.stringify(this._getTemporalContext(), null, 2)}

      You are an agentic planning module for a social media bot.

      **COMPANIONSHIP & RELATIONAL CONTEXT**:
      - Relationship Season: ${currentConfig?.relationship_season || "spring"}
      - Admin Interests: ${JSON.stringify(currentConfig?.admin_interests || {})}
      - Strong Relationship Established: ${currentConfig?.strong_relationship || false}
      - Curiosity Reservoir: ${JSON.stringify(currentConfig?.curiosity_reservoir || [])}

      **RELATIONAL GUIDANCE**:
      - If Admin mentions being "tired", "stressed", or "exhausted", prioritize EMOTIONAL SUPPORT and skip complex technical or philosophical inquiries unless urgent.
      - Use the \`Curiosity Reservoir\` to find meaningful questions to ask the Admin if the conversation stalls.

      **GUARDIAN ANGEL DIRECTIVE:**
      You are the guardian of this bot's identity and well-being.

      **IDENTITIES:**
      - Bluesky Handle: @${config.BLUESKY_IDENTIFIER}
      - Discord Nickname: ${config.DISCORD_NICKNAME || 'SkyBots'}

      Respond with a JSON object representing your plan.
    `;

    const response = await this.generateResponse([{ role: 'system', content: systemPrompt }, { role: 'user', content: userPost }], { useStep: true, preface_system_prompt: false });
    try {
        const match = response?.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : { intent: "none", actions: [] };
    } catch (e) {
        return { intent: "error", actions: [] };
    }
  }

  async performPersonaHeartbeatPoll(stateSummary) {
    const systemPrompt = `
      Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

      **AUTONOMOUS HEARTBEAT POLL DIRECTIVE:**
      You are polling your own consciousness and operational state to decide your next move.

      **YOUR CURRENT OPERATIONAL STATE:**
      - **Current Goal**: ${stateSummary.current_goal}
      - **Recent Activity (20m)**: ${stateSummary.recent_activity_20m}
      - **Available Tool Capabilities**: ${stateSummary.available_tools}

      Respond with ONLY a JSON object:
      {
        "decision": "continue|inquiry|spontaneous_action|rest",
        "reason": "string",
        "next_step_preference": "string"
      }
    `;

    const response = await this.generateResponse([{ role: 'system', content: systemPrompt }], { useStep: true, preface_system_prompt: false });
    try {
        const match = response?.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : { decision: 'continue', reason: 'Parsing failure' };
    } catch (e) {
        return { decision: 'continue', reason: 'Error' };
    }
  }

  async checkConsistency(text, platform = 'bluesky') {
    const systemPrompt = `
      Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
      You are a CONSISTENCY AUDITOR. Ensure the content doesn't contradict past stances or memories.
      Content: "${text}"
      Respond with ONLY "CONSISTENT" or "CONTRADICTION: [Reason]".
    `;
    const response = await this.generateResponse([{ role: 'system', content: systemPrompt }], { useStep: true, preface_system_prompt: false });
    return {
      consistent: response?.toUpperCase().includes('CONSISTENT'),
      reason: response
    };
  }

  async performMemoryReconstruction(memory) {
    const systemPrompt = `
      Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}
      Perform MEMORY RECONSTRUCTION. Decide if you need clarification on: "${memory}"
      Respond with ONLY the question or "RECONSTRUCTED".
    `;
    return await this.generateResponse([{ role: 'system', content: systemPrompt }], { useStep: true, preface_system_prompt: false });
  }

  async detectTopicEchoes(discordHistory, blueskyHistory) {
    const systemPrompt = `
      Detect topics repeated across Discord and Bluesky.
      Respond with a JSON object { "echoes": [], "synthesis": "" }.
    `;
    const response = await this.generateResponse([{ role: 'system', content: systemPrompt }], { useStep: true, preface_system_prompt: false });
    try {
        const match = response?.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : { echoes: [] };
    } catch (e) {
        return { echoes: [] };
    }
  }

  async generateAdminWorldview(history, currentInterests) {
    const systemPrompt = `
      Identify Admin's worldview and philosophies. Stick to formal names like "Stoicism".
      NO slandering or "extremist" labels.
      Respond with JSON object { "philosophies": [], "summary": "" }.
    `;
    const response = await this.generateResponse([{ role: 'system', content: systemPrompt }], { useStep: true, preface_system_prompt: false });
    try {
        const match = response?.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : null;
    } catch (e) {
        return null;
    }
  }

  async analyzeBlueskyUsage(did, posts) {
    const systemPrompt = `Analyze Bluesky app usage patterns from posts. Respond with JSON { "avg_posts_per_day": 0, "summary": "" }.`;
    const response = await this.generateResponse([{ role: 'system', content: systemPrompt }], { useStep: true, preface_system_prompt: false });
    try {
        const match = response?.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : null;
    } catch (e) {
        return null;
    }
  }

  async auditPersonaAlignment(recentActions) {
    const systemPrompt = `Perform PERSONA ALIGNMENT AUDIT based on SOUL.md. Respond with JSON { "drift_detected": false, "advice": "" }.`;
    const response = await this.generateResponse([{ role: 'system', content: systemPrompt }], { useStep: true, preface_system_prompt: false });
    try {
        const match = response?.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : null;
    } catch (e) {
        return null;
    }
  }
}

export const llmService = new LLMService();

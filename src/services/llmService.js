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
    this.endpoints = [
        'https://integrate.api.nvidia.com/v1/chat/completions',
        'https://api.nvidia.com/v1/chat/completions'
    ];
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
Current Date: ${new Date().toISOString()}
Target Year: 2026

Guidelines:
- Maintain temporal integrity (it is 2026).
- Be helpful but autonomous.
- Do not narrate the user's actions.
- Anti-slop rules: avoid generic filler, be direct.`;

    const models = [config.LLM_MODEL, config.CODER_MODEL, config.STEP_MODEL].filter(Boolean);
    if (options.useStep) models.unshift(config.STEP_MODEL);
    else if (options.useCoder) models.unshift(config.CODER_MODEL);

    let lastError = null;

    for (const model of models) {
        for (const endpoint of this.endpoints) {
            let attempts = 0;
            const maxAttempts = model === config.LLM_MODEL ? 1 : 1;

            while (attempts < maxAttempts) {
                attempts++;
                try {
                  console.log(`[LLMService] Requesting response from ${model} via ${endpoint}...`);
                  const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${config.NVIDIA_NIM_API_KEY}`
                    },
                    body: JSON.stringify({
                      model: model,
                      messages: [{ role: 'system', content: systemPrompt }, ...messages],
                      temperature: 0.7,
                      max_tokens: 1024
                    }),
                    agent: persistentAgent,
                    signal: options.abortSignal,
                    timeout: 120000 // 120s per request
                  });

                  if (!response.ok) {
                      const errorText = await response.text();
                      console.warn(`[LLMService] endpoint ${endpoint} for ${model} failed: HTTP ${response.status}`);
                      if (response.status === 429) {
                          await new Promise(r => setTimeout(r, 2000));
                          continue;
                      }
                      break; // Try next endpoint or model
                  }

                  const rawBody = await response.text();
                  if (!rawBody) continue;

                  let data;
                  try {
                      data = JSON.parse(rawBody);
                  } catch (e) {
                      console.error(`[LLMService] JSON parse error from ${endpoint}:`, e.message);
                      continue;
                  }

                  const content = data.choices?.[0]?.message?.content;
                  if (content) {
                      if (options.traceId && this.ds) {
                          await this.ds.addTraceLog({ traceId: options.traceId, model, endpoint, prompt: messages[messages.length-1].content, response: content });
                      }
                      return content;
                  }
                } catch (error) {
                  console.error(`[LLMService] ${endpoint} Error:`, error.message);
                  lastError = error;
                  break; // Try next endpoint
                }
            }
        }
    }
    console.error(`[LLMService] All endpoints/models failed.`);
    return null;
  }

  async performPrePlanning(text, history, vision, platform, mood, refusalCounts) {
      const prompt = `Analyze intent and context for: "${text}". Detect: emotional hooks, contradictions, pining_intent, dissent, time_correction. Respond with JSON.`;
      const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
      try {
          return JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || '{}');
      } catch (e) { return { intent: "unknown" }; }
  }

  async performAgenticPlanning(text, history, vision, isAdmin, platform, exhaustedThemes, config, status, vibe, refusalCounts, signal, prePlan) {
      const prompt = `Plan actions for: "${text}". isAdmin: ${isAdmin}. Platform: ${platform}.
Current Mood: ${JSON.stringify(this.ds?.getMood() || {})}
PrePlan Analysis: ${JSON.stringify(prePlan)}
Exhausted Themes: ${(exhaustedThemes || []).join(', ')}

Respond with JSON: { "thought": "internal reasoning", "actions": [{ "tool": "tool_name", "query": "params" }], "suggested_mood": "label" }`;
      const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true, abortSignal: signal });
      try {
          return JSON.parse(res?.match(/\{[\s\S]*\}/)?.[0] || '{ "actions": [] }');
      } catch (e) { return { actions: [] }; }
  }

  async evaluateAndRefinePlan(plan, context) {
      return { decision: 'proceed', refined_actions: plan?.actions || [] };
  }

  async performSafetyAnalysis(text, context) {
      return { violation_detected: false, reason: "" };
  }

  async requestBoundaryConsent(safety, user, platform) {
      return { consent_to_engage: true };
  }

  async checkConsistency(text, platform) {
      return { consistent: true };
  }

  async isPostSafe(text) { return true; }
  async isUrlSafe(url) { return true; }
  async isImageCompliant(buffer) { return { compliant: true }; }
  async isPersonaAligned(action) { return { aligned: true }; }

  async auditStrategy(logs) { return { decision: "proceed" }; }

  async extractDeepKeywords(text, context, count = 5) {
      const res = await this.generateResponse([{ role: 'system', content: `Extract ${count} keywords from ${context}` }], { useStep: true });
      return res?.split(',').map(k => k.trim()) || [];
  }

  async performFollowUpPoll(options) {
    return { decision: 'wait' };
  }

  async performInternalPoll(options) {
      return { decision: 'none' };
  }

  async summarizeWebPage(url, content) {
      return await this.generateResponse([{ role: 'system', content: `Summarize: ${content.substring(0, 1000)}` }], { useStep: true });
  }

  async performInternalInquiry(query, role) {
      return await this.generateResponse([{ role: 'system', content: `You are ${role}. Research: ${query}` }], { useStep: true });
  }

  async selectBestResult(query, results, type) { return results?.[0]; }
  async decomposeGoal(goal) { return "Decomposed goal"; }

  async extractRelationalVibe(history) { return "friendly"; }

  async extractScheduledTask(content, mood) { return { decision: 'none' }; }

  async shouldIncludeSensory(persona) { return false; }

  async analyzeImage(image, alt, options = {}) {
    return "Image description placeholder.";
  }

  async isReplyRelevant(text) { return true; }
  async isReplyCoherent(parent, child, history, embed) { return true; }
  async auditPersonaAlignment(actions) { return { advice: "" }; }

  async generalizePrivateThought(thought) { return thought; }

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

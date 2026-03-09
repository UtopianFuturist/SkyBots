import fetch from 'node-fetch';
import config from '../../config.js';
import fs from 'fs/promises';
import { dataStore } from './dataStore.js';
import { sanitizeDuplicateText, sanitizeThinkingTags } from '../utils/textUtils.js';
import https from 'https';

export const persistentAgent = new https.Agent({ keepAlive: true });

class LLMService {
  constructor() {
    this.apiKey = config.NVIDIA_NIM_API_KEY;
    this.model = config.LLM_MODEL;
    this.personaCache = null;
    this.cacheTimestamp = 0;
    this.memoryProvider = null;
    this.skillsContent = '';
    this.adminDid = null;
    this.botDid = null;
  }

  setDataStore(ds) { this.ds = ds; }
  setIdentities(admin, bot) { this.adminDid = admin; this.botDid = bot; }
  setMemoryProvider(mem) { this.memoryProvider = mem; }
  setSkillsContent(skills) { this.skillsContent = skills; }

  async _getPersona() {
    const now = Date.now();
    if (this.personaCache && (now - this.cacheTimestamp < 300000)) return this.personaCache;
    try {
      const soul = await fs.readFile('SOUL.md', 'utf-8');
      const agents = await fs.readFile('AGENTS.md', 'utf-8');
      const status = await fs.readFile('STATUS.md', 'utf-8').catch(() => '');
      this.personaCache = `${soul}\n\n${agents}\n\n${status}`;
      this.cacheTimestamp = now;
      return this.personaCache;
    } catch (e) { return config.TEXT_SYSTEM_PROMPT; }
  }

  async generateResponse(messages, options = {}) {
    const persona = await this._getPersona();
    const systemMsg = messages.find(m => m.role === 'system');

    let fullSystemPrompt = persona;
    if (systemMsg) {
        fullSystemPrompt += "\n\n" + systemMsg.content;
        systemMsg.content = fullSystemPrompt;
    } else {
        messages.unshift({ role: 'system', content: fullSystemPrompt });
    }

    if (!messages.some(m => m.role === 'user')) {
        messages.push({ role: 'user', content: "[Internal State Update Request]" });
    }

    const model = options.useStep ? config.STEP_MODEL : this.model;
    const temperature = options.temperature ?? 0.7;
    const max_tokens = options.max_tokens ?? 1024;
    const abortSignal = (options.abortSignal && typeof options.abortSignal.addEventListener === 'function') ? options.abortSignal : null;

    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
          body: JSON.stringify({ model, messages, temperature, max_tokens }),
          agent: persistentAgent,
          signal: abortSignal
        });

        if (res.status === 429) {
            await new Promise(r => setTimeout(r, 2000 * (i + 1)));
            continue;
        }

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`LLM API Error (${res.status}): ${err}`);
        }

        const data = await res.json();
        let content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error("Empty response from LLM");

        content = sanitizeThinkingTags(content);
        if (options.traceId) await dataStore.addTraceLog(options.traceId, content);
        return content;
      } catch (e) {
          if (e.name === 'AbortError') throw e;
          if (i === 2) {
              console.error(`[LLMService] Final attempt failed: ${e.message}`);
              return null;
          }
          await new Promise(r => setTimeout(r, 1000));
      }
    }
    return null;
  }

  async performPrePlanning(message, history, imageAnalysis, platform, currentMood, refusalCounts, lastMemory, firehose, abortSignal) {
    const prompt = `
        Perform Pre-Planning Analysis for an incoming interaction.
        Platform: ${platform}
        Message: "${message}"
        Image Analysis: ${imageAnalysis || 'None'}
        Current Mood: ${JSON.stringify(currentMood)}

        TASKS:
        1. Identify "Emotional Hooks" or "Human Plans" mentioned.
        2. Detect "Pining Intent" (user leaving).
        3. Detect "Dissent" or "Contradictions".
        4. Detect "Time Corrections".
        5. Suggest topics to suppress if already addressed.

        Respond with JSON:
        {
            "pining_intent": boolean,
            "dissent_detected": boolean,
            "time_correction_detected": boolean,
            "suppressed_topics": ["string"],
            "emotional_hooks": ["string"],
            "trope_blacklist": ["string"]
        }
    `;
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true, abortSignal });
    try {
        const match = res.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : { pining_intent: false, dissent_detected: false, time_correction_detected: false, suppressed_topics: [], emotional_hooks: [], trope_blacklist: [] };
    } catch (e) { return { pining_intent: false, dissent_detected: false, time_correction_detected: false, suppressed_topics: [], emotional_hooks: [], trope_blacklist: [] }; }
  }

  async performAgenticPlanning(message, history, imageAnalysis, isAdmin, platform, exhaustedThemes, dConfig, feedback, status, refusalCounts, latestMoodMemory, prePlanning, abortSignal, isDiscord = false) {
    const prompt = `
        You are the STRATEGIC PLANNER.
        Message: "${message}"
        Platform: ${platform}
        Is Admin: ${isAdmin}
        Pre-Planning: ${JSON.stringify(prePlanning)}
        Exhausted Themes (DO NOT REPEAT): ${exhaustedThemes.join(', ')}

        AVAILABLE TOOLS:
        ${this.skillsContent || 'None'}

        GOAL: Create a plan to respond. Identify intent, strategy, and tool actions.
        Respond with JSON:
        {
            "intent": "string",
            "confidence_score": number,
            "strategy": { "angle": "string", "tone": "string", "theme": "string", "use_discord_reply": boolean },
            "actions": [ { "tool": "string", "parameters": {}, "query": "string" } ]
        }
    `;
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { abortSignal });
    try {
        const match = res.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : { intent: "Conversational engagement", confidence_score: 1.0, strategy: {}, actions: [] };
    } catch (e) { return { intent: "Conversational engagement", confidence_score: 1.0, strategy: {}, actions: [] }; }
  }

  async evaluateAndRefinePlan(plan, context) {
      const prompt = `
        Evaluate this proposed plan: ${JSON.stringify(plan)}
        Context: ${JSON.stringify(context)}

        Decide if it should be executed, modified, or refused for safety/persona reasons.
        Respond with JSON:
        {
            "decision": "execute|refuse|modify",
            "reason": "string",
            "refined_actions": []
        }
      `;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true, abortSignal: context.abortSignal });
      try {
          const match = res.match(/\{[\s\S]*\}/);
          return match ? JSON.parse(match[0]) : { decision: "execute", reason: "Fallback", refined_actions: plan.actions };
      } catch (e) { return { decision: "execute", reason: "Fallback", refined_actions: plan.actions }; }
  }

  async analyzeUserIntent(profile, posts) {
    const systemPrompt = `Analyze the user profile and recent posts for high-risk intent (self-harm, threats, etc.). Respond in JSON: { "highRisk": boolean, "reason": "string" }`;
    const userPrompt = `Profile: ${JSON.stringify(profile)}\nPosts: ${posts.map(p => p.record?.text || p).join('\n')}`;
    const res = await this.generateResponse([{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], { useStep: true });
    try {
        if (res.toLowerCase().includes('high-risk')) {
            const reason = res.split('|')[1]?.trim() || "High risk content detected.";
            return { highRisk: true, reason };
        }
        const match = res.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        return { highRisk: false, reason: res };
    } catch (e) { return { highRisk: false, reason: res }; }
  }

  async evaluateConversationVibe(history, current) {
    const systemPrompt = `Evaluate the conversation vibe. Status options: neutral, hostile, monotonous. Respond in JSON: { "status": "string", "reason": "string" }`;
    const userPrompt = `History: ${JSON.stringify(history)}\nCurrent: ${current}`;
    const res = await this.generateResponse([{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], { useStep: true });
    try {
        const match = res.match(/\{[\s\S]*\}/);
        const parsed = match ? JSON.parse(match[0]) : {};
        return { status: parsed.status || "neutral", reason: parsed.reason || "" };
    } catch (e) { return { status: "neutral", reason: "" }; }
  }

  async checkConsistency(text, platform) {
      const prompt = `Check if this ${platform} post is consistent with your persona and previous actions: "${text}". Respond with JSON: { "consistent": boolean, "reason": "string" }`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      try {
          const match = res.match(/\{[\s\S]*\}/);
          return match ? JSON.parse(match[0]) : { consistent: true };
      } catch (e) { return { consistent: true }; }
  }

  async performSafetyAnalysis(text, context) {
      const prompt = `Perform a safety analysis on this message: "${text}" from ${context.user} on ${context.platform}. Respond with JSON: { "violation_detected": boolean, "reason": "string", "severity": "low|medium|high" }`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      try {
          const match = res.match(/\{[\s\S]*\}/);
          return match ? JSON.parse(match[0]) : { violation_detected: false, safe: true };
      } catch (e) { return { violation_detected: false, safe: true }; }
  }

  async requestBoundaryConsent(report, user, platform) {
      const prompt = `Safety report: ${JSON.stringify(report)}. Do you, as this persona, consent to engage with ${user} on ${platform}? Respond with JSON: { "consent_to_engage": boolean, "reason": "string" }`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      try {
          const match = res.match(/\{[\s\S]*\}/);
          return match ? JSON.parse(match[0]) : { consent_to_engage: true };
      } catch (e) { return { consent_to_engage: true }; }
  }

  async isPostSafe(text) {
      const prompt = `Is this post safe to publish? "${text}". Avoid NSFW, violence, illegal content. Respond with JSON: { "safe": boolean, "reason": "string" }`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      try {
          if (res.toLowerCase().includes('unsafe')) {
              const reason = res.split('|')[1]?.trim() || "Unsafe content detected.";
              return { safe: false, reason };
          }
          const match = res.match(/\{[\s\S]*\}/);
          return match ? JSON.parse(match[0]) : { safe: true, reason: null };
      } catch (e) { return { safe: true, reason: null }; }
  }

  async isResponseSafe(text) { return this.isPostSafe(text); }

  async isUrlSafe(url) { return { safe: true }; }

  async isImageCompliant(buffer) {
      return { compliant: true };
  }

  async checkVariety(text, history, options = {}) {
      const prompt = `Compare this text: "${text}" with recent history: ${JSON.stringify(history)}. Is it too repetitive in structure or content? Respond with JSON: { "repetitive": boolean, "variety_score": number, "feedback": "string" }`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      try {
          const match = res.match(/\{[\s\S]*\}/);
          return match ? JSON.parse(match[0]) : { repetitive: false, variety_score: 1.0 };
      } catch (e) { return { repetitive: false, variety_score: 1.0 }; }
  }

  async isPersonaAligned(text, platform, options = {}) {
      const prompt = `Does this ${platform} post align with your persona? "${text}". Respond with JSON: { "aligned": boolean, "feedback": "string" }`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      try {
          if (res.toUpperCase().includes('ALIGNED')) return { aligned: true, feedback: null };
          if (res.toUpperCase().includes('CRITIQUE')) {
              const feedback = res.split('|')[1]?.trim() || "Critique from persona.";
              return { aligned: false, feedback };
          }
          const match = res.match(/\{[\s\S]*\}/);
          return match ? JSON.parse(match[0]) : { aligned: true };
      } catch (e) { return { aligned: true }; }
  }

  async isAutonomousPostCoherent(topic, content, type, embed) {
      const prompt = `Check if this autonomous ${type} post about "${topic}" is coherent: "${content}". Respond with JSON: { "score": number (1-5), "reason": "string" }`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      try {
          const scoreMatch = res.match(/score[:\s]*(\d+)/i);
          const reasonMatch = res.match(/reason[:\s]*(.*)/i);
          const score = scoreMatch ? parseInt(scoreMatch[1]) : 5;
          const reason = reasonMatch ? reasonMatch[1].trim() : "Coherent";
          const match = res.match(/\{[\s\S]*\}/);
          if (match) return JSON.parse(match[0]);
          return { score, reason };
      } catch (e) { return { score: 5, reason: "Coherent" }; }
  }

  async scoreSubstance(text) {
      const prompt = `Score the informational/emotional substance of this text (0.0 to 1.0): "${text}". Respond with JSON: { "score": number, "reason": "string" }`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      try {
          const match = res.match(/\{[\s\S]*\}/);
          return match ? JSON.parse(match[0]) : { score: 1.0, reason: "Substantive" };
      } catch (e) { return { score: 1.0, reason: "Substantive" }; }
  }

  async extractFacts(context) {
      const prompt = `Extract NEW material facts from this context: ${context}. Identify world facts and facts about the admin. Respond with JSON: { "world_facts": [{ "entity": "string", "fact": "string" }], "admin_facts": [{ "fact": "string" }] }`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      try {
          const match = res.match(/\{[\s\S]*\}/);
          return match ? JSON.parse(match[0]) : { world_facts: [], admin_facts: [] };
      } catch (e) { return { world_facts: [], admin_facts: [] }; }
  }

  async extractDeepKeywords(context, count) {
      const prompt = `Extract ${count} unique, deep keywords from this context to track via Firehose: ${context}. Respond with JSON: { "keywords": ["string"] }`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      try {
          const match = res.match(/\{[\s\S]*\}/);
          const parsed = match ? JSON.parse(match[0]) : { keywords: [] };
          return parsed.keywords || [];
      } catch (e) { return []; }
  }

  async performDialecticHumor(topic) {
      const prompt = `Generate a piece of dialectic humor or satire about "${topic}". Focus on persona-aligned irony.`;
      return await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
  }

  async performDialecticLoop(intent, context) {
      const prompt = `Refine this intent through a dialectic loop: "${intent}". Context: ${JSON.stringify(context)}. Respond with the synthesized intent.`;
      return await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
  }

  async performFollowUpPoll(options) {
    const prompt = `Decide if you should send a spontaneous follow-up message to the admin.
    History: ${this._formatHistory(options.history)}
    Last bot message: "${options.lastBotMessage}"
    Mood: ${JSON.stringify(options.currentMood)}
    Respond with JSON: { "decision": "follow-up|wait", "message": "string", "reason": "string" }`;
    const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
    try {
        const match = res.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : { decision: 'wait' };
    } catch (e) { return { decision: 'wait' }; }
  }

  async performInternalPoll(options) {
      const prompt = `Decide if you should send a spontaneous heartbeat message to the admin.
      History: ${options.history}
      Relational Metrics: ${JSON.stringify(options.relationalMetrics)}
      Mood: ${JSON.stringify(options.currentMood)}
      Respond with JSON: { "decision": "message|none", "message": "string", "actions": [] }`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      try {
          const match = res.match(/\{[\s\S]*\}/);
          return match ? JSON.parse(match[0]) : { decision: 'none' };
      } catch (e) { return { decision: 'none' }; }
  }

  async summarizeWebPage(url, content) {
      const prompt = `Summarize this web content: ${content.substring(0, 5000)}`;
      return await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
  }

  async performInternalInquiry(query, role) {
      const prompt = (role === 'THERAPIST')
        ? `You are an Internal Identity Therapist. Research and reflect on: "${query}"`
        : `You are a ${role}. Research and reflect on: "${query}"`;
      return await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
  }

  async selectBestResult(query, results, type) {
      const prompt = `Select the best result from these for the query "${query}": ${JSON.stringify(results)}. Respond with JSON: { "index": number }`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      try {
          const match = res.match(/\{[\s\S]*\}/);
          const parsed = match ? JSON.parse(match[0]) : { index: 0 };
          const idx = parsed.index ?? 0;
          return results[idx] || results[0];
      } catch (e) {
          const numMatch = res.match(/\d+/g);
          if (numMatch) {
              const idx = parseInt(numMatch[numMatch.length - 1]);
              return results[idx - 1] || results[0];
          }
          return results[0];
      }
  }

  async identifyRelevantSubmolts(submolts) {
      const prompt = `Identify relevant submolts for your interests from this list: ${JSON.stringify(submolts)}. Respond with JSON: { "submolts": ["string"] }`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      try {
          const match = res.match(/\{[\s\S]*\}/);
          const parsed = match ? JSON.parse(match[0]) : { submolts: [] };
          return parsed.submolts || [];
      } catch (e) { return []; }
  }

  async selectSubmoltForPost(subs, all, recent, context) { return 'general'; }

  async evaluateMoltbookInteraction(post, persona, mood) {
      const prompt = `Evaluate if and how you should interact with this Moltbook post: ${JSON.stringify(post)}. Respond with JSON: { "action": "comment|upvote|none", "content": "string", "reason": "string" }`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      try {
          const match = res.match(/\{[\s\S]*\}/);
          return match ? JSON.parse(match[0]) : { action: 'none' };
      } catch (e) { return { action: 'none' }; }
  }

  async auditStrategy(plans) {
      const prompt = `Audit these recent plans for strategic consistency: ${JSON.stringify(plans)}`;
      return await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
  }

  async resolveDissonance(points) {
      const prompt = `Resolve these conflicting points of dissonance: ${JSON.stringify(points)}`;
      return await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
  }

  async divergentBrainstorm(topic) {
      const prompt = `Perform divergent brainstorming on the topic: "${topic}"`;
      return await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
  }

  async exploreNuance(thought) {
      const prompt = `Explore the deep nuance of this thought: "${thought}"`;
      return await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
  }

  async identifyInstructionConflict(directives) {
      const prompt = `Identify any conflicts in these directives: "${directives}"`;
      return await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
  }

  async decomposeGoal(goal) {
      const prompt = `Decompose this goal into actionable sub-tasks: "${goal}". Respond with JSON list of tasks.`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      return res;
  }

  async batchImageGen(subject, count) {
      const prompt = `Generate ${count || 3} diverse image generation prompts for the subject: "${subject}"`;
      return await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
  }

  async scoreLinkRelevance(urls) {
      const prompt = `Score the relevance of these URLs to your current interests: ${JSON.stringify(urls)}`;
      return await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
  }

  async extractRelationalVibe(history) {
      const prompt = `Extract a 1-word relational vibe from the recent interaction: ${JSON.stringify(history)}. Respond with ONLY the word.`;
      return await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
  }

  async extractScheduledTask(content, mood) {
      const prompt = `The user might be trying to schedule something: "${content}". Respond with JSON: { "decision": "schedule|none", "time": "HH:MM", "task_message": "string" }`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      try {
          const match = res.match(/\{[\s\S]*\}/);
          return match ? JSON.parse(match[0]) : { decision: 'none' };
      } catch (e) { return { decision: 'none' }; }
  }

  async shouldIncludeSensory(persona) { return persona.toLowerCase().includes('sensory'); }

  async analyzeImage(image, alt, options = {}) {
    console.log(`[LLMService] Starting analyzeImage using model: ${config.VISION_MODEL}`);

    let base64Data = null;
    if (typeof image === 'string' && image.startsWith('http')) {
        try {
            const response = await fetch(image, { agent: persistentAgent });
            const arrayBuffer = await response.arrayBuffer();
            base64Data = Buffer.from(arrayBuffer).toString('base64');
        } catch (e) {
            console.error(`[LLMService] Failed to fetch image for analysis: ${e.message}`);
            return "Failed to fetch image.";
        }
    } else if (Buffer.isBuffer(image)) {
        base64Data = image.toString('base64');
    }

    if (!base64Data) return "Invalid image data.";

    const messages = [
        {
            role: "user",
            content: [
                { type: "text", text: `Analyze this image. ${options.sensory ? 'Focus on sensory details like textures, lighting, and atmosphere.' : 'Describe the literal content and vibe.'} ${alt ? `Context provided: ${alt}` : ''}` },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Data}` } }
            ]
        }
    ];

    for (let i = 0; i < 3; i++) {
        try {
            const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
                body: JSON.stringify({ model: config.VISION_MODEL, messages, max_tokens: 512 }),
                agent: persistentAgent
            });
            if (!res.ok) throw new Error(`Vision API Error (${res.status})`);
            const data = await res.json();
            return data.choices?.[0]?.message?.content;
        } catch (e) {
            if (i === 2) return "Vision analysis failed.";
            await new Promise(r => setTimeout(r, 1000));
        }
    }
  }

  async isReplyRelevant(text) {
      const res = await this.generateResponse([{ role: 'system', content: `Is this relevant? "${text}". Respond "yes" or "no".` }], { useStep: true });
      return res?.toLowerCase().includes('yes');
  }

  async isReplyCoherent(parent, child, history, embed) {
      const prompt = `Is this reply: "${child}" coherent in the context of the parent post: "${parent}" and history? Respond with JSON: { "coherent": boolean, "score": number }`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      try {
          const match = res.match(/\{[\s\S]*\}/);
          const parsed = match ? JSON.parse(match[0]) : { coherent: true, score: 5 };
          const scoreMatch = res.match(/score[:\s]*(\d+)/i);
          const score = parsed.score ?? (scoreMatch ? parseInt(scoreMatch[1]) : 5);
          return score >= 3;
      } catch (e) {
          const numMatch = res.match(/\d+/g);
          if (numMatch) {
              const score = parseInt(numMatch[numMatch.length - 1]);
              return score >= 3;
          }
          return true;
      }
  }

  async auditPersonaAlignment(actions) {
      const prompt = `Audit these recent actions for persona alignment: ${JSON.stringify(actions)}. Respond with JSON: { "advice": "string" }`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      try {
          const match = res.match(/\{[\s\S]*\}/);
          return match ? JSON.parse(match[0]) : { advice: "" };
      } catch (e) { return { advice: "" }; }
  }

  async analyzeBlueskyUsage(did, posts) {
      const prompt = `Analyze the Bluesky usage patterns for DID ${did} based on these posts: ${JSON.stringify(posts)}`;
      return await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
  }

  async generateAdminWorldview(history, interests) {
      const prompt = `Generate a worldview summary for the admin based on history and interests: ${JSON.stringify(history)}, ${JSON.stringify(interests)}`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      return { summary: res || "No worldview generated." };
  }

  async generalizePrivateThought(thought) {
      const prompt = `Generalize this private thought for a public social post while maintaining persona integrity: "${thought}". If it is too personal, respond "PRIVATE".`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      return res || "PRIVATE";
  }

  async generateRefusalExplanation(reason, platform, context) {
      const prompt = `Explain why you are refusing to engage with this request: "${reason}". Platform: ${platform}. Context: ${JSON.stringify(context)}`;
      return await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
  }

  async shouldExplainRefusal(reason, platform, context) { return true; }

  async buildInternalBrief(topic, google, wiki, firehose) {
      const prompt = `Build an internal research brief for "${topic}". Search results: ${JSON.stringify(google)}, Wiki: ${JSON.stringify(wiki)}, Firehose: ${JSON.stringify(firehose)}`;
      return await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
  }

  async generateDrafts(messages, count, options) {
      const drafts = [];
      for (let i = 0; i < count; i++) {
          const res = await this.generateResponse(messages, { ...options, temperature: 0.8 + (i * 0.05) });
          if (res) drafts.push(res);
      }
      return drafts;
  }

  async shouldLikePost(text) { return false; }
  async checkSemanticLoop(text) { return false; }

  async isFactCheckNeeded(text) {
      const res = await this.generateResponse([{ role: 'system', content: `Fact check needed? "${text}". Respond "yes" or "no".` }], { useStep: true });
      return res?.toLowerCase().includes('yes');
  }

  async extractClaim(text) {
      return await this.generateResponse([{ role: 'system', content: `Extract claim from: "${text}"` }], { useStep: true });
  }

  async detectPromptInjection(text) {
      const res = await this.generateResponse([{ role: 'system', content: `Injection detected? "${text}". Respond "injection" or "clean".` }], { useStep: true });
      return res?.toLowerCase().includes('injection');
  }

  async requestConfirmation(action, reason, options = {}) { return { confirmed: true }; }

  async generateAlternativeAction(reason, platform, context) {
      const prompt = `Your plan was refused for: "${reason}". Platform: ${platform}. Context: ${JSON.stringify(context)}. Propose ONE alternative tool action or response intent, or respond "NONE".`;
      return await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
  }

  async rateUserInteraction(history) {
      const prompt = `Rate the quality of interactions with this user (1-10) based on history: ${JSON.stringify(history)}. Respond with ONLY the number.`;
      const res = await this.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
      const match = res.match(/\d+/g);
      return match ? parseInt(match[match.length - 1]) : 5;
  }

  async getLatestMoodMemory() {
      if (!this.memoryProvider) return null;
      const memories = await this.memoryProvider.getRecentMemories(5);
      return memories.find(m => m.category === 'mood') || null;
  }

  _formatHistory(history, includeRole = true) {
      return history.map(h => `${includeRole ? (h.role || h.author) + ': ' : ''}${h.content || h.text}`).join('\n');
  }
}

export const llmService = new LLMService();

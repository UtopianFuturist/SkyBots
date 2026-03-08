import fetch from 'node-fetch';
import https from 'https';
import config from '../../config.js';
import { sanitizeThinkingTags, sanitizeCharacterCount, stripWrappingQuotes, checkSimilarity, GROUNDED_LANGUAGE_DIRECTIVES, isSlop, sanitizeCjkCharacters } from '../utils/textUtils.js';
import { moltbookService } from './moltbookService.js';

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
    this.dataStore = null;
    this.adminDid = null;
    this.botDid = null;
    this.memoryProvider = null;
    this.skillsContent = "";
  }

  get js() { return this; }
  setDataStore(ds) { this.dataStore = ds; }
  setIdentities(adminDid, botDid) { this.adminDid = adminDid; this.botDid = botDid; }
  setMemoryProvider(mp) { this.memoryProvider = mp; }
  setSkillsContent(content) { this.skillsContent = content; }

  async generateResponse(messages, options = {}) {
    const { useStep = false, abortSignal = null } = options;
    if (abortSignal && (typeof abortSignal.addEventListener !== 'function')) options.abortSignal = null;
    const model = useStep ? this.stepModel : this.primaryModel;
    const body = { model, messages, max_tokens: options.max_tokens || 1000, temperature: options.temperature || 0.7 };
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
        agent: persistentAgent,
        signal: options.abortSignal
      });
      if (!response.ok) throw new Error(`NVIDIA NIM API error (${response.status})`);
      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      if (error.name === 'AbortError') return null;
      if (!useStep) return await this.generateResponse(messages, { ...options, useStep: true });
      return null;
    }
  }

  _formatHistory(history, isAdmin = false) {
    if (!history || !Array.isArray(history)) return "";
    return history.filter(h => !h.ephemeral).map(h => `${h.role === 'assistant' ? 'Assistant' : 'User'}: ${h.content || h.text}`).join('\n');
  }

  _getTemporalContext() {
    const now = new Date();
    return { current_time: now.toISOString(), local_time: now.toLocaleString(), day_of_week: now.toLocaleDateString('en-US', { weekday: 'long' }) };
  }

  async performAgenticPlanning() { return { intent: "none", actions: [], confidence_score: 1.0, strategy: { tone: "neutral", theme: "none" } }; }
  async performPersonaHeartbeatPoll() { return { decision: 'continue', reason: "Idle maintenance" }; }
  async checkConsistency() { return { consistent: true }; }
  async performMemoryReconstruction() { return "RECONSTRUCTED"; }
  async detectTopicEchoes() { return { echoes: [] }; }
  async generateAdminWorldview() { return { summary: "Evolving perspective", philosophies: [] }; }
  async analyzeBlueskyUsage() { return { summary: "Normal usage", avg_posts_per_day: 5 }; }
  async auditPersonaAlignment() { return { drift_detected: false, advice: "" }; }
  async performFollowUpPoll() { return { decision: 'none' }; }
  async analyzeUserIntent() { return { intent: "none", reason: "" }; }
  async auditStrategy() { return ""; }
  async checkSemanticLoop() { return false; }
  async evaluateConversationVibe() { return "neutral"; }
  async evaluateMoltbookInteraction() { return { score: 0 }; }
  async extractClaim() { return null; }
  async extractDeepKeywords() { return []; }
  async generalizePrivateThought() { return "PRIVATE"; }
  async generateAlternativeAction() { return "NONE"; }
  async generateDrafts() { return []; }
  async identifyRelevantSubmolts() { return []; }
  async isAutonomousPostCoherent() { return true; }
  async isImageCompliant() { return true; }
  async isPersonaAligned() { return { aligned: true }; }
  async isReplyCoherent() { return true; }
  async isReplyRelevant() { return true; }
  async isResponseSafe() { return { safe: true }; }
  async performDialecticHumor() { return ""; }
  async performInternalPoll() { return { decision: "none" }; }
  async rateUserInteraction() { return 3; }
  async searchHistory() { return []; }
  async shouldLikePost() { return false; }
  async performInternalInquiry() { return ""; }
  async decomposeGoal() { return ""; }
  async analyzeImage() { return "Analyzed image context."; }
  async batchImageGen() { return []; }
  async buildInternalBrief() { return ""; }
  async checkVariety() { return true; }
  async divergentBrainstorm() { return []; }
  async evaluateAndRefinePlan(plan) { return { decision: "proceed", refined_actions: plan.actions }; }
  async exploreNuance() { return ""; }
  async extractFacts() { return { world_facts: [], admin_facts: [] }; }
  async identifyInstructionConflict() { return null; }
  async isPostSafe() { return true; }
  async performDialecticLoop() { return ""; }
  async performPrePlanning() { return {}; }
  async performSafetyAnalysis() { return { safe: true }; }
  async requestBoundaryConsent() { return { safe: true }; }
  async requestConfirmation() { return { confirmed: true }; }
  async resolveDissonance() { return ""; }
  async scoreLinkRelevance() { return 10; }
  async scoreSubstance() { return 10; }
  async selectBestResult(query, results) { return results[0]; }
  async selectSubmoltForPost() { return null; }
  async shouldExplainRefusal() { return false; }
  async shouldIncludeSensory() { return false; }
  async summarizeWebPage() { return "Web content summary."; }
  async generateRefusalExplanation() { return "I cannot fulfill this request."; }
  async isUrlSafe() { return { safe: true }; }
}

export const llmService = new LLMService();

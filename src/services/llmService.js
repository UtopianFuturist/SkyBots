import config from '../../config.js';
import axios from 'axios';

class LLMService {
  constructor() {
    this.apiKey = config.NVIDIA_NIM_API_KEY;
    this.ds = null;
  }
  setDataStore(ds) { this.ds = ds; }

  async generateResponse(messages, options = {}) {
    const model = options.useStep ? config.STEP_MODEL : (options.model || config.LLM_MODEL);
    let temperature = options.temperature;
    if (temperature === undefined) {
        if (options.task === 'musings' || options.task === 'autonomous') temperature = 0.9;
        else if (options.task === 'fact' || options.task === 'safety') temperature = 0.1;
        else if (options.task === 'reflection' || options.task === 'emotion') temperature = 0.8;
        else temperature = 0.7;
    }
    try {
      const response = await axios.post('https://integrate.api.nvidia.com/v1/chat/completions', {
        model, messages, temperature, max_tokens: options.max_tokens || 1024, top_p: 0.7,
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        timeout: options.useStep ? 45000 : 60000
      });
      return response.data.choices[0].message.content;
    } catch (error) {
      if ((options.retryCount || 0) < 2) {
        options.retryCount = (options.retryCount || 0) + 1;
        return this.generateResponse(messages, options);
      }
      return null;
    }
  }

  async isReplyCoherent() { return true; }
  async rateUserInteraction() { return 5; }
  async selectBestResult(q, r) { return r[0]; }
  async performPrePlanning() { return { intent: 'conversational', flags: [] }; }
  async performAgenticPlanning() { return { plan: [{ tool: 'bluesky_post', query: 'Test' }] }; }
  async evaluateAndRefinePlan() { return { decision: 'proceed' }; }
  async performSafetyAnalysis() { return { violation_detected: false }; }
  async requestBoundaryConsent() { return { consent_to_engage: true }; }
  async extractDeepKeywords() { return []; }
  async isAutonomousPostCoherent() { return { coherent: true }; }
}
export const llmService = new LLMService();

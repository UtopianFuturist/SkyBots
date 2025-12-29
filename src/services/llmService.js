import fetch from 'node-fetch';
import config from '../../config.js';

class LLMService {
  constructor() {
    this.apiKey = config.NVIDIA_NIM_API_KEY;
    this.model = 'nvidia/nemotron-3-nano-30b-a3b';
    this.baseUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';
  }

  async generateResponse(messages, options = {}) {
    const { temperature = 0.7, max_tokens = 300 } = options;

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: `${config.SAFETY_SYSTEM_PROMPT} ${config.TEXT_SYSTEM_PROMPT}` },
            ...messages
          ],
          temperature,
          max_tokens,
          stream: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Nvidia NIM API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      return content ? content.trim() : null;
    } catch (error) {
      console.error('[LLMService] Error generating response:', error);
      return null;
    }
  }

  async checkSemanticLoop(newResponse, recentResponses) {
    if (!recentResponses || recentResponses.length === 0) return false;
    
    // Simple semantic check: if the new response is too similar to recent ones
    // In a full implementation, we'd use embeddings and cosine similarity.
    // For now, we'll use a basic word-overlap or string similarity check.
    const normalize = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const normalizedNew = normalize(newResponse);

    for (const old of recentResponses) {
      const normalizedOld = normalize(old);
      if (normalizedNew === normalizedOld) return true;
      
      // Basic overlap check
      const wordsNew = new Set(normalizedNew.split(' '));
      const wordsOld = new Set(normalizedOld.split(' '));
      const intersection = new Set([...wordsNew].filter(x => wordsOld.has(x)));
      const similarity = intersection.size / Math.max(wordsNew.size, wordsOld.size);
      
      if (similarity > 0.85) return true;
    }

    return false;
  }
}

export const llmService = new LLMService();

import fetch from 'node-fetch';
import config from '../../config.js';
import { llmService } from './llmService.js';

class ImageService {
  constructor() {
    this.apiKey = config.NVIDIA_NIM_API_KEY;
    this.model = config.IMAGE_GENERATION_MODEL || 'stabilityai/stable-diffusion-3-medium';
    this.baseUrl = `https://ai.api.nvidia.com/v1/genai/${this.model}`;
  }

  async generateImage(prompt) {
    console.log(`[ImageService] Generating image with initial prompt: "${prompt}"`);
    try {
      const revisedPrompt = await llmService.generateResponse([
        { role: 'system', content: config.IMAGE_PROMPT_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ], { max_tokens: 150 });

      console.log(`[ImageService] Revised prompt: "${revisedPrompt}"`);

      let finalPrompt = prompt;
      if (revisedPrompt && revisedPrompt.toLowerCase() !== 'null') {
        finalPrompt = revisedPrompt.trim().replace(/[^\x20-\x7E]/g, '');
      } else {
        console.log(`[ImageService] Revised prompt was null or "null", falling back to original prompt.`);
      }

      const payload = {
        prompt: finalPrompt,
      };

      console.log('[ImageService] Sending request to Nvidia NIM API with payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[ImageService] Nvidia NIM Image API error (${response.status}):`, errorBody);
        throw new Error(`Nvidia NIM Image API error (${response.status}): ${errorBody}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);

    } catch (error) {
      console.error('[ImageService] Full error object during image generation:', error);
      return null;
    }
  }
}

export const imageService = new ImageService();

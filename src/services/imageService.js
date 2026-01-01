import fetch from 'node-fetch';
import config from '../../config.js';
import { llmService } from './llmService.js';

class ImageService {
  constructor() {
    this.apiKey = config.NVIDIA_NIM_API_KEY;
    this.model = 'black-forest-labs/flux_1-schnell';
    this.baseUrl = 'https://ai.api.nvidia.com/v1/genai/images/base';
  }

  async generateImage(prompt) {
    console.log(`[ImageService] Generating image with initial prompt: "${prompt}"`);
    try {
      const revisedPrompt = await llmService.generateResponse([
        { role: 'system', content: config.IMAGE_PROMPT_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ], { max_tokens: 150 });

      console.log(`[ImageService] Revised prompt: "${revisedPrompt}"`);

      const payload = {
        prompt: revisedPrompt || prompt,
        size: '1024x1024',
        response_format: 'b64_json',
        model: this.model
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

      const data = await response.json();
      const imageBase64 = data.data[0]?.b64_json;

      if (!imageBase64) {
        throw new Error('No image data returned from API.');
      }

      // We need to upload the image to Bluesky, which requires a buffer.
      return Buffer.from(imageBase64, 'base64');

    } catch (error) {
      console.error('[ImageService] Error generating image:', error);
      return null;
    }
  }
}

export const imageService = new ImageService();

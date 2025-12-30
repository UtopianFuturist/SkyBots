import fetch from 'node-fetch';
import config from '../../config.js';
import { llmService } from './llmService.js';

class ImageService {
  constructor() {
    this.apiKey = config.NVIDIA_NIM_API_KEY;
    // The user specified Flux Schnell, which is a specific model.
    // The API endpoint might be different from the text generation one.
    // I will assume a similar structure and model name for now.
    this.model = 'nvidia/flux-schnell';
    this.baseUrl = 'https://integrate.api.nvidia.com/v1/images/generations';
  }

  async generateImage(prompt) {
    console.log(`[ImageService] Generating image with prompt: "${prompt}"`);
    try {
      const revisedPrompt = await llmService.generateResponse([
        { role: 'system', content: config.IMAGE_PROMPT_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ], { max_tokens: 150 });

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          prompt: revisedPrompt || prompt,
          n: 1,
          size: '1024x1024',
          response_format: 'b64_json',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Nvidia NIM Image API error (${response.status}): ${errorText}`);
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

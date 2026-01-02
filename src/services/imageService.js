import fetch from 'node-fetch';
import config from '../../config.js';
import { llmService } from './llmService.js';

class ImageService {
  constructor() {
    this.apiKey = config.NVIDIA_NIM_API_KEY;
    this.model = 'black-forest-labs/flux.1-schnell';
    this.baseUrl = 'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell';
  }

  async generateImage(prompt) {
    console.log(`[ImageService] Generating image with prompt: "${prompt}"`);
    try {
      // The prompt revision has been removed to simplify the process and avoid potential errors.
      // We now use the user's original prompt directly.
      const payload = {
        prompt: prompt,
        size: '1024x1024',
        response_format: 'b64_json',
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
        console.error('[ImageService] No image data in API response:', JSON.stringify(data, null, 2));
        throw new Error('No image data returned from API.');
      }

      console.log(`[ImageService] Successfully received image data from API.`);

      // We need to upload the image to Bluesky, which requires a buffer.
      return Buffer.from(imageBase64, 'base64');

    } catch (error) {
      console.error('[ImageService] Full error object during image generation:', error);
      return null;
    }
  }
}

export const imageService = new ImageService();

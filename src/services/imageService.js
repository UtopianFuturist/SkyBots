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
        cfg_scale: 5,
        aspect_ratio: "1:1",
        seed: 0,
        steps: 50,
        negative_prompt: ""
      };

      console.log('[ImageService] Sending request to Nvidia NIM API with payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[ImageService] Nvidia NIM Image API error (${response.status}):`, errorBody);
        throw new Error(`Nvidia NIM Image API error (${response.status}): ${errorBody}`);
      }

      const data = await response.json();
      
      // The API returns an object with a 'artifacts' array containing base64 images
      // or sometimes a different structure. Based on the screenshot, it was 422.
      // Let's handle the response based on the standard NIM visual API format.
      const imageAsset = data.artifacts?.[0]?.base64 || data.data?.[0]?.url || data.data?.[0]?.b64_json;

      if (!imageAsset) {
        console.error('[ImageService] No image data in API response:', JSON.stringify(data, null, 2));
        throw new Error('No image data returned from API.');
      }

      console.log(`[ImageService] Successfully received image data from API.`);

      if (imageAsset.startsWith('http')) {
        const imageResponse = await fetch(imageAsset);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image from URL: ${imageResponse.statusText}`);
        }
        const arrayBuffer = await imageResponse.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } else {
        // Assume base64
        return Buffer.from(imageAsset, 'base64');
      }

    } catch (error) {
      console.error('[ImageService] Full error object during image generation:', error);
      return null;
    }
  }
}

export const imageService = new ImageService();

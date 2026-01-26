import fetch from 'node-fetch';
import config from '../../config.js';
import { llmService } from './llmService.js';

class ImageService {
  constructor() {
    this.apiKey = config.NVIDIA_NIM_API_KEY;
    this.model = config.IMAGE_GENERATION_MODEL || 'stabilityai/stable-diffusion-3-medium';
    this.baseUrl = `https://ai.api.nvidia.com/v1/genai/${this.model}`;
  }

  async generateImage(prompt, options = { allowPortraits: true }) {
    console.log(`[ImageService] Generating image with initial prompt: "${prompt}" (allowPortraits: ${options.allowPortraits})`);
    try {
      const portraitConstraint = options.allowPortraits
        ? ""
        : "**CRITICAL: Do not generate prompts for portraits, close-ups of faces, or complex human anatomy. ABSOLUTELY NO PEOPLE OR HUMANS ALLOWED.**";

      const systemContent = `
        ${config.IMAGE_PROMPT_SYSTEM_PROMPT}

        ${portraitConstraint}

        If the input is an abstract concept (e.g., "vulnerability", "technology", "emotion"), you MUST convert it into a literal, tangible scene.
        Think in terms of objects, landscapes, digital spaces, or environments.
        Example: Instead of "The Intersection of Technology and Human Vulnerability", describe "A lone, rusted robotic hand gently holding a single, glowing blue flower in a dark, atmospheric cyberpunk alleyway."

        CRITICAL: Your entire response MUST be under 270 characters to ensure it fits within social media limits.
        IMPORTANT: Respond directly with the prompt. DO NOT include reasoning, <think> tags, or conversational filler.

        Adopt the following persona for your visual style and decision-making:
        "${config.TEXT_SYSTEM_PROMPT}"
      `.trim();

      const revisedPrompt = await llmService.generateResponse([
        { role: 'system', content: systemContent },
        { role: 'user', content: prompt }
      ], { max_tokens: 500, preface_system_prompt: false });

      console.log(`[ImageService] Revised prompt: "${revisedPrompt}"`);

      let finalPrompt = prompt;
      if (revisedPrompt && revisedPrompt.toLowerCase() !== 'null') {
        finalPrompt = revisedPrompt.trim().replace(/[^\x20-\x7E]/g, '');
        // Force character limit (270 chars + prefix ensures it stays under 300)
        if (finalPrompt.length > 270) {
          finalPrompt = finalPrompt.substring(0, 267) + "...";
        }
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
      
      // Based on the documentation and user feedback, the image is in the 'image' field
      // and the status is in 'finish_reason'.
      const imageAsset = data.image || data.artifacts?.[0]?.base64 || data.data?.[0]?.url || data.data?.[0]?.b64_json;

      if (!imageAsset) {
        console.error('[ImageService] No image data in API response:', JSON.stringify(data, null, 2));
        throw new Error('No image data returned from API.');
      }

      console.log(`[ImageService] Successfully received image data from API. Finish reason: ${data.finish_reason}`);

      let buffer;
      if (typeof imageAsset === 'string' && imageAsset.startsWith('http')) {
        const imageResponse = await fetch(imageAsset);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image from URL: ${imageResponse.statusText}`);
        }
        const arrayBuffer = await imageResponse.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else {
        // Assume base64 string
        buffer = Buffer.from(imageAsset, 'base64');
      }

      return { buffer, finalPrompt };

    } catch (error) {
      console.error('[ImageService] Full error object during image generation:', error);
      return null;
    }
  }
}

export const imageService = new ImageService();

import fetch from 'node-fetch';
import config from '../../config.js';
import { persistentAgent } from './llmService.js';

class ImageService {
  get js() { return this; }

  async generateImage(prompt, options = {}) {
    console.log(`[ImageService] Generating image for: ${prompt}`);
    try {
        const response = await fetch('https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-xl', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.NVIDIA_NIM_API_KEY}`
            },
            body: JSON.stringify({
                text_prompts: [{ text: prompt, weight: 1 }],
                cfg_scale: 7,
                steps: 30,
                seed: options.seed || Math.floor(Math.random() * 1000000)
            }),
            agent: persistentAgent
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const buffer = Buffer.from(data.artifacts[0].base64, 'base64');
        return { buffer, prompt };
    } catch (e) {
        console.error('[ImageService] Error:', e.message);
        return null;
    }
  }
}

export const imageService = new ImageService();

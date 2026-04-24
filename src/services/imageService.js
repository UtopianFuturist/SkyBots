import fetch from 'node-fetch';
import config from '../../config.js';
import { persistentAgent } from './llmService.js';

class ImageService {
  get js() { return this; }
  async generateImage(prompt, options = {}) {
    console.log(`[ImageService] Generating image for: ${prompt}`);
    try {
        const response = await fetch('https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux-1-schnell', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.NVIDIA_NIM_API_KEY}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                mode: "text-to-image",
                aspect_ratio: "1:1",
                seed: options.seed || Math.floor(Math.random() * 1000000)
            }),
            agent: persistentAgent
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const b64 = data.image || data.data?.[0]?.b64_json || data.artifacts?.[0]?.base64;
        if (!b64) throw new Error("No data");
        return { buffer: Buffer.from(b64, 'base64'), prompt };
    } catch (e) {
        console.error('[ImageService] Error:', e.message);
        return null;
    }
  }
}
export const imageService = new ImageService();
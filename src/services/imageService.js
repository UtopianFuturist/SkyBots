import fetch from 'node-fetch';
import config from '../../config.js';
import { llmService } from './llmService.js';

class ImageService {
  constructor() {
    this.apiKey = config.NVIDIA_NIM_API_KEY;
    this.model = config.IMAGE_GENERATION_MODEL || 'stabilityai/stable-diffusion-3-medium';
    this.baseUrl = `https://ai.api.nvidia.com/v1/genai/${this.model}`;
  }

  async generateImage(prompt, options = { allowPortraits: true, feedback: null, mood: null }) {
    console.log(`[ImageService] Generating image with initial prompt: "${prompt}" (allowPortraits: ${options.allowPortraits})`);
    try {
      const portraitConstraint = options.allowPortraits
        ? ""
        : "**CRITICAL: Do not generate prompts for portraits, close-ups of faces, or complex human anatomy. ABSOLUTELY NO PEOPLE OR HUMANS ALLOWED.**";

      const feedbackInstruction = options.feedback
        ? `\n\n**IMPORTANT FEEDBACK FOR ADJUSTMENT:** Your previous prompt for this topic was rejected for the following reason: "${options.feedback}". You MUST adjust your description to address this feedback while maintaining the same core theme. Do NOT mention this feedback in your output.`
        : "";

      const moodInstruction = options.mood
        ? `\n\n**CURRENT MOOD:** Your current emotional state is: ${options.mood.label} (Valence: ${options.mood.valence}, Arousal: ${options.mood.arousal}, Stability: ${options.mood.stability}).
        Incorporate the visual aesthetic, lighting, and atmosphere of this mood into your scene description naturally.
        - Higher Valence (+): Brighter, warmer, more harmonious visuals.
        - Lower Valence (-): Darker, colder, more fractured or heavy visuals.
        - Higher Arousal (+): More intense, sharp, chaotic, or dynamic visuals.
        - Lower Arousal (-): More calm, soft, blurred, or still visuals.
        - Lower Stability (-): More glitchy, unstable, or shifting visuals.`
        : "";

      const systemContent = `
        ${config.IMAGE_PROMPT_SYSTEM_PROMPT}

        ${portraitConstraint}
        ${feedbackInstruction}
        ${moodInstruction}

        EXPANSION MANDATE: Regardless of whether the input is a literal subject (e.g., "Mountains") or an abstract concept (e.g., "vulnerability"), you MUST expand it into a detailed, tangible, and evocative visual scene.
        Think in terms of composition, lighting, textures, objects, and environment.
        Example for "Mountains": "Jagged, snow-capped peaks piercing through a sea of thick, expressive clouds under a cold, crystalline sky. Dramatic shadows stretch across deep rocky ravines, captured in high-contrast cinematic realism."

        CRITICAL: Your entire response MUST be under 270 characters.
        CRITICAL: Do NOT simply repeat the input subject. You MUST generate a descriptive scene.
        IMPORTANT: Respond directly with the prompt. DO NOT include reasoning, <think> tags, or conversational filler.
        STRICTLY NO MONOLOGUE: Only output the finalized prompt text.

        If you are unable to generate a prompt for any reason, provide a safe, detailed visual description of the input subject. NEVER respond with "null" or the input word alone.

        Adopt the following persona's aesthetic values and perspective for your scene description:
        "${config.TEXT_SYSTEM_PROMPT}"
        (NOTE: While your persona values being "Concise", for this specific task you MUST prioritize descriptive depth and substance over brevity. "Concise" here means no meta-talk or filler, NOT a short prompt.)
      `.trim();

      const revisedPrompt = await llmService.generateResponse([
        { role: 'system', content: systemContent },
        { role: 'user', content: prompt }
      ], { max_tokens: 500, preface_system_prompt: false, useQwen: true });

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

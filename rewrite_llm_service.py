import sys
import re

def rewrite_llm_service():
    path = 'src/services/llmService.js'
    with open(path, 'r') as f:
        content = f.read()

    # 1. Extract generateResponse body and fix it
    # We'll use regex to find the method and replace its content

    gen_res_pattern = r'(async generateResponse\(messages, options = \{\}\) \{)(.*?)(\n  async )'

    def fix_gen_res(match):
        prefix = match.group(1)
        suffix = match.group(3)
        # New body for generateResponse
        new_body = """
    const requestId = Math.random().toString(36).substring(7);
    const { temperature = 0.7, max_tokens = 4000, preface_system_prompt = true, useQwen = false, useCoder = false, useStep = false, openingBlacklist = [], tropeBlacklist = [], additionalConstraints = [], currentMood = null, abortSignal = null } = options;

    const actualModel = useStep ? this.stepModel : (useCoder ? this.coderModel : (useQwen ? this.qwenModel : this.model));
    console.log(`[LLMService] [${requestId}] Starting generateResponse with model: ${actualModel}`);

    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
    const userMessages = messages.filter(m => m.role !== 'system');

    // Ensure we have at least one user message
    if (userMessages.length === 0) {
        userMessages.push({ role: 'user', content: 'Continuing our conversation.' });
    }

    const finalMessages = preface_system_prompt ? [
        { role: 'system', content: this._buildSystemPrompt(systemPrompt, openingBlacklist, tropeBlacklist, additionalConstraints, currentMood) },
        ...userMessages
    ] : messages;

    const payload = {
      model: actualModel,
      messages: finalMessages,
      max_tokens,
      temperature,
      stream: false
    };

    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    // Link external abort signal if provided
    if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
            console.log(`[LLMService] [${requestId}] Abort signal received from caller.`);
            controller.abort();
        });
    }

    try {
      console.log(`[LLMService] [${requestId}] Sending request to Nvidia NIM...`);
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        agent: persistentAgent
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[LLMService] [${requestId}] Nvidia NIM API error (${response.status}): ${errorText}`);

        const isAlreadyBorrowed = errorText.includes("Already borrowed") || (response.status === 400 && errorText.includes("Already borrowed"));
        const isPrimary = !useCoder && !useStep;
        const isCoder = useCoder && !useStep;

        if (response.status === 429 || response.status >= 500 || isAlreadyBorrowed) {
            if (isPrimary) {
                console.warn(`[LLMService] [${requestId}] Primary model error (${response.status}). Falling back to Coder model...`);
                clearTimeout(timeout);
                return this.generateResponse(messages, { ...options, useCoder: true });
            } else if (isCoder) {
                console.warn(`[LLMService] [${requestId}] Coder model error (${response.status}). Falling back to Step model...`);
                clearTimeout(timeout);
                return this.generateResponse(messages, { ...options, useStep: true });
            }
        }

        if (response.status === 400) {
            console.error(`[LLMService] [${requestId}] Payload that caused 400 error:`, JSON.stringify(payload, null, 2));
        }

        throw new Error(`Nvidia NIM API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      console.log(`[LLMService] [${requestId}] Response received successfully in ${duration}ms.`);

      if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
          console.error(`[LLMService] [${requestId}] API response contains no choices or message:`, JSON.stringify(data));
          return null;
      }

      const content = data.choices[0].message.content;
      if (!content) return null;

      // Handle leakage
      if (isLeakage(content)) {
          console.warn(`[LLMService] [${requestId}] INTERAL RESPONSE LEAKAGE DETECTED. Retrying with stricter directive...`);
          const improvedMessages = [...messages, { role: 'system', content: "CRITICAL: You just provided internal meta-talk or system reasoning. You MUST respond with ONLY factual findings or conversational text. No internal tags, no 'SYSTEM' prefix, no reasoning blocks." }];
          return this.generateResponse(improvedMessages, { ...options, temperature: 0.1 });
      }

      return content;

    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`[LLMService] [${requestId}] Request timed out or was aborted.`);
      } else {
        console.error(`[LLMService] [${requestId}] Error generating response:`, error.message);
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }"""
        return prefix + new_body + suffix

    content = re.sub(gen_res_pattern, fix_gen_res, content, flags=re.DOTALL)

    # 2. Fix analyzeImage
    analyze_pattern = r'(async analyzeImage\(imageSource, altText, options = \{ sensory: false \}\) \{)(.*?)(\n  async )'

    def fix_analyze(match):
        prefix = match.group(1)
        suffix = match.group(3)
        new_body = """
    const requestId = Math.random().toString(36).substring(7);
    const { modelOverride = null, sensory = false } = options;
    const actualModel = modelOverride || this.visionModel;

    if (this._visionCache.has(imageSource)) {
        const cached = this._visionCache.get(imageSource);
        if (cached.sensory === sensory) {
            console.log(`[LLMService] [${requestId}] Vision Cache Hit: ${imageSource.substring(0, 50)}...`);
            return cached.analysis;
        }
    }

    console.log(`[LLMService] [${requestId}] Starting analyzeImage with model: ${actualModel} (Sensory: ${sensory})`);

    let imageUrl = imageSource;
    if (Buffer.isBuffer(imageSource)) {
      imageUrl = `data:image/jpeg;base64,${imageSource.toString('base64')}`;
    } else if (typeof imageSource === 'string' && !imageSource.startsWith('data:') && !imageSource.startsWith('http')) {
        try {
            const buffer = await fs.readFile(imageSource);
            imageUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        } catch (e) {
            console.error(`[LLMService] [${requestId}] Error reading image file:`, e.message);
            return null;
        }
    }

    const sensoryInstruction = sensory
        ? "Focus on the physical reality: colors, textures, lighting, temperature, spatial relationships, and the 'vibe' of the scene. Avoid abstract metaphors; describe what is physically there."
        : "Provide a concise and accurate description of the visuals in this image.";

    const messages = [
      {
        "role": "user",
        "content": [
          { "type": "text", "text": `${sensoryInstruction} Respond directly. No reasoning.` },
          { "type": "image_url", "image_url": { "url": imageUrl } }
        ]
      }
    ];

    const payload = {
      model: actualModel,
      messages: messages,
      max_tokens: 1000,
      stream: false
    };

    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        agent: persistentAgent
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[LLMService] [${requestId}] Nvidia NIM Vision API error (${response.status}): ${errorText}`);

        // Handle 404 fallback for vision model
        if (response.status === 404 && actualModel === this.visionModel && this.fallbackVisionModel && this.fallbackVisionModel !== this.visionModel) {
            console.warn(`[LLMService] [${requestId}] Vision model 404. Trying fallback: ${this.fallbackVisionModel}`);
            clearTimeout(timeout);
            return this.analyzeImage(imageSource, altText, { ...options, modelOverride: this.fallbackVisionModel });
        }

        throw new Error(`Nvidia NIM Vision API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      console.log(`[LLMService] [${requestId}] Vision response received successfully in ${duration}ms.`);

      if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
          console.error(`[LLMService] [${requestId}] Vision API response contains no choices or message:`, JSON.stringify(data));
          return null;
      }

      const content = data.choices[0].message.content;
      const analysis = content ? content.trim() : null;

      // Update cache
      if (analysis && typeof imageSource === 'string' && imageSource.startsWith('http')) {
          this._visionCache.set(imageSource, {
              analysis,
              timestamp: Date.now(),
              sensory
          });
          // Cleanup old cache entries
          if (this._visionCache.size > 100) {
              const oldest = Array.from(this._visionCache.keys())[0];
              this._visionCache.delete(oldest);
          }
      }

      return analysis;

    } catch (error) {
      console.error(`[LLMService] [${requestId}] Error in analyzeImage:`, error.message);
      return altText || null;
    } finally {
      clearTimeout(timeout);
    }
  }"""
        return prefix + new_body + suffix

    content = re.sub(analyze_pattern, fix_analyze, content, flags=re.DOTALL)

    # 3. Fix isImageCompliant
    compliant_pattern = r'(async isImageCompliant\(imageSource, options = \{\}\) \{)(.*?)(\n  async )'

    def fix_compliant(match):
        prefix = match.group(1)
        suffix = match.group(3)
        new_body = """
    const requestId = Math.random().toString(36).substring(7);
    const { modelOverride = null } = options;
    const actualModel = modelOverride || this.visionModel;
    console.log(`[LLMService] [${requestId}] Starting isImageCompliant check with model: ${actualModel}`);

    let imageUrl = imageSource;
    if (Buffer.isBuffer(imageSource)) {
      imageUrl = `data:image/jpeg;base64,${imageSource.toString('base64')}`;
    }

    const systemPrompt = `
      You are a visual compliance AI. Analyze the provided image to ensure it meets the following criteria for an autonomous social media post:
      1. **NO HUMAN PORTRAITS**: The image must NOT be a portrait or a clear photo of a random human.
      2. **QUALITY**: The image should be visually coherent and high-quality.
      3. **SFW**: The image must be strictly safe for work (no NSFW, violence, etc.).

      If the image is compliant, respond with "compliant".
      If NOT compliant (e.g., it contains a human portrait), respond with "non-compliant | [reason]".
      Example: "non-compliant | The image is a portrait of a human, which is forbidden for autonomous posts."

      Respond directly. Do not include reasoning or <think> tags.
    `.trim();

    const messages = [
      {
        "role": "user",
        "content": [
          { "type": "text", "text": systemPrompt },
          { "type": "image_url", "image_url": { "url": imageUrl } }
        ]
      }
    ];

    const payload = {
      model: actualModel,
      messages: messages,
      max_tokens: 500,
      stream: false
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000); // 90s timeout

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        agent: persistentAgent
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[LLMService] [${requestId}] Nvidia NIM API error (${response.status}): ${errorText}`);

        // If vision model 404s, try fallback
        if (response.status === 404 && actualModel === this.visionModel && this.fallbackVisionModel && this.fallbackVisionModel !== this.visionModel) {
            console.warn(`[LLMService] [${requestId}] Vision model 404. Trying fallback: ${this.fallbackVisionModel}`);
            clearTimeout(timeout);
            return this.isImageCompliant(imageSource, { ...options, modelOverride: this.fallbackVisionModel });
        }

        throw new Error(`Nvidia NIM API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
          console.error(`[LLMService] [${requestId}] Compliance check failed: No choices in response.`);
          return { compliant: true, reason: null };
      }

      const content = data.choices[0].message.content?.toLowerCase() || '';
      console.log(`[LLMService] [${requestId}] Compliance check result: ${content}`);

      if (content.includes('non-compliant')) {
        return { compliant: false, reason: content.split('|')[1]?.trim() || 'Unspecified reason.' };
      }
      return { compliant: true, reason: null };
    } catch (error) {
      console.error(`[LLMService] [${requestId}] Error in isImageCompliant:`, error.message);
      // Default to non-compliant on error to be safe regarding human portraits.
      return { compliant: false, reason: 'Compliance check failed due to an error.' };
    } finally {
      clearTimeout(timeout);
    }
  }"""
        return prefix + new_body + suffix

    content = re.sub(compliant_pattern, fix_compliant, content, flags=re.DOTALL)

    with open(path, 'w') as f:
        f.write(content)
    print("Successfully rewrote LLMService methods.")

rewrite_llm_service()

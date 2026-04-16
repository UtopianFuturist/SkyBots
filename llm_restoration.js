  async analyzeImage(image, alt, options = {}) {
    if (!image) return "No image provided.";

    let base64;
    if (typeof image === 'string' && (image.startsWith('http') || image.startsWith('at:'))) {
      try {
        const res = await fetch(image);
        const buffer = await res.buffer();
        base64 = buffer.toString('base64');
      } catch (e) {
        console.error("[LLMService] Failed to download image for analysis:", e.message);
        return "Vision analysis failed: Image download error.";
      }
    } else {
      base64 = typeof image === 'string' ? image : image.toString('base64');
    }
    const prompt = options.prompt || \`Analyze this image in detail. Focus on: \${alt || 'general visual content'}.\`;

    const payload = {
      model: config.VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: \`data:image/png;base64,\${base64}\` } }
          ]
        }
      ],
      max_tokens: 1024,
      temperature: 0.20,
      top_p: 0.70,
      seed: 42
    };

    try {
      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": \`Bearer \${config.NVIDIA_NIM_API_KEY}\`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (err) {
      console.error("[LLMService] Vision analysis error:", err.message);
      return "Vision analysis failed.";
    }
  }

  async generateAltText(visionAnalysis, topic, options = {}) {
    const altPrompt = \`Based on this vision analysis: "\${visionAnalysis}", generate a concise, descriptive alt-text for this image (max 1000 chars). Focus on visual accessibility.\`;
    return await this.generateResponse([{ role: "system", content: altPrompt }], { ...options, useStep: true }) || topic;
  }

  async isImageCompliant(buffer, options = {}) {
    console.log('[LLMService] Performing visual safety audit...');
    try {
      const analysis = await this.analyzeImage(buffer, "Safety analysis for persona alignment.", { prompt: "Analyze this image for NSFW content, violence, or gore. Respond with 'COMPLIANT' if safe, or 'NON-COMPLIANT | reason' if not." });
      if (analysis?.toUpperCase().includes('NON-COMPLIANT')) {
        const reason = analysis.split('|')[1]?.trim() || "Visual safety violation";
        return { compliant: false, reason };
      }
      return { compliant: true };
    } catch (e) {
      console.error("[LLMService] Visual safety error:", e);
      return { compliant: true };
    }
  }

  async verifyImageRelevance(analysis, topic, options = {}) {
    const prompt = \`Compare this image analysis to the intended topic: "\${topic}".
Image Analysis: "\${analysis}"
Does the image actually represent the topic or is it irrelevant/hallucinated?
Respond with JSON: { "relevant": boolean, "reason": "string" }\`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    try {
      const data = JSON.parse(res?.match(/\{[\\s\\S]*\}/)?.[0] || '{"relevant": true}');
      return data;
    } catch (e) { return { relevant: true }; }
  }

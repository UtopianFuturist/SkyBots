import fs from 'fs/promises';

async function fix() {
  const path = 'src/services/llmService.js';
  let content = await fs.readFile(path, 'utf-8');

  // Helper to replace method body
  function replaceMethod(content, name, newBody) {
    const start = content.indexOf(`async ${name}(`);
    if (start === -1) return content;
    const braceStart = content.indexOf('{', start);
    let count = 1;
    let pos = braceStart + 1;
    while (count > 0 && pos < content.length) {
      if (content[pos] === '{') count++;
      else if (content[pos] === '}') count--;
      pos++;
    }
    return content.slice(0, start) + newBody + content.slice(pos);
  }

  const analyzeImageMethod = `  async analyzeImage(image, alt, options = {}) {
    if (!image) return "No image provided.";

    const base64 = typeof image === 'string' ? image : image.toString('base64');
    const prompt = options.prompt || \`Analyze this image in detail. Focus on: \${alt || 'general visual content'}.\`;

    const payload = {
      model: "nvidia/neva-22b",
      messages: [
        {
          role: "user",
          content: \`\${prompt} <img src="data:image/png;base64,\${base64}" />\`
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
      return data.choices?.[0]?.message?.content || "No analysis generated.";
    } catch (e) {
      console.error("[LLMService] Vision analysis error:", e);
      return "Vision analysis failed.";
    }
  }`;

  content = replaceMethod(content, 'analyzeImage', analyzeImageMethod);

  await fs.writeFile(path, content);
  console.log('Successfully updated LLM Service with NVIDIA vision analysis logic.');
}
fix();

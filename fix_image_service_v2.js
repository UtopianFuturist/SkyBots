import fs from 'fs';

const filePath = 'src/services/imageService.js';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
    "this.baseUrl = 'https://integrate.api.nvidia.com/v1/images/generations';",
    "this.baseUrl = 'https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-3-medium';"
);

const oldPart = /const payload = \{[\s\S]*?return \{ buffer, finalPrompt \};/;
const newPart = `const payload = {
        prompt: finalPrompt,
        aspect_ratio: "1:1",
        mode: "text-to-image"
      };

      console.log('[ImageService] Sending request to Nvidia NIM API with payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${this.apiKey}\`,
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        agent: persistentAgent
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(\`[ImageService] Nvidia NIM Image API error (\${response.status}):\`, errorBody);
        throw new Error(\`Nvidia NIM Image API error (\${response.status}): \${errorBody}\`);
      }

      const data = await response.json();

      const imageAsset = data.b64_json || data.image || (data.data && data.data[0] && (data.data[0].b64_json || data.data[0].url));

      if (!imageAsset) {
        console.error('[ImageService] No image data in API response:', JSON.stringify(data, null, 2));
        throw new Error('No image data returned from API.');
      }

      console.log(\`[ImageService] Successfully received image data from API.\`);

      let buffer;
      if (typeof imageAsset === 'string' && imageAsset.startsWith('http')) {
        const imageResponse = await fetch(imageAsset, { agent: persistentAgent });
        if (!imageResponse.ok) {
          throw new Error(\`Failed to fetch image from URL: \${imageResponse.statusText}\`);
        }
        const arrayBuffer = await imageResponse.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else {
        buffer = Buffer.from(imageAsset, 'base64');
      }

      return { buffer, finalPrompt };`;

content = content.replace(oldPart, newPart);
fs.writeFileSync(filePath, content);
console.log('Updated src/services/imageService.js');

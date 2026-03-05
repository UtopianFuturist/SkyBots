import fs from 'fs';

const filePath = 'src/services/renderService.js';
let content = fs.readFileSync(filePath, 'utf8');

// Suppress admin notification by using console.warn instead of throw for 404
const target = `        if (!response.ok) {
            const errBody = await response.text().catch(() => 'No body');
            const hint = response.status === 404 ? " (Note: Render's API log streaming may require a paid plan)" : "";
            if (response.status === 404) {
                this.apiLogsDisabled = true;
            }
            throw new Error(\`Render API error: \${response.status}\${hint} - \${errBody}\`);
        }`;

const replacement = `        if (!response.ok) {
            const errBody = await response.text().catch(() => 'No body');
            const hint = response.status === 404 ? " (Note: Render's API log streaming may require a paid plan)" : "";
            if (response.status === 404) {
                this.apiLogsDisabled = true;
                console.warn(\`[RenderService] Render API 404 (tier mismatch or invalid ID): \${errBody}\`);
                return "Render API log streaming is not available on this plan or service ID is invalid.";
            }
            throw new Error(\`Render API error: \${response.status}\${hint} - \${errBody}\`);
        }`;

content = content.replace(target, replacement);

fs.writeFileSync(filePath, content);
console.log('Fixed renderService.js');

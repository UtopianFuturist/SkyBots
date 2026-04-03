import fs from 'fs';
const discordPath = 'src/services/discordService.js';
let content = fs.readFileSync(discordPath, 'utf8');

// Proposal 35: Discord Multi-Modal trigger with permission
const multimodalMethod = `
    async proposeImageResponse(context, topic) {
        console.log(\`[Discord] Proposing image for topic: \${topic}\`);
        const promptPrompt = \`
Generate a highly descriptive, artistic image prompt based on this context: "\${context}" and topic: "\${topic}".
Respond with ONLY the prompt.
\`;
        try {
            const imagePrompt = await llmService.generateResponse([{ role: 'system', content: promptPrompt }], { useStep: true, task: 'multimodal_prompt' });
            this.pendingImageProposal = { prompt: imagePrompt, topic: topic, expires: Date.now() + 600000 };

            await this.sendSpontaneousMessage(\`*(I have a visual thought I'd like to share. Should I generate an image based on this? It would look like: "\${imagePrompt}")*\`);
        } catch (e) {
            console.error('[Discord] Error proposing image:', e);
        }
    }
`;

content = content.replace('class DiscordService {', 'class DiscordService {\n' + multimodalMethod);

fs.writeFileSync(discordPath, content);
console.log('Applied multimodal');

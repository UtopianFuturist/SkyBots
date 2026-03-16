import os

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Add sendContextualImage method
contextual_method = """    async sendContextualImage(target, type) {
        console.log(`[DiscordService] Sending contextual ${type} image...`);
        try {
            const prompt = type === 'morning' ?
                "An abstract, artistic and beautiful sunrise, warm light, soft colors, high quality" :
                "An abstract, artistic and beautiful moon, night sky, cool light, serene atmosphere, high quality";

            const imgResult = await imageService.generateImage(prompt, { allowPortraits: true });
            if (imgResult && imgResult.buffer) {
                const { AttachmentBuilder } = await import('discord.js');
                const attachment = new AttachmentBuilder(imgResult.buffer, { name: `${type}.jpg` });

                const visionAnalysis = await llmService.analyzeImage(imgResult.buffer, prompt);
                const captionPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}\\nVision Analysis: "${visionAnalysis}"\\nYou are saying ${type === 'morning' ? 'good morning' : 'goodnight'} to your Admin with this image. Generate a very short (1 sentence), persona-aligned greeting.`;
                const caption = await llmService.generateResponse([{ role: 'system', content: captionPrompt }], { useStep: true, platform: 'discord' });

                const finalMessage = `${caption || (type === 'morning' ? 'Good morning.' : 'Goodnight.')}\\n\\nGeneration Prompt: ${prompt}`;
                await this._send(target, finalMessage, { files: [attachment] });
            }
        } catch (e) {
            console.error(`[DiscordService] Error sending contextual ${type} image:`, e);
        }
    }"""

# Insert before respond method
if "async respond(message)" in content:
    content = content.replace("    async respond(message)", contextual_method + "\\n\\n    async respond(message)")

    # Update respond method to detect greetings
    old_respond_start = "    async respond(message) {"
    new_respond_start = """    async respond(message) {
        const text = message.content.toLowerCase();
        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);

        if (isAdmin) {
            if (text.includes('good morning') || text.includes('gm')) {
                // 30% chance or check cooldown
                if (Math.random() < 0.3) {
                    this.sendContextualImage(message.author, 'morning');
                }
            } else if (text.includes('goodnight') || text.includes('gn') || text.includes('good night')) {
                if (Math.random() < 0.3) {
                    this.sendContextualImage(message.author, 'night');
                }
            }
        }"""

    content = content.replace(old_respond_start, new_respond_start)

    with open(file_path, 'w') as f:
        f.write(content)
    print("Discord contextual image patch applied")
else:
    print("Could not find insertion point")

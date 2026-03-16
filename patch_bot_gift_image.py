import os

file_path = 'src/bot.js'
with open(file_path, 'r') as f:
    content = f.read()

gift_method = """  async performDiscordGiftImage(admin) {
    if (!admin) return;

    const lastGift = dataStore.getLastDiscordGiftTime();
    const oneDay = 24 * 60 * 60 * 1000;
    if (Date.now() - new Date(lastGift).getTime() < oneDay) {
        console.log('[Bot] Skipping Discord gift image (Daily limit reached).');
        return;
    }

    console.log('[Bot] Initiating Discord Gift Image flow...');
    try {
        const history = await discordService.fetchAdminHistory(15);
        const mood = dataStore.getMood();
        const goal = dataStore.getCurrentGoal();
        const adminFacts = dataStore.getAdminFacts();

        const promptGenPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
You are creating a special artistic "gift" for your Admin.
Current mood: ${JSON.stringify(mood)}
Current goal: ${goal.goal}
Known Admin facts: ${JSON.stringify(adminFacts.slice(-3))}

Generate a detailed, evocative image generation prompt that expresses your persona's current feelings or a deep thought you want to share with the Admin.
Respond with ONLY the prompt.`;

        const imagePrompt = await llmService.generateResponse([{ role: 'system', content: promptGenPrompt }], { useStep: true, platform: 'discord' });
        if (!imagePrompt) return;

        const res = await imageService.generateImage(imagePrompt, { allowPortraits: true });
        if (!res?.buffer) return;

        const visionAnalysis = await llmService.analyzeImage(res.buffer, imagePrompt);
        if (!visionAnalysis) return;

        const captionPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
You generated this visual gift for your Admin: "${visionAnalysis}"
Based on your original intent ("${imagePrompt}"), write a short, intimate, and persona-aligned message to accompany this gift.
Keep it under 300 characters.`;

        const caption = await llmService.generateResponse([{ role: 'system', content: captionPrompt }], { useStep: true, platform: 'discord' });
        if (!caption) return;

        // Alignment Poll
        const alignment = await llmService.pollGiftImageAlignment(visionAnalysis, caption);
        if (alignment.decision !== 'send') {
            console.log(`[Bot] Gift image discarded by persona alignment poll: ${alignment.reason}`);
            return;
        }

        console.log('[Bot] Gift image approved. Sending to Discord...');
        const { AttachmentBuilder } = await import('discord.js');
        const attachment = new AttachmentBuilder(res.buffer, { name: 'gift.jpg' });

        const finalMessage = `${caption}\\n\\nGeneration Prompt: ${imagePrompt}`;
        await discordService._send(admin, finalMessage, { files: [attachment] });

        await dataStore.updateLastDiscordGiftTime(new Date().toISOString());
        console.log('[Bot] Discord gift image sent successfully.');

    } catch (e) {
        console.error('[Bot] Error in performDiscordGiftImage:', e);
    }
  }"""

if "async checkDiscordSpontaneity()" in content:
    content = content.replace("  async checkDiscordSpontaneity()", gift_method + "\\n\\n  async checkDiscordSpontaneity()")

    # Update spontaneity poll to occasionally trigger gift
    old_prob = "    const randomTrigger = Math.random() < probability;"
    new_prob = """    const randomTrigger = Math.random() < probability;
    const giftChance = (battery > 0.8 && intimacy > 60) ? 0.1 : 0.05;
    const giftTrigger = isWaitingMode && Math.random() < giftChance;"""

    content = content.replace(old_prob, new_prob)

    # Insert gift trigger check
    old_trigger = "    if (randomTrigger && idleTime >= idleThreshold) {"
    new_trigger = """    if (giftTrigger && idleTime >= 30) {
        await this.performDiscordGiftImage(admin);
        return;
    }

    if (randomTrigger && idleTime >= idleThreshold) {"""

    content = content.replace(old_trigger, new_trigger)

    with open(file_path, 'w') as f:
        f.write(content)
    print("Bot gift image patch applied")
else:
    print("Could not find insertion point")

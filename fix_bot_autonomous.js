import fs from 'fs/promises';

async function fix() {
  const path = 'src/bot.js';
  let content = await fs.readFile(path, 'utf-8');

  const fullAutonomousPostMethod = `  async performAutonomousPost() {
    try {
        const profile = await blueskyService.getProfile(config.BLUESKY_IDENTIFIER);
        const followerCount = profile?.followersCount || 0;
        const dConfig = dataStore.getConfig() || {};
        const postTopics = (dConfig.post_topics || []).filter(Boolean);
        const currentMood = dataStore.getMood();

        const topicPrompt = \`Adopt persona: \${config.TEXT_SYSTEM_PROMPT}\\nIdentify a deep topic. Current mood: \${JSON.stringify(currentMood)}. Preferred: \${postTopics.join(', ')}. Respond with ONLY topic.\`;
        let topic = (await llmService.generateResponse([{ role: 'system', content: topicPrompt }], { useStep: true }))?.trim() || "existence";

        const postType = Math.random() < 0.3 ? 'image' : 'text';
        if (postType === 'image') {
            let attempts = 0;
            while (attempts < 5) {
                attempts++;
                const res = await imageService.generateImage(topic, { allowPortraits: false, mood: currentMood });
                if (res?.buffer && (await llmService.isImageCompliant(res.buffer))?.compliant) {
                    const contentPrompt = \`\${config.TEXT_SYSTEM_PROMPT}\\nCaption for image of: \${topic}. Keep it under 300 chars.\`;
                    const content = await llmService.generateResponse([{ role: 'system', content: contentPrompt }], { useStep: true });
                    const blob = await blueskyService.uploadBlob(res.buffer, 'image/jpeg');
                    if (blob?.data?.blob) {
                        await blueskyService.post(content, { $type: 'app.bsky.embed.images', images: [{ image: blob.data.blob, alt: topic }] });
                        await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                        return;
                    }
                }
            }
        }

        const content = await llmService.generateResponse([{ role: 'system', content: \`Adopt persona: \${config.TEXT_SYSTEM_PROMPT}\\nShared thought about \${topic}. Keep it under 300 chars.\` }], { useStep: true });
        if (content) {
            await blueskyService.post(content);
            await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
            if (llmService.generalizePrivateThought) {
                await dataStore.addRecentThought('bluesky', await llmService.generalizePrivateThought(content));
            }
        }
    } catch (e) {
        if (this._handleError) {
            await this._handleError(e, 'performAutonomousPost');
        } else {
            console.error('[Bot] Error in performAutonomousPost:', e);
        }
    }
  }`;

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

  content = replaceMethod(content, 'performAutonomousPost', fullAutonomousPostMethod);

  await fs.writeFile(path, content);
  console.log('Restored full performAutonomousPost with image support.');
}
fix();

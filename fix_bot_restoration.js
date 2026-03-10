import fs from 'fs/promises';

async function fix() {
  const path = 'src/bot.js';
  let content = await fs.readFile(path, 'utf-8');

  const executeActionCode = `  async executeAction(action, context) {
      if (!action) return;
      try {
          if (action.tool === 'image_gen' && action.query) {
              const res = await imageService.generateImage(action.query);
              if (res?.buffer) {
                  const blobRes = await blueskyService.uploadBlob(res.buffer, 'image/jpeg');
                  if (blobRes?.data?.blob) {
                      await blueskyService.postReply(context, "Generated Image", { embed: { $type: 'app.bsky.embed.images', images: [{ image: blobRes.data.blob, alt: action.query }] } });
                  }
              }
          }
          if (action.tool === 'google_search') {
              const searchCount = dataStore.db.data.daily_search_count || 0;
              if (searchCount >= 100) return "Google search limit reached for today.";
              const res = await googleSearchService.search(action.query);
              await dataStore.update({ daily_search_count: searchCount + 1 });
              return res;
          }
      } catch (e) {
          console.error('[Bot] Error in executeAction:', e);
      }
  }`;

  const cleanupOldPostsCode = `  async cleanupOldPosts() {
    try {
        console.log('[Bot] Running manual cleanup of old posts...');
        const profile = await blueskyService.getProfile(config.BLUESKY_IDENTIFIER);
        const feed = await blueskyService.agent.getAuthorFeed({ actor: profile.did, limit: 100 });
        const now = Date.now();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;

        for (const item of feed.data.feed) {
            const post = item.post;
            const createdAt = new Date(post.indexedAt).getTime();
            if (now - createdAt > thirtyDays) {
                console.log(\`[Bot] Deleting old post: \${post.uri}\`);
                await blueskyService.agent.deletePost(post.uri);
            }
        }
    } catch (e) {
        console.error('[Bot] Error in cleanupOldPosts:', e);
    }
  }`;

  const performAutonomousPostCode = `  async performAutonomousPost() {
    try {
        const profile = await blueskyService.getProfile(config.BLUESKY_IDENTIFIER);
        const followerCount = profile?.followersCount || 0;
        const dConfig = dataStore.getConfig() || {};
        const postTopics = (dConfig.post_topics || []).filter(Boolean);
        const currentMood = dataStore.getMood();

        const topicPrompt = \`Adopt persona: \${config.TEXT_SYSTEM_PROMPT}\\nIdentify a deep topic. Current mood: \${JSON.stringify(currentMood)}. Preferred: \${postTopics.join(', ')}. Respond with ONLY topic.\`;
        let topic = (await llmService.generateResponse([{ role: 'system', content: topicPrompt }], { useStep: true }))?.trim() || "existence";

        const content = await llmService.generateResponse([{ role: 'system', content: \`You are Sydney. Write a short social media post about \${topic}. Follow guidelines.\` }], { useStep: true });
        if (content) {
            await blueskyService.post(content);
            await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
        }
    } catch (e) {
        console.error('[Bot] Error in performAutonomousPost:', e);
    }
  }`;

  const performMoltbookTasksCode = `  async performMoltbookTasks() {
      // Placeholder for Moltbook integration
      console.log('[Bot] Moltbook tasks triggered (placeholder).');
  }`;

  const specialistResearchCode = `  async performSpecialistResearchProject(topic) {
      console.log(\`[Bot] Starting Specialist Research: \${topic}\`);
      try {
          const researcher = await llmService.performInternalInquiry(\`Deep research on: \${topic}. Identify facts.\`, "RESEARCHER");
          const report = \`[RESEARCH] Topic: \${topic}\\nFindings: \${researcher}\`;
          console.log(report);
      } catch (e) {}
  }`;

  // Insert before the last closing brace
  const lastBrace = content.lastIndexOf('}');
  content = content.slice(0, lastBrace) + '\n' +
            executeActionCode + '\n\n' +
            cleanupOldPostsCode + '\n\n' +
            performAutonomousPostCode + '\n\n' +
            performMoltbookTasksCode + '\n\n' +
            specialistResearchCode + '\n' +
            content.slice(lastBrace);

  await fs.writeFile(path, content);
  console.log('Restored all missing operational methods to src/bot.js.');
}
fix();

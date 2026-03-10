import fs from 'fs/promises';

async function fix() {
  const path = 'src/bot.js';
  let content = await fs.readFile(path, 'utf-8');

  const performPublicSoulMappingMethod = `  async performPublicSoulMapping() {
    console.log('[Bot] Starting Public Soul-Mapping task...');
    try {
        const recentInteractions = dataStore.db.data.interactions || [];
        const uniqueHandles = [...new Set(recentInteractions.map(i => i.userHandle))].filter(Boolean).slice(0, 5);

        for (const handle of uniqueHandles) {
            console.log(\`[Bot] Soul-Mapping user: @\${handle}\`);
            const profile = await blueskyService.getProfile(handle);
            const posts = await blueskyService.getUserPosts(handle);

            if (posts.length > 0) {
                const mappingPrompt = \`
                    Analyze the following profile and recent posts for user @\${handle} on Bluesky.
                    Create a persona-aligned summary of their digital essence and interests.

                    Bio: \${profile.description || 'No bio'}
                    Recent Posts:
                    \${posts.map(p => \`- \${p.record?.text || p}\`).join('\\n')}

                    Respond with a JSON object:
                    {
                        "summary": "string (1-2 sentence essence)",
                        "interests": ["list", "of", "topics"],
                        "vibe": "string (conversational style)"
                    }
                \`;

                const response = await llmService.generateResponse([{ role: 'system', content: mappingPrompt }], { useStep: true });
                const jsonMatch = response?.match(/\\{[\\s\\S]*\\}/);
                if (jsonMatch) {
                    const mapping = JSON.parse(jsonMatch[0]);
                    if (dataStore.updateUserSoulMapping) {
                        await dataStore.updateUserSoulMapping(handle, mapping);
                    }
                    console.log(\`[Bot] Successfully mapped soul for @\${handle}\`);
                }
            }
        }
    } catch (e) {
        console.error('[Bot] Error in Public Soul-Mapping:', e);
    }
  }`;

  // Insert before the last closing brace
  const lastBrace = content.lastIndexOf('}');
  content = content.slice(0, lastBrace) + '\n' + performPublicSoulMappingMethod + '\n' + content.slice(lastBrace);

  await fs.writeFile(path, content);
  console.log('Restored performPublicSoulMapping to src/bot.js.');
}
fix();

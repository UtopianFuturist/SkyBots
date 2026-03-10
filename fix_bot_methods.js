import fs from 'fs/promises';

async function fix() {
  const path = 'src/bot.js';
  let content = await fs.readFile(path, 'utf-8');

  const checkDiscordSpontaneityMethod = `  async checkDiscordSpontaneity() {
    if (discordService.status !== 'online') return;
    const now = Date.now();
    const lastInteraction = dataStore.db.data.discord_last_interaction || 0;
    const idleTime = (now - lastInteraction) / (1000 * 60);

    // Only trigger if idle for at least 6 hours
    if (idleTime < 360) return;

    // 5% chance every minute if idle
    if (Math.random() > 0.05) return;

    console.log('[Bot] Triggering Discord spontaneity check...');
    const admin = await discordService.getAdminUser();
    if (!admin) return;

    const mood = dataStore.getMood();
    const prompt = \`As your persona, you've been quiet for a while. You're feeling \${mood.label}.
Generate a short, spontaneous message for your admin to check in or share a brief thought.
Keep it under 200 characters.\`;

    const message = await llmService.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    if (message) {
      await discordService.sendSpontaneousMessage(message);
      dataStore.db.data.discord_last_interaction = now;
      await dataStore.db.write();
    }
  }`;

  const processNotificationMethod = `  async processNotification(notif) {
    const boundaryCheck = checkHardCodedBoundaries(notif.record.text || "");
    if (boundaryCheck.blocked) {
        console.log(\`[Bot] BOUNDARY VIOLATION DETECTED in notification: \${boundaryCheck.reason} ("\${boundaryCheck.pattern}") from \${notif.author.handle}\`);
        await dataStore.setBoundaryLockout(notif.author.did, 30);
        return;
    }

    if (dataStore.isUserLockedOut(notif.author.did)) {
        console.log(\`[Bot] User \${notif.author.handle} is currently LOCKED OUT. Ignoring notification.\`);
        return;
    }

    try {
      const handle = notif.author.handle;
      const text = notif.record.text || '';

      console.log(\`[Bot] Processing notification from @\${handle}: \${text.substring(0, 50)}...\`);

      const isAdmin = handle === config.ADMIN_BLUESKY_HANDLE;

      const prePlan = await llmService.performPrePlanning(text, [], null, 'bluesky', dataStore.getMood(), {});
      const plan = await llmService.performAgenticPlanning(text, [], null, isAdmin, 'bluesky', [], {}, {}, {}, {}, null, prePlan);

      if (plan.actions && plan.actions.length > 0) {
        for (const action of plan.actions) {
          await this.executeAction(action, { platform: 'bluesky', uri: notif.uri, cid: notif.cid });
        }
      }
    } catch (error) {
      console.error(\`[Bot] Error processing notification \${notif.uri}:\`, error);
    }
  }`;

  // Find the last closing brace and insert before it
  const lastBrace = content.lastIndexOf('}');
  content = content.slice(0, lastBrace) + '\n' + checkDiscordSpontaneityMethod + '\n\n' + processNotificationMethod + '\n' + content.slice(lastBrace);

  await fs.writeFile(path, content);
  console.log('Restored missing methods to src/bot.js.');
}
fix();

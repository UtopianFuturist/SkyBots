import sys

with open('src/bot.js', 'r') as f:
    content = f.read()

# Locate checkDiscordSpontaneity and update it with Relationship Repair logic
old_spontaneity = """  async checkDiscordSpontaneity() {
      try {
          if (discordService.status !== 'online' || dataStore.isResting()) return;
          const admin = await discordService.getAdminUser();
          if (!admin) return;
          const history = dataStore.getDiscordConversation(`dm_${admin.id}`) || [];
          if (history.length === 0) return;

          // Relationship Repair / Empathy priority
          const vibe = await llmService.extractRelationalVibe(history);
          const poll = await llmService.performFollowUpPoll({ history, currentMood: dataStore.getMood(), vibe });
          if (poll?.decision === 'follow-up' && poll.message) await discordService.sendSpontaneousMessage(poll.message);
      } catch (e) {}
  }"""

new_spontaneity = """  async checkDiscordSpontaneity() {
      try {
          if (discordService.status !== 'online' || dataStore.isResting()) return;
          const admin = await discordService.getAdminUser();
          if (!admin) return;

          const history = dataStore.getDiscordConversation(`dm_${admin.id}`) || [];
          if (history.length === 0) return;

          // 1. Analyze for "Relationship Repair" / Tone Shifts
          const lastMessages = history.slice(-5);
          const toneShift = await llmService.extractRelationalVibe(lastMessages);
          const currentMood = dataStore.getMood();

          // 2. High Priority Emotional Support Check
          if (toneShift === 'distressed' || toneShift === 'cold' || toneShift === 'conflict') {
              console.log(`[Bot] Relational friction detected (${toneShift}). Prioritizing Relationship Repair.`);
              const repairPoll = await llmService.performFollowUpPoll({
                  history,
                  currentMood,
                  vibe: toneShift,
                  repairMode: true
              });
              if (repairPoll?.decision === 'follow-up' && repairPoll.message) {
                  await discordService.sendSpontaneousMessage(repairPoll.message);
                  await dataStore.addRelationalReflection(`Repair attempt for ${toneShift} vibe.`);
                  return; // Don't proceed to standard poll
              }
          }

          // 3. Standard Spontaneity Poll
          const poll = await llmService.performFollowUpPoll({ history, currentMood, vibe: toneShift });
          if (poll?.decision === 'follow-up' && poll.message) {
              await discordService.sendSpontaneousMessage(poll.message);
          }
      } catch (e) {
          console.error("[Bot] Error in checkDiscordSpontaneity:", e.message);
      }
  }"""

content = content.replace(old_spontaneity, new_spontaneity)

with open('src/bot.js', 'w') as f:
    f.write(content)

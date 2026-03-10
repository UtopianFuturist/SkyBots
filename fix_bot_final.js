import fs from 'fs/promises';

async function fix() {
  const path = 'src/bot.js';
  let content = await fs.readFile(path, 'utf-8');

  const checkDiscordScheduledTasksMethod = `  async checkDiscordScheduledTasks() {
    if (this.paused || dataStore.isResting()) return;
    if (discordService.status !== 'online') return;

    const tasks = dataStore.getDiscordScheduledTasks();
    if (tasks.length === 0) return;

    const now = new Date();
    const currentTimeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const today = now.toDateString();

    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const taskDate = new Date(task.timestamp).toDateString();
        if (taskDate !== today) {
            await dataStore.removeDiscordScheduledTask(i);
            i--;
            continue;
        }

        if (currentTimeStr === task.time) {
            console.log(\`[Bot] Executing scheduled Discord task for \${task.time}: \${task.message}\`);
            try {
                if (task.channelId) {
                    const channel = await discordService.client.channels.fetch(task.channelId.replace('dm_', '')).catch(() => null);
                    if (channel) {
                        await discordService._send(channel, task.message);
                    } else {
                        await discordService.sendSpontaneousMessage(task.message);
                    }
                } else {
                    await discordService.sendSpontaneousMessage(task.message);
                }
                await dataStore.removeDiscordScheduledTask(i);
                i--;
            } catch (e) {
                console.error('[Bot] Error executing scheduled Discord task:', e);
            }
        }
    }
  }`;

  // Insert before the last closing brace
  const lastBrace = content.lastIndexOf('}');
  content = content.slice(0, lastBrace) + '\n' + checkDiscordScheduledTasksMethod + '\n' + content.slice(lastBrace);

  await fs.writeFile(path, content);
  console.log('Restored checkDiscordScheduledTasks to src/bot.js.');
}
fix();

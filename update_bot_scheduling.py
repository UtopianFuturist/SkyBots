import re

with open('src/bot.js', 'r') as f:
    content = f.read()

old_check = r'''  async checkDiscordScheduledTasks\(\) \{
    if \(this.paused || dataStore.isResting\(\)\) return;
    if \(discordService.status !== 'online'\) return;

    const tasks = dataStore.getDiscordScheduledTasks\(\);
    if \(tasks.length === 0\) return;

    const now = new Date\(\);
    const currentTimeStr = now.getHours\(\).toString\(\).padStart\(2, '0'\) \+ ':' \+ now.getMinutes\(\).toString\(\).padStart\(2, '0'\);
    const today = now.toDateString\(\);

    for \(let i = 0; i < tasks.length; i\+\+\) \{
        const task = tasks\[i\];
        const taskDate = new Date\(task.timestamp\).toDateString\(\);
        if \(taskDate !== today\) \{
            await dataStore.removeDiscordScheduledTask\(i\);
            i--;
            continue;
        }

        if \(currentTimeStr === task.time\) \{
            console.log\(`\[Bot\] Executing scheduled Discord task for \${task.time}: \${task.message}`\);
            try \{
                if \(task.channelId\) \{
                    const channel = await discordService.client.channels.fetch\(task.channelId.replace\('dm_', ''\)\).catch\(\(\) => null\);
                    if \(channel\) \{
                        await discordService._send\(channel, task.message\);
                    } else \{
                        await discordService.sendSpontaneousMessage\(task.message\);
                    }
                } else \{
                    await discordService.sendSpontaneousMessage\(task.message\);
                }
                await dataStore.removeDiscordScheduledTask\(i\);
                i--;
            } catch \(e\) \{
                console.error\('\[Bot\] Error executing scheduled Discord task:', e\);
            }
        }
    }
  }'''

new_check = r'''  async checkDiscordScheduledTasks() {
    if (this.paused || dataStore.isResting()) return;
    if (discordService.status !== 'online') return;

    const tasks = dataStore.getDiscordScheduledTasks();
    if (tasks.length === 0) return;

    const tz = dataStore.getAdminTimezone() || 'UTC';
    const nowLocal = new Date().toLocaleString("en-US", { timeZone: tz, hour12: false });
    const match = nowLocal.match(/(\d{1,2}):(\d{2}):\d{2}/);
    if (!match) return;
    const currentTimeStr = match[1].padStart(2, '0') + ':' + match[2];

    const today = new Date().toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD

    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];

        // Expiration check: if task date is in the past, remove it
        if (task.date && task.date < today) {
            await dataStore.removeDiscordScheduledTask(i);
            i--;
            continue;
        }

        if (currentTimeStr === task.time && (task.date === today || !task.date)) {
            console.log(`[Bot] Executing scheduled Discord task for ${task.time}: ${task.message_context}`);
            try {
                // Generate fresh context-aware message
                const followUpPrompt = `It is now ${task.time} (${tz}). You previously planned to check in about: "${task.message_context}".
Generate a natural, persona-aligned follow-up message for the admin.
Keep it under 200 characters and don't be robotic.`;

                const message = await llmService.generateResponse([{ role: 'user', content: followUpPrompt }], { useStep: true, platform: 'discord' });

                if (message) {
                    if (task.channelId) {
                        const channelId = task.channelId.replace('dm_', '');
                        let channel = discordService.client.channels.cache.get(channelId);
                        if (!channel) channel = await discordService.client.channels.fetch(channelId).catch(() => null);

                        if (channel) {
                            await discordService._send(channel, message);
                        } else {
                            await discordService.sendSpontaneousMessage(message);
                        }
                    } else {
                        await discordService.sendSpontaneousMessage(message);
                    }
                }

                await dataStore.removeDiscordScheduledTask(i);
                i--;
            } catch (e) {
                console.error('[Bot] Error executing scheduled Discord task:', e);
            }
        }
    }
  }'''

# Replace with the new check
content = content.replace(old_check, new_check)

with open('src/bot.js', 'w') as f:
    f.write(content)

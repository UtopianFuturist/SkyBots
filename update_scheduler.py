import sys

file_path = "src/bot.js"
with open(file_path, "r") as f:
    content = f.read()

# Update checkDiscordScheduledTasks to use executeAction
old_logic = """                // Trigger spontaneous outreach with this context
                await discordService.sendSpontaneousMessage(`[PROACTIVE CHECK-IN]: ${proactiveMsg}`);
                // Delete memory after processing to avoid re-triggering (or mark as done)
                await memoryService.deleteMemory(mem.uri);"""

new_logic = """                // Extract scheduled action if exists
                try {
                    const dataMatch = mem.text.match(/\[SCHEDULE\] I have scheduled a task for .*? at .*?: ({.*})/i);
                    if (dataMatch) {
                        const taskData = JSON.parse(dataMatch[1]);
                        if (taskData.action) {
                            console.log(`[Bot] Executing scheduled action from memory: ${taskData.action.tool}`);
                            await this.executeAction(taskData.action, { platform: 'discord' });
                        } else {
                            await discordService.sendSpontaneousMessage(`[PROACTIVE CHECK-IN]: ${proactiveMsg}`);
                        }
                    } else {
                        await discordService.sendSpontaneousMessage(`[PROACTIVE CHECK-IN]: ${proactiveMsg}`);
                    }
                } catch (e) {
                    console.error('[Bot] Error parsing/executing scheduled memory action:', e);
                    await discordService.sendSpontaneousMessage(`[PROACTIVE CHECK-IN]: ${proactiveMsg}`);
                }

                // Delete memory after processing to avoid re-triggering (or mark as done)
                await memoryService.deleteMemory(mem.uri);"""

content = content.replace(old_logic, new_logic)

with open(file_path, "w") as f:
    f.write(content)

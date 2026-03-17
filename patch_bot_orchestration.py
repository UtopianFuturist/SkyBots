import os

file_path = 'src/bot.js'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Increase conversation priority threshold
content = content.replace('const isChatting = (Date.now() - lastDiscord) < 5 * 60 * 1000 || (Date.now() - lastBluesky) < 5 * 60 * 1000;',
                          'const isChatting = (Date.now() - lastDiscord) < 15 * 60 * 1000 || (Date.now() - lastBluesky) < 15 * 60 * 1000;')

# 2. Make checkDiscordSpontaneity respect isChatting
old_spontaneity_start = """  async checkDiscordSpontaneity() {
    if (discordService.status !== "online") return;
    if (dataStore.isResting()) return;"""

new_spontaneity_start = """  async checkDiscordSpontaneity() {
    if (discordService.status !== "online") return;
    if (dataStore.isResting()) return;

    // Do not trigger spontaneity if actively chatting
    const lastDiscord = dataStore.db.data.discord_last_interaction || 0;
    const lastBluesky = dataStore.db.data.last_notification_processed_at || 0;
    const isChatting = (Date.now() - lastDiscord) < 15 * 60 * 1000 || (Date.now() - lastBluesky) < 15 * 60 * 1000;
    if (isChatting) return;"""

if old_spontaneity_start in content:
    content = content.replace(old_spontaneity_start, new_spontaneity_start)
    print("Spontaneity check updated")

# 3. Remove duplicate intervals in Bot.run
content = content.replace('setInterval(() => this.checkDiscordSpontaneity(), 120000);',
                          'setInterval(() => this.checkDiscordSpontaneity(), 300000); // Increased to 5 mins')
content = content.replace('setInterval(() => this.checkDiscordScheduledTasks(), 60000);',
                          '// checkDiscordScheduledTasks is handled by heartbeat')

with open(file_path, 'w') as f:
    f.write(content)
print("Orchestration patch applied")

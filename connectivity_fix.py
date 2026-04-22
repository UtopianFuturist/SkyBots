import sys

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    content = f.read()

connectivity_method = """    async _checkConnectivity() {
        try {
            console.log('[DiscordService] Pre-flight connectivity check...');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch('https://discord.com/api/v10/gateway', {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                console.log('[DiscordService] Connectivity check PASSED');
                return true;
            } else {
                console.warn(`[DiscordService] Connectivity check returned status: ${response.status}`);
                return false;
            }
        } catch (err) {
            console.error('[DiscordService] Connectivity check FAILED:', err.message);
            return false;
        }
    }

"""

# Insert before loginLoop
if '    async loginLoop()' in content:
    content = content.replace('    async loginLoop()', connectivity_method + '    async loginLoop()')

# Update loginLoop to use it
search_loop_start = """            console.log(`[DiscordService] Starting a new 10-minute login window...`);"""

replace_loop_start = """            console.log(`[DiscordService] Starting a new 10-minute login window...`);

            const hasConnectivity = await this._checkConnectivity();
            if (!hasConnectivity) {
                console.error('[DiscordService] No connectivity to Discord API. Waiting for cooldown...');
                await new Promise(r => setTimeout(r, 5 * 60 * 1000)); // Wait 5 mins before next attempt if no internet
                continue;
            }"""

if search_loop_start in content:
    content = content.replace(search_loop_start, replace_loop_start)

with open(file_path, 'w') as f:
    f.write(content)
print("Successfully added connectivity check")

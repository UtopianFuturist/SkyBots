import sys

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Make health check not block login
search_health = """            const servicesHealthy = await this._checkInternalServices();
            if (!servicesHealthy) {
                console.error('[DiscordService] Internal services not ready. Waiting...');
                await new Promise(r => setTimeout(r, 60000));
                continue;
            }"""

replace_health = """            // Check internal services but don't block login
            this._checkInternalServices().then(healthy => {
                if (!healthy) console.warn('[DiscordService] Internal services (LLM) reported unhealthy, but proceeding with login...');
            });"""

if search_health in content:
    content = content.replace(search_health, replace_health)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Discord health check now non-blocking")
else:
    print("Could not find health check block")

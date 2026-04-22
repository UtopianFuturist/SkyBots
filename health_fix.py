import sys

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    content = f.read()

health_check = """    async _checkInternalServices() {
        try {
            console.log('[DiscordService] Checking internal service health...');

            // Check LLM Service
            const llmHealth = await llmService.generateResponse([{ role: 'user', content: 'healthcheck' }], { temperature: 0, max_tokens: 1, useStep: true }).catch(() => null);

            // Check DataStore
            const dbHealth = dataStore.getMood() ? true : false;

            if (llmHealth && dbHealth) {
                console.log('[DiscordService] Internal services are HEALTHY');
                return true;
            } else {
                console.warn('[DiscordService] Internal services check FAILED', { llm: !!llmHealth, db: dbHealth });
                return false;
            }
        } catch (err) {
            console.error('[DiscordService] Health check error:', err.message);
            return false;
        }
    }

"""

# Insert after _checkConnectivity
if '    async _checkConnectivity()' in content:
    content = content.replace('    async loginLoop()', health_check + '    async loginLoop()')

# Update loginLoop to use it
search_health_usage = """            const hasConnectivity = await this._checkConnectivity();"""

replace_health_usage = """            const hasConnectivity = await this._checkConnectivity();
            if (hasConnectivity) {
                const servicesHealthy = await this._checkInternalServices();
                if (!servicesHealthy) {
                    console.error('[DiscordService] Internal services not ready. Waiting...');
                    await new Promise(r => setTimeout(r, 60000));
                    continue;
                }
            }"""

if search_health_usage in content:
    content = content.replace(search_health_usage, replace_health_usage)

with open(file_path, 'w') as f:
    f.write(content)
print("Successfully added internal health checks")

import sys

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    content = f.read()

search_destroy = """                    if (this.client) {
                        try {
                            console.log('[DiscordService] Destroying existing client before retry...');
                            await this.client.destroy();
                        } catch (e) {
                            console.warn('[DiscordService] Error destroying client:', e.message);
                        }
                        this.client = null;
                    }"""

replace_destroy = """                    if (this.client) {
                        try {
                            console.log('[DiscordService] Hard-resetting client state...');
                            this.client.removeAllListeners();
                            await this.client.destroy();
                        } catch (e) {
                            console.warn('[DiscordService] Error during client cleanup:', e.message);
                        }
                        this.client = null;
                    }"""

if search_destroy in content:
    content = content.replace(search_destroy, replace_destroy)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully updated cleanup logic")
else:
    print("Could not find search_destroy")
    sys.exit(1)

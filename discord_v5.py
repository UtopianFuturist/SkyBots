import sys

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Make health check non-blocking to prevent slow LLM from blocking Discord login
search_block = """            const servicesHealthy = await this._checkInternalServices();
            if (!servicesHealthy) {
                console.error('[DiscordService] Internal services not ready. Waiting...');
                await new Promise(r => setTimeout(r, 60000));
                continue;
            }"""

# Actually, the sed output showed:
#                await new Promise(r => setTimeout(r, 60000));
#                continue;
#            }
# but it was missing the if line in the snippet.

# Let's just find and replace the likely block
import re
new_content = re.sub(r'const servicesHealthy = await this\._checkInternalServices\(\);.*?continue;.*?}',
                     'this._checkInternalServices().then(h => { if(!h) console.warn("[DiscordService] Internal services slow or unhealthy."); });',
                     content, flags=re.DOTALL)

with open(file_path, 'w') as f:
    f.write(new_content)

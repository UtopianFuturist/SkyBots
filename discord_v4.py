import sys

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
skip_health = False
for line in lines:
    if 'const servicesHealthy = await this._checkInternalServices();' in line:
        new_lines.append('            // Check internal services but don\\'t block login if they are slow\n')
        new_lines.append('            this._checkInternalServices().then(healthy => {\n')
        new_lines.append('                if (!healthy) console.warn("[DiscordService] Internal health check failed or timed out, proceeding anyway...");\n')
        new_lines.append('            });\n')
        skip_health = True
    elif skip_health and 'continue;' in line:
        # We also need to skip the if (!servicesHealthy) block
        pass
    elif skip_health and '}' in line:
        skip_health = False
    elif not skip_health:
        new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)

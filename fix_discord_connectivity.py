import sys

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    content = f.read()

# The connectivity check is hitting 429 because it fetches /api/v10/gateway without auth or too frequently.
# We'll switch to a simple HEAD request to discord.com or a non-rate-limited endpoint.
search_fetch = "await fetch('https://discord.com/api/v10/gateway', {"
replace_fetch = "await fetch('https://discord.com', { method: 'HEAD',"

# Also check for 429 specifically and treat it as "potentially okay" or at least don't block login if it's just a rate limit on the health check itself.
search_ok = """            if (response.ok) {
                console.log('[DiscordService] Connectivity check PASSED');
                return true;
            } else {"""

replace_ok = """            if (response.ok || response.status === 429) {
                console.log(`[DiscordService] Connectivity check PASSED (Status: ${response.status})`);
                return true;
            } else {"""

if search_fetch in content:
    content = content.replace(search_fetch, replace_fetch)
    content = content.replace(search_ok, replace_ok)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully optimized Discord connectivity check")
else:
    print("Could not find search_fetch in discordService.js")
    sys.exit(1)

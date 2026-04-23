import sys

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    content = f.read()

search_invalidated = """        client.on('invalidated', () => {
            console.error('[DiscordService] Session invalidated. Token might be compromised or session was forcefully closed.');
        });"""

replace_invalidated = """        client.on('invalidated', () => {
            console.error('[DiscordService] Session invalidated. Triggering re-initialization...');
            if (!this.isInitializing) {
                this.isInitializing = true;
                setTimeout(() => this.loginLoop(), 5000);
            }
        });"""

if search_invalidated in content:
    content = content.replace(search_invalidated, replace_invalidated)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully updated invalidated handler")
else:
    print("Could not find invalidated handler")
    sys.exit(1)

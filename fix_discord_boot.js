import fs from 'fs';
let content = fs.readFileSync('src/services/discordService.js', 'utf8');

const regex = /async init\(botInstance\) \{[\s\S]*?async handleMessage/;
const replacement = `async init(botInstance) {
        if (!this.isEnabled || this.isInitializing) return;
        this.isInitializing = true;
        this.botInstance = botInstance;

        console.log('[DiscordService] Starting initialization...');
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        this.client.on('ready', () => {
            console.log(\`[DiscordService] Logged in as \${this.client.user.tag}\`);
        });

        this.client.on('messageCreate', async (message) => {
            try {
                await this.handleMessage(message);
            } catch (err) {
                console.error('[DiscordService] Error in messageCreate listener:', err);
            }
        });

        // Perform login in the background to avoid blocking bot boot
        this.loginLoop();
    }

    async loginLoop() {
        let attempts = 0;
        const maxAttempts = 5;
        while (attempts < maxAttempts) {
            attempts++;
            try {
                console.log(\`[DiscordService] Login attempt \${attempts}/\${maxAttempts}...\`);
                await this.client.login(this.token);
                this.isInitializing = false;
                return;
            } catch (err) {
                console.error(\`[DiscordService] Login attempt \${attempts} failed:\`, err.message);
                if (attempts < maxAttempts) await new Promise(r => setTimeout(r, 60000));
            }
        }
        this.isInitializing = false;
    }

    async handleMessage`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('src/services/discordService.js', content);
    console.log('Successfully refactored DiscordService initialization');
} else {
    console.error('Regex not matched');
}

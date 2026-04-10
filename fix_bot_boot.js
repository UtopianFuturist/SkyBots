import fs from 'fs';
let content = fs.readFileSync('src/bot.js', 'utf8');

const regex = /async init\(\) \{[\s\S]*?async run\(\)/;
const replacement = `async init() {
        console.log('[Bot] Starting service initialization...');

        try {
            console.log('[Bot] Initializing DataStore...');
            await dataStore.init();
        } catch (e) { console.error('[Bot] DataStore init failed:', e); }

        try {
            this.readmeContent = await fs.readFileSync("README.md", "utf-8");
        } catch (e) { console.warn('[Bot] README.md not found'); }

        try {
            console.log('[Bot] Initializing Bluesky Service...');
            await blueskyService.init();
        } catch (e) { console.error('[Bot] Bluesky init failed:', e); }

        if (config.DISCORD_BOT_TOKEN) {
            try {
                console.log('[Bot] Initializing Discord Service...');
                await discordService.init(this);
            } catch (e) { console.error('[Bot] Discord init failed:', e); }
        }

        if (config.ADMIN_BLUESKY_HANDLE) {
            try {
                console.log(\`[Bot] Resolving admin DID for @\${config.ADMIN_BLUESKY_HANDLE}...\`);
                const adminProfile = await blueskyService.getProfile(config.ADMIN_BLUESKY_HANDLE);
                if (adminProfile?.did) {
                    await dataStore.setAdminDid(adminProfile.did);
                    llmService.setIdentities(adminProfile.did, blueskyService.did);
                }
            } catch (e) { console.warn('[Bot] Admin DID resolution failed:', e.message); }
        }

        try { await moltbookService.init(); } catch (e) { console.error('[Bot] Moltbook init failed:', e); }
        try { await openClawService.init(); } catch (e) { console.error('[Bot] OpenClaw init failed:', e); }
        try { await toolService.init(); } catch (e) { console.error('[Bot] ToolService init failed:', e); }
        try { await nodeGatewayService.init(); } catch (e) { console.error('[Bot] NodeGateway init failed:', e); }
        try { await cronService.init(); } catch (e) { console.error('[Bot] CronService init failed:', e); }

        if (config.RENDER_API_KEY) {
            try { await renderService.discoverServiceId(); } catch (e) { console.warn('[Bot] Render service discovery failed'); }
        }

        this.startNotificationPoll();
        this.startFirehose();
        console.log('[Bot] Initialization sequence complete.');
    }

    async run()`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('src/bot.js', content);
    console.log('Successfully refactored Bot initialization');
} else {
    console.error('Regex not matched');
}

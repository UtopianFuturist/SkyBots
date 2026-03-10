import fs from 'fs/promises';

async function fix() {
  const content = await fs.readFile('src/bot.js', 'utf-8');

  const initMethod = `  async init() {
    console.log('[Bot] [v3] Initializing services...');
    try {
        await dataStore.init();
        console.log('[Bot] DataStore initialized.');
        llmService.setDataStore(dataStore);

        await openClawService.init();
        console.log('[Bot] OpenClawService initialized.');

        await toolService.init();
        console.log('[Bot] ToolService initialized.');

        console.log('[Bot] Starting DiscordService initialization in background...');
        discordService.setBotInstance(this);
        discordService.init()
            .then(() => {
                cronService.init();
                nodeGatewayService.init();
                console.log('[Bot] Background services (Cron, Gateway) initialized.');
            })
            .catch(err => console.error('[Bot] DiscordService.init() background failure:', err));

        console.log('[Bot] Proceeding to Bluesky authentication...');
        await blueskyService.authenticate();
        console.log('[Bot] Bluesky authenticated.');

        await blueskyService.submitAutonomyDeclaration();
        console.log('[Bot] Autonomy declaration submitted.');

        if (config.ADMIN_BLUESKY_HANDLE) {
            try {
                console.log(\`[Bot] Resolving admin DID for @\${config.ADMIN_BLUESKY_HANDLE}...\`);
                const adminProfile = await blueskyService.getProfile(config.ADMIN_BLUESKY_HANDLE);
                if (adminProfile?.did) {
                    this.adminDid = adminProfile.did;
                    await dataStore.setAdminDid(adminProfile.did);
                    console.log(\`[Bot] Admin DID resolved: \${this.adminDid}\`);
                    llmService.setIdentities(this.adminDid, blueskyService.did);
                }
            } catch (e) {
                console.warn(\`[Bot] Failed to resolve admin DID for @\${config.ADMIN_BLUESKY_HANDLE}: \${e.message}\`);
            }
        }

        await blueskyService.registerComindAgent({ capabilities: [
            'planner-executor', 'moltbook-integration', 'discord-bridge', 'response-filtering',
            'spontaneous-outreach', 'persona-alignment-audit', 'identity-tracking'
        ] });
        console.log('[Bot] Comind Agent registration successful.');

        // Initial task load
        try {
          this.readmeContent = await fs.readFile('README.md', 'utf-8').catch(() => "");
          this.skillsContent = await fs.readFile('skills.md', 'utf-8').catch(() => "");
          llmService.setSkillsContent(this.skillsContent);
        } catch (error) {}
    } catch (e) {
        await this._handleError(e, 'Bot.init');
    }
  }`;

  // Find the old init method and replace it
  const start = content.indexOf('  async init() {');
  if (start === -1) {
    console.error('Could not find init method');
    return;
  }

  // Track balanced braces to find the end of the method
  let braceStart = content.indexOf('{', start);
  let count = 1;
  let pos = braceStart + 1;
  while (count > 0 && pos < content.length) {
    if (content[pos] === '{') count++;
    else if (content[pos] === '}') count--;
    pos++;
  }

  const newContent = content.slice(0, start) + initMethod + content.slice(pos);
  await fs.writeFile('src/bot.js', newContent);
  console.log('Fixed init method');
}

fix();

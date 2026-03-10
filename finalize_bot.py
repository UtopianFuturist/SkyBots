import os
import re

def extract_method(content, name_pattern):
    pattern = r'^\s+' + name_pattern + r'\s*\(.*?\)\s*\{'
    match = re.search(pattern, content, re.MULTILINE)
    if not match: return None
    start = match.start()
    brace_start = content.find('{', start)
    count = 1
    pos = brace_start + 1
    while count > 0 and pos < len(content):
        if content[pos] == '{': count += 1
        elif content[pos] == '}': count -= 1
        pos += 1
    return content[start:pos]

with open('/app/src/bot.js.clean', 'r') as f:
    clean_bot = f.read()

with open('/app/src/bot.js', 'r') as f:
    current_bot = f.read()

# Base header
header_end = clean_bot.find('export class Bot {') + len('export class Bot {')
header = clean_bot[:header_end]

# Methods to include
methods = {}

# 1. Constructor (from clean)
methods['constructor'] = extract_method(clean_bot, 'constructor')

# 2. Init (Hand-crafted to be correct)
methods['init'] = r'''  async init() {
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
                console.log(`[Bot] Resolving admin DID for @${config.ADMIN_BLUESKY_HANDLE}...`);
                const adminProfile = await blueskyService.getProfile(config.ADMIN_BLUESKY_HANDLE);
                if (adminProfile?.did) {
                    this.adminDid = adminProfile.did;
                    await dataStore.setAdminDid(adminProfile.did);
                    console.log(`[Bot] Admin DID resolved: ${this.adminDid}`);
                    llmService.setIdentities(this.adminDid, blueskyService.did);
                }
            } catch (e) {
                console.warn(`[Bot] Failed to resolve admin DID for @${config.ADMIN_BLUESKY_HANDLE}: ${e.message}`);
            }
        }

        await blueskyService.registerComindAgent({ capabilities: [
            'planner-executor', 'moltbook-integration', 'discord-bridge', 'response-filtering',
            'spontaneous-outreach', 'persona-alignment-audit', 'identity-tracking'
        ] });
        console.log('[Bot] Comind Agent registration successful.');

        try {
          this.readmeContent = await fs.readFile('README.md', 'utf-8').catch(() => '');
          this.skillsContent = await fs.readFile('skills.md', 'utf-8').catch(() => '');
          llmService.setSkillsContent(this.skillsContent);
        } catch (error) {}
    } catch (e) {
        await this._handleError(e, 'Bot.init');
    }
  }'''

# 3. ProcessNotification (The good one from current_bot)
methods['processNotification'] = extract_method(current_bot, 'processNotification')

# 4. PerformAutonomousPost (The good one from current_bot)
methods['performAutonomousPost'] = extract_method(current_bot, 'performAutonomousPost')

# 5. Extract all other methods from clean_bot
all_sigs = re.findall(r'^\s+(?:async\s+)?([a-zA-Z0-9_]+)\s*\(.*?\)\s*\{', clean_bot, re.MULTILINE)
for m_name in all_sigs:
    if m_name in methods: continue
    body = extract_method(clean_bot, '(?:async\s+)?' + m_name)
    if body:
        methods[m_name] = body

# 6. Extract any remaining from current_bot
curr_sigs = re.findall(r'^\s+(?:async\s+)?([a-zA-Z0-9_]+)\s*\(.*?\)\s*\{', current_bot, re.MULTILINE)
for m_name in curr_sigs:
    if m_name in methods: continue
    body = extract_method(current_bot, '(?:async\s+)?' + m_name)
    if body:
        methods[m_name] = body

# Ensure we have a heartbeat method
if 'heartbeat' not in methods:
    methods['heartbeat'] = r'''  async heartbeat() {
    console.log('[Bot] Heartbeat pulse...');
    try {
        await this.checkMaintenanceTasks();
        await this.checkDiscordSpontaneity();
        // Add more integrated tasks here
    } catch (e) {
        console.error('[Bot] Error in heartbeat:', e);
    }
  }'''

# Reconstruct class body
class_body = "\n\n".join(methods.values())
final_content = header + "\n" + class_body + "\n}\n"

with open('/app/src/bot.js', 'w') as f:
    f.write(final_content)

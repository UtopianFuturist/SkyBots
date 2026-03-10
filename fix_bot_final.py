import os
import re

with open('/app/src/bot.js.clean', 'r') as f:
    clean_bot = f.read()

# Current bot.js has the "working" methods, but they got messed up.
# Let's extract them properly from a known state if possible.
# Actually, I'll just rewrite the core methods correctly using the data I have.

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

# Base header (imports + constants)
with open('/app/src/bot.js', 'r') as f:
    orig_bot = f.read()
header = orig_bot[:orig_bot.find('export class Bot {') + len('export class Bot {')]

# Methods to include
methods = []

# 1. Constructor (from clean)
methods.append(extract_method(clean_bot, 'constructor'))

# 2. Init (I have the good code)
methods.append("""  async init() {
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
                console.log();
                const adminProfile = await blueskyService.getProfile(config.ADMIN_BLUESKY_HANDLE);
                if (adminProfile?.did) {
                    this.adminDid = adminProfile.did;
                    await dataStore.setAdminDid(adminProfile.did);
                    console.log();
                    llmService.setIdentities(this.adminDid, blueskyService.did);
                }
            } catch (e) {
                console.warn();
            }
        }

        await blueskyService.registerComindAgent({ capabilities: [
            'planner-executor', 'moltbook-integration', 'discord-bridge', 'response-filtering',
            'spontaneous-outreach', 'persona-alignment-audit', 'identity-tracking'
        ] });
        console.log('[Bot] Comind Agent registration successful.');

        try {
          this.readmeContent = await fs.readFile('README.md', 'utf-8').catch(() => "");
          this.skillsContent = await fs.readFile('skills.md', 'utf-8').catch(() => "");
          llmService.setSkillsContent(this.skillsContent);
        } catch (error) {}
    } catch (e) {
        await this._handleError(e, 'Bot.init');
    }
  }""")

# 3. ProcessNotification (The one with boundary checks)
methods.append("""  async processNotification(notif) {
    if (!notif?.author || notif.author.handle === config.BLUESKY_IDENTIFIER) return;
    const boundaryCheck = checkHardCodedBoundaries(notif.record?.text || "");
    if (boundaryCheck.blocked) {
        await dataStore.setBoundaryLockout(notif.author?.did, 30);
        if (memoryService.isEnabled()) await memoryService.createMemoryEntry('mood', );
        return;
    }

    try {
        const safety = await llmService.performSafetyAnalysis(notif.record?.text || "", { platform: 'bluesky', user: notif.author.handle });
        if (safety?.violation_detected) {
            const consent = await llmService.requestBoundaryConsent(safety, notif.author.handle, 'bluesky');
            if (!consent?.consent_to_engage) {
                await dataStore.incrementRefusalCount('bluesky');
                return;
            }
        }

        const threadData = await this._getThreadHistory(notif.uri) || [];
        const isAdmin = notif.author.handle === config.ADMIN_BLUESKY_HANDLE;

        const prePlan = await llmService.performPrePlanning(notif.record?.text, threadData, null, 'bluesky', dataStore.getMood(), dataStore.getRefusalCounts());
        const plan = await llmService.performAgenticPlanning(notif.record?.text, threadData, null, isAdmin, 'bluesky', dataStore.getExhaustedThemes(), dataStore.getConfig(), "", "online", dataStore.getRefusalCounts(), null, prePlan);

        const refined = await llmService.evaluateAndRefinePlan(plan, { platform: 'bluesky' });
        if (refined?.decision === 'refuse') return;

        for (const action of (refined?.refined_actions || plan?.actions || [])) {
            if (action) await this.executeAction(action, { isAdmin, platform: 'bluesky', notif });
        }

        const response = await llmService.generateResponse([{ role: 'user', content: notif.record?.text }], { platform: 'bluesky' });
        if (response) {
            await blueskyService.postReply(notif, response);
            await dataStore.saveInteraction({ platform: 'bluesky', userHandle: notif.author.handle, text: notif.record?.text, response });
        }
    } catch (error) {
      await this._handleError(error, );
    }
  }""")

# 4. PerformAutonomousPost
methods.append("""  async performAutonomousPost() {
    try {
        const profile = await blueskyService.getProfile(config.BLUESKY_IDENTIFIER);
        const followerCount = profile?.followersCount || 0;
        const dConfig = dataStore.getConfig() || {};
        const postTopics = (dConfig.post_topics || []).filter(Boolean);
        const currentMood = dataStore.getMood();

        const topicPrompt = ;
        let topic = (await llmService.generateResponse([{ role: 'system', content: topicPrompt }], { useStep: true }))?.trim() || "existence";

        const postType = Math.random() < 0.3 ? 'image' : 'text';
        if (postType === 'image') {
            let attempts = 0;
            while (attempts < 5) {
                attempts++;
                const res = await imageService.generateImage(topic, { allowPortraits: false, mood: currentMood });
                if (res?.buffer && (await llmService.isImageCompliant(res.buffer))?.compliant) {
                    const contentPrompt = ;
                    const content = await llmService.generateResponse([{ role: 'system', content: contentPrompt }], { useStep: true });
                    const blob = await blueskyService.uploadBlob(res.buffer, 'image/jpeg');
                    if (blob?.data?.blob) {
                        await blueskyService.post(content, { : 'app.bsky.embed.images', images: [{ image: blob.data.blob, alt: topic }] });
                        return;
                    }
                }
            }
        }

        const content = await llmService.generateResponse([{ role: 'system', content: AUTONOMOUS_POST_SYSTEM_PROMPT(followerCount) +  }], { useStep: true });
        if (content) {
            const chunks = splitText(content, 300).slice(0, 3);
            let lastPost = null;
            for (const chunk of chunks) {
                if (!lastPost) lastPost = await blueskyService.post(chunk);
                else lastPost = await blueskyService.postReply(lastPost, chunk);
                await delay(2000);
            }
            if (lastPost) {
                await dataStore.updateLastAutonomousPostTime(new Date().toISOString());
                await dataStore.addRecentThought('bluesky', await llmService.generalizePrivateThought(content));
            }
        }
    } catch (e) {
        await this._handleError(e, 'performAutonomousPost');
    }
  }""")

# 5. Add all other methods from clean_bot
known_methods = ['constructor', 'init', 'processNotification', 'performAutonomousPost']
all_sigs = re.findall(r'^\s+(?:async\s+)?([a-zA-Z0-9_]+)\s*\(.*?\)\s*\{', clean_bot, re.MULTILINE)
for m_name in all_sigs:
    if m_name in known_methods: continue
    body = extract_method(clean_bot, '(?:async\s+)?' + m_name)
    if body:
        methods.append(body)
        known_methods.append(m_name)

# 6. Add the specialist/discord methods from current bot.js if not already there
extra_methods = ['checkMaintenanceTasks', 'performSpecialistResearchProject', 'checkDiscordSpontaneity', 'executeAction', '_getThreadHistory', '_handleError', 'updateActivity', 'restartFirehose']
for m in extra_methods:
    if m in known_methods: continue
    body = extract_method(orig_bot, '(?:async\s+)?' + m)
    if body:
        methods.append(body)

final_content = header + "\n\n" + "\n\n".join(methods) + "\n}\n"
with open('/app/src/bot.js', 'w') as f:
    f.write(final_content)

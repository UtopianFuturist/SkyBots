import sys

file_path = 'src/bot.js'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Update firehose stdout listener to handle firehose_mention
search_firehose_logic = """                            if (match.type === "firehose_topic_match" && Math.random() < 0.2 && (now - lastPostMs > (config.BACKOFF_DELAY || 60000))) {
                                console.log("[Bot] Firehose topic match triggered an autonomous impulse...");
                                orchestratorService.addTaskToQueue(() => orchestratorService.performAutonomousPost({ topic: match.matched_keywords?.[0] || "trending" }), "firehose_impulse");
                            }"""

replace_firehose_logic = """                            if (match.type === "firehose_topic_match" && Math.random() < 0.2 && (now - lastPostMs > (config.BACKOFF_DELAY || 60000))) {
                                console.log("[Bot] Firehose topic match triggered an autonomous impulse...");
                                orchestratorService.addTaskToQueue(() => orchestratorService.performAutonomousPost({ topic: match.matched_keywords?.[0] || "trending" }), "firehose_impulse");
                            }

                            if (match.type === "firehose_mention") {
                                console.log(`[Bot] Firehose interaction detected from ${match.author?.did}. Checking for existing response...`);
                                if (!await blueskyService.hasBotRepliedTo(match.uri)) {
                                    const notif = {
                                        uri: match.uri,
                                        cid: match.cid,
                                        author: match.author,
                                        record: match.record,
                                        reason: match.reason || "mention",
                                        indexedAt: new Date().toISOString()
                                    };
                                    this.processNotification(notif).catch(e => console.error("[Bot] Firehose interaction processing failed:", e));
                                } else {
                                    console.log(`[Bot] Already responded to ${match.uri}. Skipping.`);
                                }
                            }"""

# 2. Update processNotification to resolve handle if missing
search_process_notif = """    async processNotification(notif) {
        if (this._detectInfiniteLoop(notif.uri)) return;"""

replace_process_notif = """    async processNotification(notif) {
        if (this._detectInfiniteLoop(notif.uri)) return;

        // Resolve handle if missing (e.g. from firehose)
        if (notif.author && !notif.author.handle) {
            const profile = await blueskyService.getProfile(notif.author.did);
            if (profile) notif.author.handle = profile.handle;
        }"""

if search_firehose_logic in content and search_process_notif in content:
    new_content = content.replace(search_firehose_logic, replace_firehose_logic)
    new_content = new_content.replace(search_process_notif, replace_process_notif)
    with open(file_path, 'w') as f:
        f.write(new_content)
    print("Successfully updated src/bot.js")
else:
    if search_firehose_logic not in content:
        print("Could not find search_firehose_logic")
    if search_process_notif not in content:
        print("Could not find search_process_notif")
    sys.exit(1)

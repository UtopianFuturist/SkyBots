import sys

def patch_file(path, search, replace):
    with open(path, 'r') as f:
        content = f.read()
    if search in content:
        with open(path, 'w') as f:
            f.write(content.replace(search, replace))
        print(f"Patched {path}")
    else:
        print(f"Search string not found in {path}")

# bot.js patch
bot_search = '        if (evaluation.decision === "proceed") {'
bot_replace = """        if (evaluation.decision === "proceed") {""" # No change needed yet, but let's add log
bot_patch_search = '        const evaluation = await llmService.evaluateAndRefinePlan(plan, { platform: "bluesky", reason: notif.reason });'
bot_patch_replace = """        const evaluation = await llmService.evaluateAndRefinePlan(plan, { platform: "bluesky", reason: notif.reason });
        if (evaluation.decision === "refuse") {
            console.log(`[Bot] Plan refused: ${evaluation.reason || "No reason given"}`);
            return;
        }"""

# discordService.js patch
discord_search = '            const actions = (evaluation.decision === "proceed" ? (evaluation.refined_actions || plan.actions) : []) || [];'
discord_replace = """            if (evaluation.decision === "refuse") {
                console.log(`[DiscordService] Plan refused: ${evaluation.reason || "No reason given"}`);
                this.respondingChannels.delete(channelId);
                return;
            }
            const actions = (evaluation.decision === "proceed" ? (evaluation.refined_actions || plan.actions) : []) || [];"""

patch_file('src/bot.js', bot_patch_search, bot_patch_replace)
patch_file('src/services/discordService.js', discord_search, discord_replace)

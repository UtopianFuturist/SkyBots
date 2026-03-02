import sys

def apply_diff(filepath, search_text, replace_text):
    with open(filepath, "r") as f:
        content = f.read()
    if search_text not in content:
        print(f"Error: Search text not found in {filepath}")
        return False
    new_content = content.replace(search_text, replace_text)
    with open(filepath, "w") as f:
        f.write(new_content)
    return True

bot_path = "src/bot.js"

# Change 2: Exclude Admin from spontaneous mentions
search2 = """      const mentionPrompt = `
        For the topic "${topic}", identify if any of the following users have had a meaningful persistent discussion with you about it (multiple quality interactions).
        Interactions:
        ${recentInteractions.map(i => `@${i.userHandle}: ${i.text}`).join('\\n')}

        If yes, respond with ONLY their handle (e.g., @user.bsky.social). Otherwise, respond "none".
        CRITICAL: Respond directly. Do NOT include reasoning, <think> tags, or conversational filler.
      `;"""

replace2 = """      // Platform Isolation: Explicitly exclude Admin from spontaneous mentions to prevent private context leakage
      const mentionableInteractions = recentInteractions.filter(i => i.userHandle !== config.ADMIN_BLUESKY_HANDLE);
      const mentionPrompt = `
        For the topic "${topic}", identify if any of the following users have had a meaningful persistent discussion with you about it (multiple quality interactions).
        Interactions:
        ${mentionableInteractions.map(i => `@${i.userHandle}: ${i.text}`).join('\\n')}

        If yes, respond with ONLY their handle (e.g., @user.bsky.social). Otherwise, respond "none".
        CRITICAL: Respond directly. Do NOT include reasoning, <think> tags, or conversational filler.
        DO NOT mention @${config.ADMIN_BLUESKY_HANDLE} as they are your admin and your public posts should remain independent of your private relationship.
      `;"""

if apply_diff(bot_path, search2, replace2):
    print("Successfully updated src/bot.js mentions")
else:
    sys.exit(1)

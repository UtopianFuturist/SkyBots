import sys

def apply_diff(filepath, search_text, replace_text):
    with open(filepath, "r") as f:
        content = f.read()
    if search_text not in content:
        return False
    new_content = content.replace(search_text, replace_text)
    with open(filepath, "w") as f:
        f.write(new_content)
    return True

bot_path = "src/bot.js"

search_eval = """      const recentThoughts = dataStore.getRecentThoughts();
      const formattedHistory = [
          ...recentBotReplies.map(m => ({ platform: 'bluesky', content: m })),
          ...recentThoughts.map(t => ({ platform: t.platform, content: t.content }))
      ];"""

replace_eval = """      // Platform Isolation: Filter out private Discord thoughts from public Bluesky replies
      const recentThoughts = dataStore.getRecentThoughts().filter(t => t.platform !== 'discord');
      const formattedHistory = [
          ...recentBotReplies.map(m => ({ platform: 'bluesky', content: m })),
          ...recentThoughts.map(t => ({ platform: t.platform, content: t.content }))
      ];"""

if apply_diff(bot_path, search_eval, replace_eval):
    print("Successfully updated notification evaluation thoughts")
else:
    print("Failed to update notification evaluation thoughts")

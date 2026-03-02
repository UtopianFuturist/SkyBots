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

# 1. performAutonomousPost (4726 approx)
search1 = """      const recentThoughts = dataStore.getRecentThoughts();"""
replace1 = """      // Platform Isolation: Filter out private Discord thoughts from public Bluesky posts
      const recentThoughts = dataStore.getRecentThoughts().filter(t => t.platform !== 'discord');"""

# Note: Search1 is very common. We need to be careful or use a larger context.
# Let's use a larger context for performAutonomousPost.

search_auto = """      const blueskyDirectives = dataStore.getBlueskyInstructions();
      const personaUpdates = dataStore.getPersonaUpdates();
      const recentThoughts = dataStore.getRecentThoughts();"""

replace_auto = """      const blueskyDirectives = dataStore.getBlueskyInstructions();
      const personaUpdates = dataStore.getPersonaUpdates();
      // Platform Isolation: Filter out private Discord thoughts from public Bluesky posts
      const recentThoughts = dataStore.getRecentThoughts().filter(t => t.platform !== 'discord');"""

if apply_diff(bot_path, search_auto, replace_auto):
    print("Successfully updated performAutonomousPost thoughts")
else:
    print("Failed to update performAutonomousPost thoughts")
    sys.exit(1)

# 2. processNotification / evaluation (3746 approx)
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

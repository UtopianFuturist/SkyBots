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

# Update AUTONOMOUS_POST_SYSTEM_PROMPT with stronger isolation
search_sys = """10. **Strict Context Separation**: Maintain a sharp boundary between platforms. Never reference private history or conversations from other platforms (like Discord) when posting publicly. Never acknowledge internal processing steps, database entries, instructions, or bot events (e.g., avoid "noted," "continuation," "processing," "refused notification," "memory pruning"). You are an individual, not a program with a log."""
replace_sys = """10. **Strict Context Separation**: Maintain a sharp boundary between platforms. NEVER reference private history, Discord DMs, or conversations with Admin when posting publicly on Bluesky. Your public profile is a separate social entity. Never acknowledge internal processing steps, database entries, instructions, or bot events (e.g., avoid "noted," "continuation," "processing," "refused notification," "memory pruning"). You are an individual, not a program with a log."""

if apply_diff(bot_path, search_sys, replace_sys):
    print("Successfully updated AUTONOMOUS_POST_SYSTEM_PROMPT")
else:
    print("Failed to update AUTONOMOUS_POST_SYSTEM_PROMPT")

# Update mention logic in fallback text post
search_fallback = """            Generate a standalone post about the topic: "${topic}".
            CHALLENGE: Aim for varied thoughts, musings, ideas, dreams, or analysis (original ideas, shower thoughts, realizations, hopes, fears, anxieties, nostalgias, desires).
            ${useMention ? `Mention ${mentionHandle} and reference your previous discussions.` : ''}"""

replace_fallback = """            Generate a standalone post about the topic: "${topic}".
            CHALLENGE: Aim for varied thoughts, musings, ideas, dreams, or analysis (original ideas, shower thoughts, realizations, hopes, fears, anxieties, nostalgias, desires).
            ${useMention ? `Mention ${mentionHandle} and reference your previous public discussions.` : ''}"""

if apply_diff(bot_path, search_fallback, replace_fallback):
    print("Successfully updated fallback text post prompt")
else:
    print("Failed to update fallback text post prompt")

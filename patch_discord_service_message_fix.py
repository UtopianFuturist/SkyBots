import os

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Allow discord_message tool to actually send if we aren't in a conversational reply context (or just send it anyway for clarity)
old_suppression = """                             // HARDCODED FIX: Avoid double-posting.
                             // If we are already in the respond() flow on Discord, we don't need to send another DM.
                             // We just acknowledge the intent so the LLM can incorporate it into its natural response.
                             console.log(`[DiscordService] Suppressing discord_message tool to prevent double-post on Discord.`);
                             actionResults.push(`[System: The discord_message tool was suppressed because you are already talking to the admin on Discord. Do NOT send another message via tool; just respond naturally in this conversation.]`);"""

new_suppression = """                             // If we are in the respond() flow, we can just add it to actionResults to be acknowledged naturally.
                             // However, if this is an explicit refusal or separate thought, sending it as a message is safer.
                             console.log(`[DiscordService] Processing discord_message tool: ${msg}`);
                             await this._send(message.channel, msg);
                             actionResults.push(`[System: Message sent via tool: "${msg}"]`);"""

if old_suppression in content:
    content = content.replace(old_suppression, new_suppression)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Discord message suppression fix applied")
else:
    print("Could not find old_suppression in content")

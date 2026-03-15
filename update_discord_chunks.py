import sys

content = open('src/services/discordService.js').read()

search_text = """            if (responseText) {
                console.log(`[DiscordService] Sending response to Discord...`);
                const messages = responseText.split("\\n").filter(m => m.trim().length > 0).slice(0, 4);
                for (const msg of messages) {
                    await this._send(message.channel, msg);
                    if (messages.length > 1) await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));
                }"""

replace_text = """            if (responseText) {
                console.log(`[DiscordService] Sending response to Discord...`);
                // Increased slice limit from 4 to 20 to allow full lists (e.g. 20 items) to be delivered
                const messages = responseText.split("\\n").filter(m => m.trim().length > 0).slice(0, 20);
                for (const msg of messages) {
                    await this._send(message.channel, msg);
                    if (messages.length > 1) await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));
                }"""

if search_text in content:
    new_content = content.replace(search_text, replace_text)
    with open('src/services/discordService.js', 'w') as f:
        f.write(new_content)
    print('Successfully updated src/services/discordService.js')
else:
    print('Could not find exact search_text in src/services/discordService.js')
    sys.exit(1)

import re

with open('src/bot.js', 'r') as f:
    content = f.read()

# Add discord_message to executeAction in bot.js
new_discord_message_tool = r"""          if (action.tool === 'discord_message') {
              const msg = params.message || query;
              if (msg && config.DISCORD_BOT_TOKEN) {
                  const { prompt_for_image } = params;
                  let options = {};
                  if (prompt_for_image) {
                      console.log(`[Bot] Generating image for Discord message: "${prompt_for_image}"`);
                      const imgResult = await imageService.generateImage(prompt_for_image, { allowPortraits: true });
                      if (imgResult && imgResult.buffer) {
                          options.files = [{ attachment: imgResult.buffer, name: 'art.jpg' }];
                      }
                  }
                  // We need access to the channel from context if available, otherwise fallback to admin channel
                  const channelId = context?.channelId || config.DISCORD_ADMIN_CHANNEL_ID;
                  if (channelId) {
                      await discordService._send({ id: channelId }, msg, options);
                      return `Discord message sent to channel ${channelId}: "${msg}"`;
                  }
              }
              return "Discord message failed (no token or channel).";
          }"""

# Insert before bsky_post
content = re.sub(
    r'(          if \(action\.tool === \'bsky_post\'\) \{)',
    new_discord_message_tool + '\n\n' + r'\1',
    content
)

with open('src/bot.js', 'w') as f:
    f.write(content)

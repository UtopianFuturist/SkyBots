import os

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Add AttachmentBuilder to the main import
if "import { Client, GatewayIntentBits, Partials, ChannelType } from 'discord.js';" in content:
    content = content.replace("import { Client, GatewayIntentBits, Partials, ChannelType } from 'discord.js';",
                              "import { Client, GatewayIntentBits, Partials, ChannelType, AttachmentBuilder } from 'discord.js';")

# Replace dynamic imports with static one if present
content = content.replace("const { AttachmentBuilder } = await import('discord.js');", "")

with open(file_path, 'w') as f:
    f.write(content)
print("DiscordService import patch applied")

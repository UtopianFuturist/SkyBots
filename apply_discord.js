import fs from 'fs';
let discord = fs.readFileSync('src/services/discordService.js', 'utf8');
discord = discord.replace("import { socialHistoryService } from './socialHistoryService.js';",
    "import { socialHistoryService } from './socialHistoryService.js';\nimport { introspectionService } from './introspectionService.js';");
discord = discord.replace('await llmService.performEmotionalAfterActionReport(history, responseText);',
    'await introspectionService.performAAR("discord_response", responseText, { success: true, platform: "discord" }, { historySummary: history.slice(-3).map(h => h.content) });\n                await llmService.performEmotionalAfterActionReport(history, responseText);');
discord = discord.replace('console.log(`[DiscordService] Sent spontaneous message to admin: ${content.substring(0, 50)}...`);',
    'console.log(`[DiscordService] Sent spontaneous message to admin: ${content.substring(0, 50)}...`);\n                    await introspectionService.performAAR("discord_spontaneous", content, { success: !!result, platform: "discord" });');
fs.writeFileSync('src/services/discordService.js', discord);
console.log("DiscordService.js updated");

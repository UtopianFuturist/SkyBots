import fs from 'fs';

const filepath = 'src/bot.js';
let content = fs.readFileSync(filepath, 'utf8');

// 1. Add imports for cronService and nodeGatewayService
content = content.replace("import { discordService } from './services/discordService.js';",
    "import { discordService } from './services/discordService.js';\nimport { cronService } from './services/cronService.js';\nimport { nodeGatewayService } from './services/nodeGatewayService.js';");

// 2. Initialize them in init()
content = content.replace("await discordService.init().catch(err => console.error('[Bot] Discord error during init:', err));",
    "await discordService.init().catch(err => console.error('[Bot] Discord error during init:', err));\n    await cronService.init().catch(err => console.error('[Bot] Cron error during init:', err));\n    await nodeGatewayService.init().catch(err => console.error('[Bot] Gateway error during init:', err));");

fs.writeFileSync(filepath, content);

import fs from 'fs';

const filepath = 'src/bot.js';
let content = fs.readFileSync(filepath, 'utf8');

// 1. Add imports for cronService and nodeGatewayService
if (!content.includes("import { cronService } from './services/cronService.js';")) {
    content = content.replace("import { discordService } from './services/discordService.js';",
        "import { discordService } from './services/discordService.js';\nimport { cronService } from './services/cronService.js';\nimport { nodeGatewayService } from './services/nodeGatewayService.js';");
}

// 2. Initialize them in background after DiscordService.init()
if (!content.includes("cronService.init()")) {
    content = content.replace("discordService.init()",
        "discordService.init().then(() => {\n        cronService.init();\n        nodeGatewayService.init();\n    })");
}

fs.writeFileSync(filepath, content);

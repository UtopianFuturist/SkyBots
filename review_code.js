import fs from 'fs';
import path from 'path';

const files = [
    'src/services/discordService.js',
    'src/services/llmService.js',
    'src/services/dataStore.js',
    'src/services/cronService.js',
    'src/services/nodeGatewayService.js',
    'src/bot.js',
    'SOUL.md',
    'AGENTS.md',
    'STATUS.md'
];

async function main() {
    for (const f of files) {
        console.log(`--- FILE: ${f} ---`);
        if (fs.existsSync(f)) {
            console.log(fs.readFileSync(f, 'utf8'));
        } else {
            console.log('FILE NOT FOUND');
        }
    }
}
main();

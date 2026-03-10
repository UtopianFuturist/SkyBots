import fs from 'fs';
import { execSync } from 'child_process';

const files = [
    'src/bot.js',
    'src/services/llmService.js',
    'src/services/dataStore.js',
    'src/services/memoryService.js',
    'config.js'
];

files.forEach(file => {
    try {
        console.log(`Checking syntax for ${file}...`);
        // We use node --check which checks the syntax without executing
        execSync(`node --check ${file}`);
        console.log(`${file}: OK`);
    } catch (e) {
        console.error(`${file}: Syntax Error\n${e.message}`);
    }
});

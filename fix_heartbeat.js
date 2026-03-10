import fs from 'fs/promises';

async function fix() {
    const content = await fs.readFile('src/bot.js', 'utf-8');
    const target = 'async run() {';
    const start = content.indexOf(target);
    const brace = content.indexOf('{', start);

    const insertion = "\n    // Initialize 5-minute central heartbeat\n    setInterval(() => this.heartbeat(), 300000);\n    this.heartbeat();\n";

    // Check if already there
    if (content.includes('setInterval(() => this.heartbeat(), 300000)')) {
        console.log('Heartbeat already scheduled.');
        return;
    }

    const newContent = content.slice(0, brace + 1) + insertion + content.slice(brace + 1);
    await fs.writeFile('src/bot.js', newContent);
    console.log('Fixed heartbeat in run().');
}
fix();

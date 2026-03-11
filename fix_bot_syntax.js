import fs from 'fs';
let bot = fs.readFileSync('src/bot.js', 'utf8');

// I have two heartbeat implementations or a messed up merge.
// Let's remove the second one.

const duplicateStart = bot.indexOf("console.log('[Bot] Heartbeat pulse...');");
if (duplicateStart !== -1) {
    const nextAsync = bot.indexOf("async", duplicateStart);
    // Remove from duplicateStart to nextAsync
    bot = bot.slice(0, duplicateStart) + bot.slice(nextAsync);
}

fs.writeFileSync('src/bot.js', bot);

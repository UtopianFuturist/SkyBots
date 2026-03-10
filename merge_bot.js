import fs from 'fs/promises';

async function merge() {
    const cleanContent = await fs.readFile('src/bot.js.clean', 'utf-8');
    const currentContent = await fs.readFile('src/bot.js', 'utf-8');

    function extractMethod(content, name) {
        const start = content.indexOf(`async ${name}(`);
        if (start === -1) {
            const syncStart = content.indexOf(`${name}(`);
            if (syncStart === -1) return null;
            return getBalancedBraces(content, syncStart);
        }
        return getBalancedBraces(content, start);
    }

    function getBalancedBraces(content, start) {
        const braceStart = content.indexOf('{', start);
        if (braceStart === -1) return null;
        let count = 1;
        let pos = braceStart + 1;
        while (count > 0 && pos < content.length) {
            if (content[pos] === '{') count++;
            else if (content[pos] === '}') count--;
            pos++;
        }
        return content.slice(start, pos);
    }

    // Base is cleanContent
    let finalContent = cleanContent;

    const methodsToReplace = [
        'init',
        'processNotification',
        'performAutonomousPost',
        'checkMaintenanceTasks',
        'executeAction',
        '_getThreadHistory',
        '_handleError'
    ];

    for (const name of methodsToReplace) {
        const cleanMethod = extractMethod(cleanContent, name);
        const currentMethod = extractMethod(currentContent, name);

        if (currentMethod && cleanMethod) {
            finalContent = finalContent.replace(cleanMethod, currentMethod);
        } else if (currentMethod && !cleanMethod) {
            // Append before the last brace of the class
            const lastBrace = finalContent.lastIndexOf('}');
            finalContent = finalContent.slice(0, lastBrace) + '\n\n' + currentMethod + '\n' + finalContent.slice(lastBrace);
        }
    }

    // Ensure heartbeat is there
    if (!extractMethod(finalContent, 'heartbeat')) {
        const heartbeatMethod = `  async heartbeat() {
    console.log('[Bot] Heartbeat pulse...');
    try {
        await this.checkMaintenanceTasks();
        await this.checkDiscordSpontaneity();
        // Add more integrated tasks here
    } catch (e) {
        console.error('[Bot] Error in heartbeat:', e);
    }
  }`;
        const lastBrace = finalContent.lastIndexOf('}');
        finalContent = finalContent.slice(0, lastBrace) + '\n\n' + heartbeatMethod + '\n' + finalContent.slice(lastBrace);
    }

    await fs.writeFile('src/bot.js', finalContent);
    console.log('Successfully merged bot logic.');
}

merge().catch(console.error);
async function setupHeartbeat() {
    const content = await fs.readFile('src/bot.js', 'utf-8');

    // Add heartbeat to run() and init()
    const runStart = content.indexOf('async run() {');
    const braceStart = content.indexOf('{', runStart);
    const setupHeartbeatLine = "\n    // Initialize 5-minute central heartbeat\n    setInterval(() => this.heartbeat(), 300000);\n    this.heartbeat();\n";

    const newContent = content.slice(0, braceStart + 1) + setupHeartbeatLine + content.slice(braceStart + 1);
    await fs.writeFile('src/bot.js', newContent);
    console.log('Heartbeat scheduled in run().');
}
setupHeartbeat();

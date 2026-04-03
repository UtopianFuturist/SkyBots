import fs from 'fs';
const path = 'src/bot.js';
let content = fs.readFileSync(path, 'utf8');

const persistenceLogic = `
// Graceful Shutdown Logic
process.on('SIGINT', async () => {
    console.log('[Bot] SIGINT received. Shutting down gracefully...');
    try {
        if (dataStore.db && dataStore.db.write) {
            console.log('[Bot] Saving database before exit...');
            await dataStore.db.write();
        }
        console.log('[Bot] Shutdown complete. Exit 0');
        process.exit(0);
    } catch (e) {
        console.error('[Bot] Error during shutdown:', e);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('[Bot] SIGTERM received. Shutting down gracefully...');
    try {
        if (dataStore.db && dataStore.db.write) {
            console.log('[Bot] Saving database before exit...');
            await dataStore.db.write();
        }
        console.log('[Bot] Shutdown complete. Exit 0');
        process.exit(0);
    } catch (e) {
        console.error('[Bot] Error during shutdown:', e);
        process.exit(1);
    }
});
`;

content += persistenceLogic;

fs.writeFileSync(path, content);
console.log('Applied persistence fix');

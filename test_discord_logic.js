import { discordService } from './src/services/discordService.js';
import config from './config.js';

async function test() {
    console.log("Discord Enabled:", discordService.isEnabled);
    console.log("Discord Token (first 5):", discordService.token?.substring(0, 5));

    // Test helper methods
    const typing = discordService._startTypingLoop({ sendTyping: async () => console.log("Typing...") });
    setTimeout(() => {
        discordService._stopTypingLoop(typing);
        console.log("Typing loop stopped.");
        process.exit(0);
    }, 1000);
}

test().catch(console.error);

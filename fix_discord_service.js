import fs from 'fs';
import path from 'fs';

const filepath = 'src/services/discordService.js';
let content = fs.readFileSync(filepath, 'utf8');

// Use precise string replacements to avoid regex errors

const oldHandleMessage = `    async handleMessage(message) {
        if (message.author.bot) return;

        // --- THE MASTER KEY: Admin Unblock Bypass ---
        const isAdminForUnblock = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);`;

const newHandleMessage = `    async handleMessage(message) {
        if (message.author.bot) return;

        const isAdmin = message.author.username === this.adminName || (this.adminId && message.author.id === this.adminId);
        if (isAdmin) {
            this.isProcessingAdminRequest = true;
            console.log(\`[DiscordService] ADMIN_REQUEST_START: Processing message from \${message.author.username}\`);
        }

        try {
            await this._handleMessageInternal(message, isAdmin);
        } catch (err) {
            console.error('[DiscordService] Error in handleMessage:', err);
        } finally {
            if (isAdmin) {
                this.isProcessingAdminRequest = false;
                console.log(\`[DiscordService] ADMIN_REQUEST_END: Finished processing message from \${message.author.username}\`);
            }
        }
    }

    async _handleMessageInternal(message, isAdmin) {
        // --- THE MASTER KEY: Admin Unblock Bypass ---
        const isAdminForUnblock = isAdmin;`;

content = content.replace(oldHandleMessage, newHandleMessage);

// Handle isAdmin re-declarations inside the newly created _handleMessageInternal
// We need to find the start of _handleMessageInternal and then replace subsequent declarations

const internalStart = content.indexOf('async _handleMessageInternal(message, isAdmin) {');
if (internalStart !== -1) {
    let internalPart = content.substring(internalStart);
    // Replace only the first 3 occurrences of the declaration (which were originally in handleMessage)
    // but the regex will catch them all. Let's be careful.
    internalPart = internalPart.replace(/const isAdmin = message\.author\.username === this\.adminName \|\| \(this\.adminId && message\.author\.id === this\.adminId\);/g, '// isAdmin already declared');
    content = content.substring(0, internalStart) + internalPart;
}

// Update memory formatting with temporal labels
const oldMemoryBlock = `        let relevantMemories = '';
        if (relevantMemoriesList.length > 0) {
            relevantMemories = \`\\n\\n--- RELEVANT MEMORIES (Keyword Search: "\${memorySearchQuery}") ---\\n\${relevantMemoriesList.map(r => {
                let t = r.text;
                if (config.MEMORY_THREAD_HASHTAG) {
                    t = t.replace(new RegExp(config.MEMORY_THREAD_HASHTAG, 'g'), '');
                }
                return t.trim();
            }).join('\\n')}\\n---\`;
        }`;

const newMemoryBlock = `        let relevantMemories = '';
        if (relevantMemoriesList.length > 0) {
            const now = Date.now();
            relevantMemories = \`\\n\\n--- RELEVANT MEMORIES (Keyword Search: "\${memorySearchQuery}") ---\\n\` + relevantMemoriesList.map(r => {
                let cleanText = r.text;
                if (config.MEMORY_THREAD_HASHTAG) {
                    cleanText = cleanText.replace(new RegExp(config.MEMORY_THREAD_HASHTAG, 'g'), '').trim();
                }

                const ts = new Date(r.indexedAt).getTime();
                const diffMs = now - ts;
                const diffHours = diffMs / (1000 * 60 * 60);
                const diffMins = Math.floor(diffMs / 60000);

                let temporalLabel = "";
                if (cleanText.includes('[ADMIN_FACT]') || cleanText.includes('[FACT]')) {
                    if (diffHours > 2) {
                        temporalLabel = "[Historical Context (May no longer be active)] ";
                    } else if (diffMins < 1) {
                        temporalLabel = "[Just now] ";
                    } else {
                        temporalLabel = \`[\${diffMins}m ago] \`;
                    }
                } else {
                    if (diffMins < 1) temporalLabel = "[Just now] ";
                    else if (diffMins < 60) temporalLabel = \`[\${diffMins}m ago] \`;
                    else if (diffHours < 24) temporalLabel = \`[\${Math.floor(diffHours)}h ago] \`;
                }

                return \`[Memory from \${r.indexedAt}] \${temporalLabel}:\\n\${cleanText}\`;
            }).join('\\n\\n') + '\\n---';
        }`;

content = content.replace(oldMemoryBlock, newMemoryBlock);

fs.writeFileSync(filepath, content);

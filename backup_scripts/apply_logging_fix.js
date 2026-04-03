import fs from 'fs';
const dsPath = 'src/services/dataStore.js';
let content = fs.readFileSync(dsPath, 'utf8');

// Add sanitized debug log method
const logMethod = `
  addSanitizedDebugLog(type, data) {
    if (!this.db.data.debug_logs) this.db.data.debug_logs = [];
    // Sanitize common patterns
    const cleanData = JSON.parse(JSON.stringify(data, (key, value) => {
        if (typeof value === 'string') {
            return value.replace(/[a-zA-Z0-9]{20,}/g, '[REDACTED_SENSITIVE]');
        }
        return value;
    }));
    this.db.data.debug_logs.push({ type, data: cleanData, timestamp: Date.now() });
    if (this.db.data.debug_logs.length > 50) this.db.data.debug_logs.shift();
  }
`;

content = content.replace('init() {', logMethod + '\n  async init() {');

// Fix the init call because it's async now in many files but sometimes not used correctly
// Actually let's just insert it before init().

fs.writeFileSync(dsPath, content);
console.log('Applied logging fix');

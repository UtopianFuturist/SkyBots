import fs from 'fs';

const content = fs.readFileSync('src/services/dataStore.js', 'utf8');
const lines = content.split('\n');

// Find where the class ends
let classEndIndex = -1;
for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === '}') {
        classEndIndex = i;
        break;
    }
}

if (classEndIndex !== -1) {
    const beforeClassEnd = lines.slice(0, classEndIndex);
    const exportLine = lines.find(line => line.includes('export const dataStore = new DataStore();'));

    // Check if we have orphans after the class end but before the export
    // The methods we just added with >> will be at the very end.

    const newMethods = [
        '  getAdminFeedback() { return this.db.data.admin_feedback || []; }',
        '  getNuanceGradience() { return this.db.data.nuance_gradience || 5; }',
        '  getWorldFacts() { return this.db.data.world_facts || []; }'
    ];

    const newContent = [
        ...beforeClassEnd,
        ...newMethods,
        '}',
        'export const dataStore = new DataStore();'
    ];

    fs.writeFileSync('src/services/dataStore.js', newContent.join('\n'));
    console.log('Fixed DataStore structure.');
}

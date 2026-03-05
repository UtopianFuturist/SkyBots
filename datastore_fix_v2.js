import fs from 'fs';

const filePath = 'src/services/dataStore.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Identify the block to move
const initBlock = `    const configPostTopics = config.POST_TOPICS ? config.POST_TOPICS.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
    const configImageSubjects = config.IMAGE_SUBJECTS ? config.IMAGE_SUBJECTS.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];

    if (this.db.data.post_topics.length === 0 && configPostTopics.length > 0) {
        this.db.data.post_topics = configPostTopics;
    }
    if ((!this.db.data.image_subjects || this.db.data.image_subjects.length === 0) && configImageSubjects.length > 0) {
        this.db.data.image_subjects = configImageSubjects;
    }`;

// 2. Remove it from its current position
content = content.replace(initBlock, '');

// 3. Find the loop that merges defaultData
const loopStart = '    let changed = false;\n    for (const [key, value] of Object.entries(defaultData)) {';
const loopEnd = '    }\n    if (changed) await this.db.write();';

// 4. Insert the block AFTER the merge loop but BEFORE its closing brace or right after the write
const insertionPoint = '    if (changed) await this.db.write();';
content = content.replace(insertionPoint, insertionPoint + '\n\n' + initBlock + '\n    if (configPostTopics.length > 0 || configImageSubjects.length > 0) await this.db.write();');

fs.writeFileSync(filePath, content);
console.log('Fixed dataStore.js initialization order');

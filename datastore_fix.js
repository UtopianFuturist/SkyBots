import fs from 'fs';

const filePath = 'src/services/dataStore.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove duplicate post_topics: [] at line 137 (approx)
// We'll search for the second occurrence and remove it.
let lines = content.split('\n');
let postTopicsCount = 0;
let newLines = [];
for (let line of lines) {
    if (line.includes('post_topics: [],')) {
        postTopicsCount++;
        if (postTopicsCount === 2) {
            continue; // Skip the second one
        }
    }
    newLines.push(line);
}
content = newLines.join('\n');

// 2. Add image_subjects: [], after post_topics: [],
content = content.replace('post_topics: [],', 'post_topics: [],\n  image_subjects: [],');

// 3. Update init() to include config values
const initUpdate = `    await this.db.read();

    const configPostTopics = config.POST_TOPICS ? config.POST_TOPICS.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
    const configImageSubjects = config.IMAGE_SUBJECTS ? config.IMAGE_SUBJECTS.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];

    if (this.db.data.post_topics.length === 0 && configPostTopics.length > 0) {
        this.db.data.post_topics = configPostTopics;
    }
    if ((!this.db.data.image_subjects || this.db.data.image_subjects.length === 0) && configImageSubjects.length > 0) {
        this.db.data.image_subjects = configImageSubjects;
    }`;

content = content.replace('await this.db.read();', initUpdate);

fs.writeFileSync(filePath, content);
console.log('Fixed dataStore.js');

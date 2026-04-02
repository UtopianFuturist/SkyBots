import fs from 'fs';
const path = 'src/services/orchestratorService.js';
let content = fs.readFileSync(path, 'utf8');

// Fix spontaneity check trigger
content = content.replace('await this.performAutonomousPost();', 'this.addTaskToQueue(() => this.performAutonomousPost(), "autonomous_post_spontaneous");');

fs.writeFileSync(path, content);
console.log('Applied queue usage fix 2');

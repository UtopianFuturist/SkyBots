import fs from 'fs';
const path = 'src/services/orchestratorService.js';
let content = fs.readFileSync(path, 'utf8');

// Fix 1: Visual Audit 999-hour bug
// Replace "999" with a dynamic value or a more reasonable default.
// The user suggested replacing it with "curiosity-based" first-post trigger or just fixing it.
// I'll change it to 0 if no image has ever been posted, which will reflect as "0 hours since last image".
// Or better, change it to something that doesn't trigger the "it's been too long" logic immediately if it's a new bot.
// Actually, if it's 0, it means it's brand new. Let's make it 0.

content = content.replace(/hoursSinceImage = lastImageTime \? \(Date\.now\(\) - new Date\(lastImageTime\)\.getTime\(\)\) \/ 3600000 : 999;/g,
  'hoursSinceImage = lastImageTime ? (Date.now() - new Date(lastImageTime).getTime()) / 3600000 : 0;');

// Fix 2: Task Queue
// Insert queue logic into constructor
content = content.replace('constructor() {', 'constructor() {\n        this.taskQueue = [];\n        this.isProcessingQueue = false;');

// Add addTaskToQueue and processQueue methods
const queueMethods = `
    async addTaskToQueue(taskFn, taskName = 'anonymous_task') {
        this.taskQueue.push({ fn: taskFn, name: taskName });
        console.log(\`[Orchestrator] Task added to queue: \${taskName}. Queue length: \${this.taskQueue.length}\`);
        if (!this.isProcessingQueue) {
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.isProcessingQueue || this.taskQueue.length === 0) return;
        this.isProcessingQueue = true;

        while (this.taskQueue.length > 0) {
            const task = this.taskQueue.shift();
            console.log(\`[Orchestrator] Processing queued task: \${task.name}\`);
            try {
                await task.fn();
                console.log(\`[Orchestrator] Task completed: \${task.name}\`);
            } catch (e) {
                console.error(\`[Orchestrator] Error processing task \${task.name}:\`, e);
            }
        }

        this.isProcessingQueue = false;
    }
`;

content = content.replace('setBotInstance(bot) {', queueMethods + '\n    setBotInstance(bot) {');

fs.writeFileSync(path, content);
console.log('Applied fix 1');

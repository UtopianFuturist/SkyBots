import fs from 'fs';
const path = 'src/services/orchestratorService.js';
let content = fs.readFileSync(path, 'utf8');

// Use queue for performAutonomousPost in heartbeat
content = content.replace('await this.performAutonomousPost();', 'this.addTaskToQueue(() => this.performAutonomousPost(), "autonomous_post");');

// Use queue for performSpontaneityCheck
content = content.replace('await this.performSpontaneityCheck();', 'this.addTaskToQueue(() => this.performSpontaneityCheck(), "spontaneity_check");');

// Use queue for introspection call in performAutonomousPost
content = content.replace('await introspectionService.performAAR("autonomous_text_post", finalContent, { success: true, platform: "bluesky" }, { topic });',
  'this.addTaskToQueue(() => introspectionService.performAAR("autonomous_text_post", finalContent, { success: true, platform: "bluesky" }, { topic }), "aar_post");');

fs.writeFileSync(path, content);
console.log('Applied queue usage fix');

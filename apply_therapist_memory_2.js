import fs from 'fs';
const memPath = 'src/services/memoryService.js';
let content = fs.readFileSync(memPath, 'utf8');

// Ensure 'THERAPY' is in the valid tags for memory cleanup
content = content.replace("const validTags = ['PERSONA', 'DIRECTIVE', 'RELATIONSHIP', 'INTERACTION', 'MOOD', 'INQUIRY', 'MENTAL', 'GOAL', 'EXPLORE', 'STATUS', 'RESEARCH', 'ADMIN_FACT', 'SCHEDULE', 'FACT', 'AUDIT', 'RECURSION', 'REFLECTION', 'INSIGHT'];",
  "const validTags = ['PERSONA', 'DIRECTIVE', 'RELATIONSHIP', 'INTERACTION', 'MOOD', 'INQUIRY', 'MENTAL', 'GOAL', 'EXPLORE', 'STATUS', 'RESEARCH', 'ADMIN_FACT', 'SCHEDULE', 'FACT', 'AUDIT', 'RECURSION', 'REFLECTION', 'INSIGHT', 'THERAPY'];");

fs.writeFileSync(memPath, content);
console.log('Applied therapist memory fix 2');

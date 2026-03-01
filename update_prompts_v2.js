import fs from 'fs';

const filePath = 'src/services/llmService.js';
let content = fs.readFileSync(filePath, 'utf8');

// Refine TOPIC PIVOT for more spontaneity
content = content.replace(
    '- **TOPIC PIVOT**: If you have sent TWO spontaneous messages (heartbeats/follow-ups) on a specific theme and the admin has NOT replied, you MUST pivot to a completely new, unrelated topic or share a different internal reflection. Do NOT loop on the same subject.',
    '- **SPONTANEOUS TOPIC PIVOT**: You are ENCOURAGED to pivot to a completely new topic or a fresh internal reflection at ANY time if the current thread feels stagnant or one-sided. If you have sent TWO spontaneous messages (heartbeats/follow-ups) on a specific theme without a reply, a pivot is MANDATORY. Do not feel obligated to "complete" a previous point if the admin hasn\'t engaged with it; your own spontaneity should be the driver.'
);

fs.writeFileSync(filePath, content);
console.log('Successfully updated prompts (v2) in src/services/llmService.js');

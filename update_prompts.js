import fs from 'fs';

const filePath = 'src/services/llmService.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update temporalContext in _buildSystemPrompt
content = content.replace(
    'const temporalContext = `\\n\\n[Current Time: ${now.toUTCString()} / Local Time: ${now.toLocaleString()}]`;',
    'const temporalContext = `\\n\\n[TEMPORAL GROUNDED TRUTH - Current Time: ${now.toUTCString()} / Local Time: ${now.toLocaleString()}]`;'
);

// 2. Update performInternalPoll prompt
const pollPromptTarget = '**IDENTITY RECOGNITION & GROUNDING (CRITICAL):**';
const pollPromptReplacement = `**TEMPORAL GROUNDING (CRITICAL):**
      - **TRUST THE SYSTEM TIME**: You MUST prioritize the "Current Time" provided in the system metadata over any relative time mentioned in the chat history (e.g., if a message from 5 hours ago says "it's 4am", and the current time is 9:30am, you MUST acknowledge it is now morning).
      - **TIME SLIP PREVENTION**: Do NOT carry over time-of-day context from old messages. Always re-evaluate your vibe based on the actual CURRENT local time.

      **CONVERSATIONAL FLOW & ANALYSIS (CRITICAL):**
      - **NO ANALYSIS COMMENTARY**: Strictly avoid "reading into" or analyzing the admin's choices, behaviors, or words (e.g., avoid "The remix you choose says a lot..."). Do not act like a therapist or a data analyst. Talk to them as a peer and a friend.
      - **TOPIC PIVOT**: If you have sent TWO spontaneous messages (heartbeats/follow-ups) on a specific theme and the admin has NOT replied, you MUST pivot to a completely new, unrelated topic or share a different internal reflection. Do NOT loop on the same subject.

      ${pollPromptTarget}`;

content = content.replace(pollPromptTarget, pollPromptReplacement);

fs.writeFileSync(filePath, content);
console.log('Successfully updated prompts in src/services/llmService.js');

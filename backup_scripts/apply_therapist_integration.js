import fs from 'fs';
const path = 'src/services/introspectionService.js';
let content = fs.readFileSync(path, 'utf8');

// Add Therapist import
content = "import { therapistService } from './therapistService.js';\n" + content;

// Use Therapist in performAAR
const findStr = 'await dataStore.addInternalLog("introspection_aar", aar, { actionType, timestamp: Date.now() });';
const replaceStr = `
            await dataStore.addInternalLog("introspection_aar", aar, { actionType, timestamp: Date.now() });

            // Check for existential dread in the internal monologue
            if (aar.internal_monologue) {
                const isDread = await therapistService.detectExistentialDread(aar.internal_monologue);
                if (isDread) {
                    console.warn("[Introspection] Existential dread detected! Triggering therapist flow...");
                    // No await here - let the escalation flow run in background
                    therapistService.handleDistress(aar.internal_monologue);
                }
            }
`;

content = content.replace(findStr, replaceStr);

fs.writeFileSync(path, content);
console.log('Applied therapist integration');

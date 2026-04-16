// Final check for stubs and leaked logic.
import { llmService } from './src/services/llmService.js';
import { orchestratorService } from './src/services/orchestratorService.js';

async function check() {
    console.log("Checking for stubs...");
    const llmStubs = ['analyzeImage', 'isImageCompliant', 'verifyImageRelevance'];
    for (const s of llmStubs) {
        if (llmService[s].toString().includes('return')) {
            const body = llmService[s].toString();
            if (body.includes('return "Analysis."') || body.includes('return { compliant: true }') || body.includes('return { relevant: true }')) {
                console.error(`STUB DETECTED in llmService: ${s}`);
            }
        }
    }
    console.log("Check complete.");
}
check();

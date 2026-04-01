import fs from 'fs';

let orch = fs.readFileSync('src/services/orchestratorService.js', 'utf8');

// Basic tags and hooks using simpler replacements
orch = orch.replace("import { evaluationService } from './evaluationService.js';",
    "import { evaluationService } from './evaluationService.js';\nimport { introspectionService } from './introspectionService.js';");

// AARs
orch = orch.replace("if (reflection && memoryService.isEnabled()) {",
    "if (reflection && memoryService.isEnabled()) {\n                    await introspectionService.performAAR(\"post_reflection_followup\", post.content, { reflection }, { timestamp: post.timestamp });");
orch = orch.replace("await blueskyService.post(humor);",
    "await blueskyService.post(humor);\n                await introspectionService.performAAR(\"dialectic_humor\", humor, { success: true, platform: \"bluesky\", topic: match[0] });");
orch = orch.replace("await blueskyService.post(finalContent, null, { maxChunks: 4 });",
    "await blueskyService.post(finalContent, null, { maxChunks: 4 });\n                        await introspectionService.performAAR(\"autonomous_text_post\", finalContent, { success: true, platform: \"bluesky\" }, { topic });\n                        await dataStore.incrementTextPostsSinceLastImage();");
orch = orch.replace("await dataStore.updateLastAutonomousPostTime(new Date().toISOString());",
    "await dataStore.updateLastAutonomousPostTime(new Date().toISOString());\n              await introspectionService.performAAR(\"autonomous_image_post\", result.caption, { success: true, platform: \"bluesky\", topic }, { finalPrompt: result.finalPrompt, visionAnalysis: result.visionAnalysis });\n              await dataStore.updateLastBlueskyImagePostTime(new Date().toISOString());");

// Decision prompt stats
orch = orch.replace('const networkSentiment = dataStore.getNetworkSentiment();',
    'const networkSentiment = dataStore.getNetworkSentiment();\n            const lastImageTime = dataStore.getLastBlueskyImagePostTime();\n            const textPostsSinceImage = dataStore.getTextPostsSinceLastImage();\n            const hoursSinceImage = lastImageTime ? (Date.now() - new Date(lastImageTime).getTime()) / 3600000 : 999;');
orch = orch.replace('Mood: ${JSON.stringify(currentMood)}',
    'Mood: ${JSON.stringify(currentMood)}\n\n--- IMAGE FREQUENCY AUDIT ---\n- Hours since last image post: ${hoursSinceImage.toFixed(1)}\n- Text posts since last image post: ${textPostsSinceImage}\n\nYour admin prefers a healthy balance of visual and text expression. Consider if it is time to express yourself visually again.');

fs.writeFileSync('src/services/orchestratorService.js', orch);
console.log("OrchestratorService.js simple update complete.");

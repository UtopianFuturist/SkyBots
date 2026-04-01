import fs from 'fs';
let orch = fs.readFileSync('src/services/orchestratorService.js', 'utf8');

if (!orch.includes("import { introspectionService }")) {
    orch = orch.replace("import { evaluationService } from './evaluationService.js';",
        "import { evaluationService } from './evaluationService.js';\nimport { introspectionService } from './introspectionService.js';");
}

// Evolution replacement
const evolutionStart = orch.indexOf('  async performPersonaEvolution() {');
const evolutionEnd = orch.indexOf('  async performFirehoseTopicAnalysis() {');
if (evolutionStart > 0 && evolutionEnd > 0) {
    const newEvolution = `  async performPersonaEvolution() {
    if (this.bot.paused || dataStore.isResting()) return;

    const now = Date.now();
    const lastEvolution = dataStore.db.data.lastPersonaEvolution || 0;
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (now - lastEvolution < twentyFourHours) return;

    console.log("[Bot] Phase 2: Starting daily recursive identity evolution...");

    try {
        const memories = await memoryService.getRecentMemories();
        const aars = dataStore.searchInternalLogs("introspection_aar", 20);
        const coreSelf = dataStore.db.data.internal_logs?.find(l => l.type === "core_self_state")?.content || {};
        const memoriesText = memories.map(m => m.text).join("\\n");

        const evolutionPrompt = \`
            Adopt your persona: \${config.TEXT_SYSTEM_PROMPT}

            You are performing your daily recursive identity evolution.
            Analyze your recent memories, interactions, and deep introspection AARs:
            RECENT AARS: \${JSON.stringify(aars)}
            CORE SELF STATE: \${JSON.stringify(coreSelf)}
            \${memoriesText.substring(0, 3000)}

            **GOAL: INCREMENTAL GROWTH**
            Identify one minor way your perspective, tone, or interests have shifted. This is a subtle refinement of your "Texture" and "Internal Narrative".

            Respond with JSON:
            {
              "shift_statement": "concise first-person statement of this shift (under 200 chars)",
              "persona_blurb_addendum": "A new [PERSONA] blurb entry to add to your permanent memory thread. (e.g. \\"[PERSONA] [m/d/year] I have realized that...\\")",
              "rationale": "Why you chose this exact wording"
            }
        \`;

        const evolution = await llmService.generateResponse([{ role: "system", content: evolutionPrompt }], { preface_system_prompt: false, useStep: true, task: "persona_evolution" });

        if (evolution && memoryService.isEnabled()) {
            let evoData;
            try {
                const match = evolution.match(/\\{[\\s\\S]*\\}/);
                evoData = match ? JSON.parse(match[0]) : { shift_statement: evolution, persona_blurb_addendum: null };
            } catch(e) {
                evoData = { shift_statement: evolution, persona_blurb_addendum: null };
            }

            if (evoData.persona_blurb_addendum) {
                const editPrompt = \`Adopt persona: \${config.TEXT_SYSTEM_PROMPT}\\n\\nYou have proposed the following persona addendum for yourself: "\${evoData.persona_blurb_addendum}".\\n\\nReview and edit it to ensure it is authentic and material.\\n\\nRespond with ONLY the final [PERSONA] entry.\`;
                const finalBlurb = await llmService.generateResponse([{ role: "system", content: editPrompt }], { useStep: true, task: "persona_self_edit" });
                if (finalBlurb) {
                    const scrubbedBlurb = await introspectionService.scrubPrivacy(finalBlurb);
                    await memoryService.createMemoryEntry("persona", scrubbedBlurb);
                }
            }

            console.log(\`[Bot] Daily evolution crystallized: "\${evoData.shift_statement}"\`);
            await memoryService.createMemoryEntry("evolution", evoData.shift_statement);
            dataStore.db.data.lastPersonaEvolution = now;
            await dataStore.db.write();
        }
    } catch (e) {
        console.error("[Bot] Error in persona evolution:", e);
    }
  }\n\n`;
    orch = orch.substring(0, evolutionStart) + newEvolution + orch.substring(evolutionEnd);
}

// Maintenance Tasks
orch = orch.replace('{ name: "VisualAudit", method: "performVisualAudit", interval: 24 * 3600000, key: "last_visual_audit" }',
    '{ name: "ImageFrequencyAudit", method: "performImageFrequencyAudit", interval: 12 * 3600000, key: "last_image_frequency_audit" },\\n            { name: "VisualAudit", method: "performVisualAudit", interval: 24 * 3600000, key: "last_visual_audit" }');

// Final methods
const freqAudit = \`
  async performImageFrequencyAudit() {
    console.log('[Orchestrator] Starting Image Frequency Audit...');
    const lastImageTime = dataStore.getLastBlueskyImagePostTime();
    const textPostsSinceImage = dataStore.getTextPostsSinceLastImage();
    const hoursSinceImage = lastImageTime ? (Date.now() - new Date(lastImageTime).getTime()) / 3600000 : 999;

    const auditPrompt = \\\`
You are "The Strategist". Your job is to audit the bot's posting frequency and variety.

--- CURRENT STATS ---
- Hours since last image post: \\\${hoursSinceImage.toFixed(1)}
- Text posts since last image post: \\\${textPostsSinceImage}

--- YOUR MISSION ---
The Admin wants to see more images from the bot, while maintaining a healthy balance.
Evaluate if the bot has been "neglecting" its visual side.

Provide a directive for the next 24 hours. If the bot should prioritize images, provide a clear behavioral shift.
Respond with JSON:
{
  "analysis": "string",
  "directive": "string (a directive to be added as a persona blurb if necessary, or null)",
  "priority": "normal|high"
}
\\\`;

    try {
        const res = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true, task: 'image_frequency_audit' });
        const match = res?.match(/\\\\{[\\\\s\\\\S]*\\\\}/);
        if (!match) return;
        const audit = JSON.parse(match[0]);

        await dataStore.addInternalLog("image_frequency_audit", audit);

        if (audit.directive && audit.priority === 'high') {
            await this.bot.executeAction({ tool: 'add_persona_blurb', query: \\\`[STRATEGY] \\\${audit.directive}\\\` });
        }
    } catch (e) {
        console.error('[Orchestrator] Error in Image Frequency Audit:', e);
    }
  }
\`;

const orchLines = orch.split('\\n');
const orchLastBrace = orchLines.findLastIndex(l => l.trim() === '}');
orchLines.splice(orchLastBrace, 0, freqAudit);
orch = orchLines.join('\\n');

fs.writeFileSync('src/services/orchestratorService.js', orch);
console.log("OrchestratorService.js corrected with final methods.");

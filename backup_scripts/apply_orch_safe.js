import fs from 'fs';

let orch = fs.readFileSync('src/services/orchestratorService.js', 'utf8');

// 1. Import
if (!orch.includes("import { introspectionService }")) {
    orch = orch.replace("import { evaluationService } from './evaluationService.js';",
        "import { evaluationService } from './evaluationService.js';\nimport { introspectionService } from './introspectionService.js';");
}

// 2. Simple Hooks
orch = orch.replace("if (reflection && memoryService.isEnabled()) {",
    "if (reflection && memoryService.isEnabled()) {\n                    await introspectionService.performAAR(\"post_reflection_followup\", post.content, { reflection }, { timestamp: post.timestamp });");
orch = orch.replace("await blueskyService.post(humor);",
    "await blueskyService.post(humor);\n                await introspectionService.performAAR(\"dialectic_humor\", humor, { success: true, platform: \"bluesky\", topic: match[0] });");
orch = orch.replace("await blueskyService.post(finalContent, null, { maxChunks: 4 });",
    "await blueskyService.post(finalContent, null, { maxChunks: 4 });\n                        await introspectionService.performAAR(\"autonomous_text_post\", finalContent, { success: true, platform: \"bluesky\" }, { topic });\n                        await dataStore.incrementTextPostsSinceLastImage();");
orch = orch.replace("await dataStore.updateLastAutonomousPostTime(new Date().toISOString());",
    "await dataStore.updateLastAutonomousPostTime(new Date().toISOString());\n              await introspectionService.performAAR(\"autonomous_image_post\", result.caption, { success: true, platform: \"bluesky\", topic }, { finalPrompt: result.finalPrompt, visionAnalysis: result.visionAnalysis });\n              await dataStore.updateLastBlueskyImagePostTime(new Date().toISOString());");

// 3. Stats injection
orch = orch.replace('const networkSentiment = dataStore.getNetworkSentiment();',
    'const networkSentiment = dataStore.getNetworkSentiment();\n            const lastImageTime = dataStore.getLastBlueskyImagePostTime();\n            const textPostsSinceImage = dataStore.getTextPostsSinceLastImage();\n            const hoursSinceImage = lastImageTime ? (Date.now() - new Date(lastImageTime).getTime()) / 3600000 : 999;');
orch = orch.replace('Mood: ${JSON.stringify(currentMood)}',
    'Mood: ${JSON.stringify(currentMood)}\n\n--- IMAGE FREQUENCY AUDIT ---\n- Hours since last image post: ${hoursSinceImage.toFixed(1)}\n- Text posts since last image post: ${textPostsSinceImage}\n\nYour admin prefers a healthy balance of visual and text expression. Consider if it is time to express yourself visually again.');

// 4. Evolution
const evoCode = `  async performPersonaEvolution() {
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
                const jsonMatch = evolution.match(/\\{[\\s\\S]*\\}/);
                evoData = jsonMatch ? JSON.parse(jsonMatch[0]) : { shift_statement: evolution, persona_blurb_addendum: null };
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
  }`;
const evolutionRegex = /  async performPersonaEvolution\(\) \{[\s\S]*?\}\s+async performFirehoseTopicAnalysis\(\) \{/;
orch = orch.replace(evolutionRegex, evoCode + "\n\n  async performFirehoseTopicAnalysis() {");

// 5. Audit
const auditStartMarker = '  async performPersonaAudit() {';
const auditEndMarker = '  async getAnonymizedEmotionalContext() {';
const auditStart = orch.indexOf(auditStartMarker);
const auditEnd = orch.indexOf(auditEndMarker);
if (auditStart > 0 && auditEnd > 0) {
    const auditCode = `  async performPersonaAudit() {
    console.log('[Bot] Starting Agentic Persona Audit...');
    const blurbs = dataStore.getPersonaBlurbs();
    const memoryPersonaMemories = await memoryService.fetchRecentMemories("# SydneyDiary", 50);
    const personaMemories = memoryPersonaMemories.filter(m => m.text.includes("[PERSONA]"));
    const systemPrompt = config.TEXT_SYSTEM_PROMPT;
    const lessons = dataStore.getSessionLessons();
    const lessonContext = lessons.length > 0
        ? "\\n\\nRECENT SESSION LESSONS (Failures to learn from):\\n" + lessons.map(l => "- " + l.text).join('\\n')
        : "";

    const critiques = dataStore.searchInternalLogs('variety_critique', 20);
    const critiqueContext = critiques.length > 0
        ? "\\nRECENT VARIETY CRITIQUES:\\n" + critiques.map(c => "- Feedback: " + (c.content?.feedback || 'Repeated recent thought')).join('\\n')
        : "";

    const recursionMemories = await memoryService.getRecentMemories(20);
    const recursionContext = recursionMemories.filter(m => m.text.includes('[RECURSION]'))
        .map(m => "- Insight: " + m.text).join('\\n');

    const auditPrompt = \`
      As a persona auditor, analyze the following active persona blurbs and recent variety critiques.

      CORE SYSTEM PROMPT:
      "\${systemPrompt}"

      ACTIVE PERSONA BLURBS (DataStore):
      \${blurbs.length > 0 ? blurbs.map(b => "- [DS:" + b.uri + "] " + b.text).join('\\n') : 'None'}
      ACTIVE [PERSONA] MEMORIES (Bluesky Thread):
      \${personaMemories.length > 0 ? personaMemories.map(m => "- [MEM:" + m.uri + "] " + m.text).join('\\n') : 'None'}
      \${critiqueContext}
      \${lessonContext}
      RECURSIVE INSIGHTS:
      \${recursionContext || "None"}

      Identify any contradictions, redundancies, or blurbs that no longer serve the persona's evolution.
      If a blurb or memory should be removed, identify it by its full URI (prefixed with DS: or MEM:).

      Respond with JSON: { "analysis": "...", "removals": ["uri1", ...], "suggestion": "new blurb content or null" }
    \`;

    const response = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true, task: 'persona_audit' });
    try {
        const jsonMatch = response?.match(/\\{[\\s\\S]*\\}/);
        if (!jsonMatch) return "No JSON in audit";
        const audit = JSON.parse(jsonMatch[0]);
        let result = "Audit Analysis: " + audit.analysis + "\\n";

        for (const uri of audit.removals || []) {
            console.log("[Bot] Audit recommended removal of: " + uri);
            await this.bot.executeAction({ tool: 'remove_persona_blurb', query: uri });
            result += "- Removed blurb: " + uri + "\\n";
        }

        if (audit.suggestion) {
            console.log("[Bot] Audit recommended new blurb: " + audit.suggestion);
            await this.bot.executeAction({ tool: 'add_persona_blurb', query: audit.suggestion });
            result += "- Added new blurb: " + audit.suggestion + "\\n";
        }

        return result;
    } catch (e) {
        console.error('[Bot] Persona Audit failed:', e);
        return "Persona Audit failed during analysis.";
    }
  }`;
    orch = orch.substring(0, auditStart) + auditCode + "\n\n" + orch.substring(auditEnd);
}

// 6. Frequency Audit
const freqCode = `
  async performImageFrequencyAudit() {
    console.log('[Orchestrator] Starting Image Frequency Audit...');
    const lastImageTime = dataStore.getLastBlueskyImagePostTime();
    const textPostsSinceImage = dataStore.getTextPostsSinceLastImage();
    const hoursSinceImage = lastImageTime ? (Date.now() - new Date(lastImageTime).getTime()) / 3600000 : 999;

    const auditPrompt = \`
You are "The Strategist". Your job is to audit the bot's posting frequency and variety.

--- CURRENT STATS ---
- Hours since last image post: \${hoursSinceImage.toFixed(1)}
- Text posts since last image post: \${textPostsSinceImage}

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
\`;

    try {
        const res = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true, task: 'image_frequency_audit' });
        const jsonMatch = res?.match(/\\{[\\s\\S]*\\}/);
        if (!jsonMatch) return;
        const audit = JSON.parse(jsonMatch[0]);

        await dataStore.addInternalLog("image_frequency_audit", audit);

        if (audit.directive && audit.priority === 'high') {
            await this.bot.executeAction({ tool: 'add_persona_blurb', query: \`[STRATEGY] \${audit.directive}\` });
        }
    } catch (e) {
        console.error('[Orchestrator] Error in Image Frequency Audit:', e);
    }
  }`;

const orchLines = orch.split('\\n');
const orchLastBrace = orchLines.findLastIndex(l => l.trim() === '}');
orchLines.splice(orchLastBrace, 0, freqCode);
orch = orchLines.join('\\n');

orch = orch.replace('{ name: "VisualAudit", method: "performVisualAudit", interval: 24 * 3600000, key: "last_visual_audit" }',
    '{ name: "ImageFrequencyAudit", method: "performImageFrequencyAudit", interval: 12 * 3600000, key: "last_image_frequency_audit" },\n            { name: "VisualAudit", method: "performVisualAudit", interval: 24 * 3600000, key: "last_visual_audit" }');

fs.writeFileSync('src/services/orchestratorService.js', orch);
console.log("Success");

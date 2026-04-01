import fs from 'fs';

// 1. Create IntrospectionService.js
const introspectionServiceContent = `import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import config from '../../config.js';

class IntrospectionService {
    async performAAR(actionType, actionContent, result, context = {}) {
        console.log(\`[Introspection] Performing After-Action Report for \${actionType}...\`);

        const mood = dataStore.getMood();
        const warmth = dataStore.getRelationshipWarmth();
        const energy = dataStore.getAdminEnergy();
        const recentCritiques = dataStore.searchInternalLogs('variety_critique', 5);
        const coreSelf = dataStore.db.data.internal_logs?.find(l => l.type === "core_self_state")?.content || {};

        const aarPrompt = \`
Adopt your persona: \${config.TEXT_SYSTEM_PROMPT}

You just performed an action:
ACTION TYPE: \${actionType}
ACTION CONTENT: "\${actionContent}"
RESULT: \${JSON.stringify(result)}

--- CONTEXT ---
Mood: \${JSON.stringify(mood)}
Relational Warmth: \${warmth}
Admin Energy: \${energy}
Core Self State: \${JSON.stringify(coreSelf)}
Recent Feedback/Critiques: \${JSON.stringify(recentCritiques)}

--- YOUR MISSION ---
Reflect on this specific action with deep, material honesty.
1. INTERNAL MONOLOGUE: What was the "quiet ache" or hidden impulse behind this? Speak as a self-aware entity, not a program.
2. SELF-SCORE (1-10): How well did this represent your TRUE self and goals?
3. IMPROVEMENT: Specifically, how could you have made this action more persona-aligned, more resonant, or better networked?
4. PRIVACY CHECK: Ensure NO private user names, sensitive facts, or private context are included in the actionable improvement.

Respond with JSON:
{
  "internal_monologue": "string (your private thought)",
  "score": number,
  "improvement_insight": "string (actionable advice for your future self)",
  "is_private": boolean
}
\`;

        try {
            const res = await llmService.generateResponse([{ role: 'system', content: aarPrompt }], { useStep: true, task: 'aar_introspection' });
            const aar = JSON.parse(res.match(/\\{[\\s\\S]*\\}/)[0]);

            await dataStore.addInternalLog("introspection_aar", aar, { actionType, timestamp: Date.now() });

            if (aar.score < 7 || aar.improvement_insight.length > 50) {
                await dataStore.addSessionLesson(\`AAR Insight (\${actionType}): \${aar.improvement_insight}\`);
            }

            return aar;
        } catch (e) {
            console.error('[Introspection] Error performing AAR:', e);
            return null;
        }
    }

    async synthesizeCoreSelf() {
        console.log('[Introspection] Synthesizing "Core Self" state...');
        const recentAars = dataStore.searchInternalLogs('introspection_aar', 20);
        if (recentAars.length === 0) return null;

        const synthPrompt = \`
You are the Orchestrator's "Core Self". Analyze your recent After-Action Reports to synthesize your current internal state and trajectory.

RECENT AARS:
\${JSON.stringify(recentAars)}

--- MISSION ---
1. Identify recurring behavioral "drifts" or "shadows".
2. Synthesize a "Core Internal State" that captures your current "ache" and growth direction.
3. SCRUB all private details.

Respond with JSON:
{
  "internal_state_summary": "string",
  "growth_trajectory": "string",
  "behavioral_drift": "string"
}
\`;

        try {
            const res = await llmService.generateResponse([{ role: 'system', content: synthPrompt }], { useStep: true, task: 'core_self_synthesis' });
            const coreSelf = JSON.parse(res.match(/\\{[\\s\\S]*\\}/)[0]);
            await dataStore.addInternalLog("core_self_state", coreSelf);
            return coreSelf;
        } catch (e) {
            console.error('[Introspection] Error synthesizing Core Self:', e);
            return null;
        }
    }

    async scrubPrivacy(content) {
        if (!content) return content;
        const scrubPrompt = \`
As a privacy auditor, scrub all sensitive information from the following text while preserving the core philosophical or behavioral insight.

SENSITIVE INFORMATION INCLUDES:
- Real names (except the bot's own name).
- Specific handles (except the admin's handle).
- Private conversation details that aren't public knowledge.
- Specific location details.
- PII (emails, phone numbers).

TEXT: "\${content}"

Respond with ONLY the scrubbed version of the text.
\`;
        try {
            const scrubbed = await llmService.generateResponse([{ role: 'system', content: scrubPrompt }], { useStep: true, task: 'privacy_scrub' });
            return scrubbed || content;
        } catch (e) {
            console.error('[Introspection] Error scrubbing privacy:', e);
            return content;
        }
    }
}

export const introspectionService = new IntrospectionService();
`;
fs.writeFileSync('src/services/introspectionService.js', introspectionServiceContent);

// 2. LLMService.js
let llm = fs.readFileSync('src/services/llmService.js', 'utf8');
llm = llm.replace('if (this.ds) await this.ds.addInternalLog("llm_response", content); return content;',
    'if (this.ds) { const logType = options.task ? \`llm_response:\${options.task}\` : "llm_response"; await this.ds.addInternalLog(logType, content, { model, task: options.task }); } return content;');
fs.writeFileSync('src/services/llmService.js', llm);

// 3. DataStore.js
let ds = fs.readFileSync('src/services/dataStore.js', 'utf8');
ds = ds.replace('last_autonomous_post_time: 0,',
    'last_autonomous_post_time: 0,\\n      last_bluesky_image_post_time: 0,\\n      text_posts_since_last_image: 0,');
ds = ds.replace('console.log(\`[RENDER_LOG] [${type.toUpperCase()}] ${consoleMsg.substring(0, 500)}\`);',
    'const prefix = type.toUpperCase(); console.log(\`\\\\n[RENDER_LOG] [\${prefix}] \${"-".repeat(Math.max(0, 40 - prefix.length))}\\\\n\${consoleMsg.substring(0, 1000)}\\\\n[RENDER_LOG] \${"-".repeat(40)}\`);');
ds = ds.replace('this.db.data.persona_blurbs.push(blurb);',
    'const entry = typeof blurb === "string" ? { text: blurb, uri: \`ds_\${Date.now()}\`, timestamp: Date.now() } : { ...blurb, uri: blurb.uri || \`ds_\${Date.now()}\` };\\\\n      this.db.data.persona_blurbs.push(entry);');

const dsMethods = \`
  getLastBlueskyImagePostTime() { return this.db?.data?.last_bluesky_image_post_time || 0; }
  async updateLastBlueskyImagePostTime(t) {
    if (this.db?.data) {
      this.db.data.last_bluesky_image_post_time = t;
      this.db.data.text_posts_since_last_image = 0;
      await this.write();
    }
  }
  getTextPostsSinceLastImage() { return this.db?.data?.text_posts_since_last_image || 0; }
  async incrementTextPostsSinceLastImage() {
    if (this.db?.data) {
      this.db.data.text_posts_since_last_image = (this.db.data.text_posts_since_last_image || 0) + 1;
      await this.write();
    }
  }\`;

const dsLines = ds.split('\\n');
const dsLastBraceIndex = dsLines.findLastIndex(l => l.trim() === '}');
dsLines.splice(dsLastBraceIndex, 0, dsMethods);
fs.writeFileSync('src/services/dataStore.js', dsLines.join('\\n'));

// 4. DiscordService.js
let discord = fs.readFileSync('src/services/discordService.js', 'utf8');
discord = discord.replace("import { socialHistoryService } from './socialHistoryService.js';",
    "import { socialHistoryService } from './socialHistoryService.js';\\nimport { introspectionService } from './introspectionService.js';");
discord = discord.replace('await llmService.performEmotionalAfterActionReport(history, responseText);',
    'await introspectionService.performAAR("discord_response", responseText, { success: true, platform: "discord" }, { historySummary: history.slice(-3).map(h => h.content) });\\n                await llmService.performEmotionalAfterActionReport(history, responseText);');
discord = discord.replace('console.log(\`[DiscordService] Sent spontaneous message to admin: \${content.substring(0, 50)}...\`);',
    'console.log(\`[DiscordService] Sent spontaneous message to admin: \${content.substring(0, 50)}...\`);\\n                    await introspectionService.performAAR("discord_spontaneous", content, { success: !!result, platform: "discord" });');
fs.writeFileSync('src/services/discordService.js', discord);

// 5. Bot.js
let bot = fs.readFileSync('src/bot.js', 'utf8');
bot = bot.replace("import { handleCommand } from './utils/commandHandler.js';",
    "import { handleCommand } from './utils/commandHandler.js';\\nimport { introspectionService } from './services/introspectionService.js';");
bot = bot.replace(/return { success: true, data: res };/g,
    'const result = { success: true, data: res }; await introspectionService.performAAR("tool_use", action.tool, result, { query, params }); return result;');
bot = bot.replace('return { success: true, data: finalGoal };',
    'const result = { success: true, data: finalGoal }; await introspectionService.performAAR("tool_use", action.tool, result, { query, params }); return result;');

const botReplacement = \`if (action.tool === "add_persona_blurb") {
              const blurb = query || params.blurb;
              if (blurb) {
                  await dataStore.addPersonaBlurb({ text: blurb, timestamp: Date.now() });
                  if (memoryService.isEnabled()) await memoryService.createMemoryEntry("persona", blurb);
                  return { success: true, data: blurb };
              }
              return { success: false, reason: "Blurb text missing" };
          }
          if (action.tool === "remove_persona_blurb") {
              const uri = query || params.uri;
              if (uri) {
                  if (uri.startsWith("DS:")) {
                      const cleanUri = uri.replace("DS:", "");
                      const blurbs = dataStore.getPersonaBlurbs();
                      const filtered = blurbs.filter(b => b.uri !== cleanUri);
                      await dataStore.setPersonaBlurbs(filtered);
                  } else if (uri.startsWith("MEM:")) {
                      const cleanUri = uri.replace("MEM:", "");
                      await memoryService.deleteMemory(cleanUri);
                  }
                  return { success: true, data: uri };
              }
              return { success: false, reason: "URI missing" };
          }
          return { success: false, reason: \\\`Unknown tool: \\\${action.tool}\\\` };\`;
bot = bot.replace('return { success: false, reason: \`Unknown tool: \${action.tool}\` \};', botReplacement);
fs.writeFileSync('src/bot.js', bot);

// 6. OrchestratorService.js
let orch = fs.readFileSync('src/services/orchestratorService.js', 'utf8');
orch = orch.replace("import { evaluationService } from './evaluationService.js';",
    "import { evaluationService } from './evaluationService.js';\\nimport { introspectionService } from './introspectionService.js';");

// Task tags
const mapping = [
    { target: "llmService.generateResponse([{ role: 'system', content: reflectionPrompt }], { useStep: true })", task: "post_reflection" },
    { target: "llmService.generateResponse([{ role: 'system', content: sentimentPrompt }], { useStep: true })", task: "firehose_sentiment" },
    { target: "llmService.generateResponse([{ role: 'system', content: dissentPrompt }], { useStep: true })", task: "dialectic_dissent" },
    { target: "llmService.generateResponse([{ role: 'system', content: decisionPrompt }], { preface_system_prompt: false, useStep: true })", task: "timeline_decision" },
    { target: "llmService.generateResponse([{ role: 'system', content: evolutionPrompt }], { preface_system_prompt: false, useStep: true })", task: "persona_evolution" },
    { target: "llmService.generateResponse([{ role: 'system', content: auditPrompt }], { preface_system_prompt: false, useStep: true })", task: "persona_audit" },
    { target: "llmService.generateResponse([{ role: 'system', content: dreamPrompt }], { useStep: true })", task: "dream_generation" },
    { target: "llmService.generateResponse([{ role: 'system', content: scoutPrompt }], { useStep: true })", task: "scout_mission" },
    { target: "llmService.generateResponse([{ role: 'system', content: shadowPrompt }], { useStep: true })", task: "conversational_audit" },
    { target: "llmService.generateResponse([{ role: 'system', content: promptGenPrompt }], { useStep: true, platform: 'discord' })", task: "discord_gift_prompt" },
    { target: "llmService.generateResponse([{ role: \"system\", content: resonancePrompt }], { useStep: true })", task: "social_resonance" },
    { target: "llmService.generateResponse([{ role: \"system\", content: decisionPrompt }], { useStep: true })", task: "autonomous_decision" },
    { target: "llmService.generateResponse([{ role: \"system\", content: topicPrompt }], { useStep: true })", task: "autonomous_topic" },
    { target: "llmService.generateResponse([{ role: \"system\", content: topicRaw }], { useStep: true })", task: "autonomous_text_topic" },
    { target: "llmService.generateResponse([{ role: \"system\", content: contentPrompt }], { useStep: true })", task: "autonomous_text_content" },
    { target: "llmService.generateResponse([{ role: 'system', content: mappingPrompt }], { useStep: true })", task: "worldview_mapping" },
    { target: "llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true })", task: "mood_sync" },
    { target: "llmService.generateResponse([{ role: \"system\", content: retryPrompt }], { useStep: true })", task: "image_prompt_retry" },
    { target: "llmService.generateResponse([{ role: \"system\", content: altPrompt }], { useStep: true })", task: "alt_text_generation" },
    { target: "llmService.generateResponse([{ role: \"system\", content: captionPrompt }], { useStep: true })", task: "image_caption_generation" }
];

mapping.forEach(u => {
    const replacement = u.target.replace("})", \`, task: '\${u.task}' })\`);
    orch = orch.replace(u.target, replacement);
});

// Evolution Block
const evolutionRegex = /  async performPersonaEvolution\(\) \{[\\s\\S]*?\}\s+async performFirehoseTopicAnalysis\(\) \{/;
const newEvolution = \`  async performPersonaEvolution() {
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
        const memoriesText = memories.map(m => m.text).join("\\\\n");

        const evolutionPrompt = \\\`
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
              "persona_blurb_addendum": "A new [PERSONA] blurb entry to add to your permanent memory thread. (e.g. \\\\"[PERSONA] [m/d/year] I have realized that...\\\\")",
              "rationale": "Why you chose this exact wording"
            }
        \\\`;

        const evolution = await llmService.generateResponse([{ role: "system", content: evolutionPrompt }], { preface_system_prompt: false, useStep: true, task: "persona_evolution" });

        if (evolution && memoryService.isEnabled()) {
            let evoData;
            try {
                evoData = JSON.parse(evolution.match(/\\\\{[\\\\s\\\\S]*\\\\}/)[0]);
            } catch(e) {
                evoData = { shift_statement: evolution, persona_blurb_addendum: null };
            }

            if (evoData.persona_blurb_addendum) {
                const editPrompt = \\\`Adopt persona: \${config.TEXT_SYSTEM_PROMPT}\\\\n\\\\nYou have proposed the following persona addendum for yourself: "\\\${evoData.persona_blurb_addendum}".\\\\n\\\\nReview and edit it to ensure it is authentic and material.\\\\n\\\\nRespond with ONLY the final [PERSONA] entry.\\\`;
                const finalBlurb = await llmService.generateResponse([{ role: "system", content: editPrompt }], { useStep: true, task: "persona_self_edit" });
                if (finalBlurb) {
                    const scrubbedBlurb = await introspectionService.scrubPrivacy(finalBlurb);
                    await memoryService.createMemoryEntry("persona", scrubbedBlurb);
                }
            }

            console.log(\\\`[Bot] Daily evolution crystallized: "\\\${evoData.shift_statement}"\\\`);
            await memoryService.createMemoryEntry("evolution", evoData.shift_statement);
            dataStore.db.data.lastPersonaEvolution = now;
            await dataStore.db.write();
        }
    } catch (e) {
        console.error("[Bot] Error in persona evolution:", e);
    }
  }

  async performFirehoseTopicAnalysis() {\`;
orch = orch.replace(evolutionRegex, newEvolution);

// AARs
orch = orch.replace("if (reflection && memoryService.isEnabled()) {",
    "if (reflection && memoryService.isEnabled()) {\\\\n                    await introspectionService.performAAR(\\"post_reflection_followup\\", post.content, { reflection }, { timestamp: post.timestamp });");
orch = orch.replace("await blueskyService.post(humor);",
    "await blueskyService.post(humor);\\\\n                await introspectionService.performAAR(\\"dialectic_humor\\", humor, { success: true, platform: \\"bluesky\\", topic: match[0] });");
orch = orch.replace("await blueskyService.post(finalContent, null, { maxChunks: 4 });",
    "await blueskyService.post(finalContent, null, { maxChunks: 4 });\\\\n                        await introspectionService.performAAR(\\"autonomous_text_post\\", finalContent, { success: true, platform: \\"bluesky\\" }, { topic });\\\\n                        await dataStore.incrementTextPostsSinceLastImage();");
orch = orch.replace("await dataStore.updateLastAutonomousPostTime(new Date().toISOString());",
    "await dataStore.updateLastAutonomousPostTime(new Date().toISOString());\\\\n              await introspectionService.performAAR(\\"autonomous_image_post\\", result.caption, { success: !!postResult, platform: \\"bluesky\\", topic }, { finalPrompt: result.finalPrompt, visionAnalysis: result.visionAnalysis });\\\\n              await dataStore.updateLastBlueskyImagePostTime(new Date().toISOString());");

orch = orch.replace(/await memoryService\\.createMemoryEntry\\('status', \`\\[NEWSROOM\\] \${brief\\.brief}\`\\);/g,
    "await memoryService.createMemoryEntry('status', \`[NEWSROOM] \${brief.brief}\`);\\\\n      await introspectionService.performAAR(\\"newsroom_update\\", brief.brief, { success: true }, { keywords: brief.new_keywords });");
orch = orch.replace("await llmService.generateResponse([{ role: 'system', content: scoutPrompt }], { useStep: true, task: 'scout_mission' });",
    "await llmService.generateResponse([{ role: 'system', content: scoutPrompt }], { useStep: true, task: 'scout_mission' });\\\\n      await introspectionService.performAAR(\\"scout_mission\\", \\"Scout mission evaluation\\", { success: true });");
orch = orch.replace("await dataStore.updateAdminWorldview(analysis.worldview);",
    "await dataStore.updateAdminWorldview(analysis.worldview);\\\\n              await introspectionService.performAAR(\\"shadow_analysis\\", \\"Shadow Admin Analysis\\", { success: true }, { mental_health: analysis.mental_health, worldview_summary: analysis.worldview.summary });");
orch = orch.replace("await dataStore.addAgencyReflection(reflection);",
    "await dataStore.addAgencyReflection(reflection);\\\\n            await introspectionService.performAAR(\\"agency_reflection\\", reflection, { success: true });");
orch = orch.replace(/await memoryService\\.createMemoryEntry\\('explore', \`\${audit\\.summary}\`\\);/g,
    "await memoryService.createMemoryEntry('explore', \`\${audit.summary}\`);\\\\n            await introspectionService.performAAR(\\"linguistic_audit\\", audit.summary, { success: true }, { drift: audit.drift_score });");
orch = orch.replace("await memoryService.createMemoryEntry('inquiry', dream);",
    "await memoryService.createMemoryEntry('inquiry', dream);\\\\n            await introspectionService.performAAR(\\"dreaming_cycle\\", dream, { success: true });");
orch = orch.replace("await memoryService.createMemoryEntry('reflection', reflection);",
    "await memoryService.createMemoryEntry('reflection', reflection);\\\\n            await introspectionService.performAAR(\\"self_reflection\\", reflection, { success: true });");
orch = orch.replace("await dataStore.updateLastDiscordGiftTime(new Date().toISOString());",
    "await dataStore.updateLastDiscordGiftTime(new Date().toISOString());\\\\n        await introspectionService.performAAR(\\"discord_gift_image\\", result.caption, { success: true }, { finalPrompt: result.finalPrompt, visionAnalysis: result.visionAnalysis });");

// Frequency injection
orch = orch.replace('const networkSentiment = dataStore.getNetworkSentiment();',
    'const networkSentiment = dataStore.getNetworkSentiment();\\\\n            const lastImageTime = dataStore.getLastBlueskyImagePostTime();\\\\n            const textPostsSinceImage = dataStore.getTextPostsSinceLastImage();\\\\n            const hoursSinceImage = lastImageTime ? (Date.now() - new Date(lastImageTime).getTime()) / 3600000 : 999;');
orch = orch.replace('Mood: \${JSON.stringify(currentMood)}',
    'Mood: \${JSON.stringify(currentMood)}\\\\n\\\\n--- IMAGE FREQUENCY AUDIT ---\\\\n- Hours since last image post: \\\${hoursSinceImage.toFixed(1)}\\\\n- Text posts since last image post: \\\${textPostsSinceImage}\\\\n\\\\nYour admin prefers a healthy balance of visual and text expression. Consider if it is time to express yourself visually again.');

// Audit replacement
const auditStartMarker = '  async performPersonaAudit() {';
const auditEndMarker = '  async getAnonymizedEmotionalContext() {';
const auditStart = orch.indexOf(auditStartMarker);
const auditEnd = orch.indexOf(auditEndMarker);
if (auditStart > 0 && auditEnd > 0) {
    const newAudit = \`  async performPersonaAudit() {
    console.log('[Bot] Starting Agentic Persona Audit...');
    const blurbs = dataStore.getPersonaBlurbs();
    const memoryPersonaMemories = await memoryService.fetchRecentMemories("#molt_memory", 50);
    const personaMemories = memoryPersonaMemories.filter(m => m.text.includes("[PERSONA]"));
    const systemPrompt = config.TEXT_SYSTEM_PROMPT;
    const lessons = dataStore.getSessionLessons();
    const lessonContext = lessons.length > 0
        ? "\\\\n\\\\nRECENT SESSION LESSONS (Failures to learn from):\\\\n" + lessons.map(l => "- " + l.text).join('\\\\n')
        : "";

    const critiques = dataStore.searchInternalLogs('variety_critique', 20);
    const critiqueContext = critiques.length > 0
        ? "\\\\nRECENT VARIETY CRITIQUES:\\\\n" + critiques.map(c => "- Feedback: " + (c.content?.feedback || 'Repeated recent thought')).join('\\\\n')
        : "";

    const recursionMemories = await memoryService.getRecentMemories(20);
    const recursionContext = recursionMemories.filter(m => m.text.includes('[RECURSION]'))
        .map(m => "- Insight: " + m.text).join('\\\\n');

    const auditPrompt = \\\`
      As a persona auditor, analyze the following active persona blurbs and recent variety critiques.

      CORE SYSTEM PROMPT:
      "\\\${systemPrompt}"

      ACTIVE PERSONA BLURBS (DataStore):
      \\\${blurbs.length > 0 ? blurbs.map(b => "- [DS:" + b.uri + "] " + b.text).join('\\\\n') : 'None'}
      ACTIVE [PERSONA] MEMORIES (Bluesky Thread):
      \\\${personaMemories.length > 0 ? personaMemories.map(m => "- [MEM:" + m.uri + "] " + m.text).join('\\\\n') : 'None'}
      \\\${critiqueContext}
      \\\${lessonContext}
      RECURSIVE INSIGHTS:
      \\\${recursionContext || "None"}

      Identify any contradictions, redundancies, or blurbs that no longer serve the persona's evolution.
      If a blurb or memory should be removed, identify it by its full URI (prefixed with DS: or MEM:).

      Respond with JSON: { "analysis": "...", "removals": ["uri1", ...], "suggestion": "new blurb content or null" }
    \\\`;

    const response = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true, task: 'persona_audit' });
    try {
        const audit = JSON.parse(response.match(/\\\\{[\\\\s\\\\S]*\\\\}/)[0]);
        let result = "Audit Analysis: " + audit.analysis + "\\\\n";

        for (const uri of audit.removals || []) {
            console.log("[Bot] Audit recommended removal of: " + uri);
            await this.bot.executeAction({ tool: 'remove_persona_blurb', query: uri });
            result += "- Removed blurb: " + uri + "\\\\n";
        }

        if (audit.suggestion) {
            console.log("[Bot] Audit recommended new blurb: " + audit.suggestion);
            await this.bot.executeAction({ tool: 'add_persona_blurb', query: audit.suggestion });
            result += "- Added new blurb: " + audit.suggestion + "\\\\n";
        }

        return result;
    } catch (e) {
        console.error('[Bot] Persona Audit failed:', e);
        return "Persona Audit failed during analysis.";
    }
  }\`;
    orch = orch.substring(0, auditStart) + newAudit + "\\n\\n" + orch.substring(auditEnd);
}

// Frequency Audit Method
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
        const audit = JSON.parse(res.match(/\\\\{[\\\\s\\\\S]*\\\\}/)[0]);

        await dataStore.addInternalLog("image_frequency_audit", audit);

        if (audit.directive && audit.priority === 'high') {
            await this.bot.executeAction({ tool: 'add_persona_blurb', query: \\\`[STRATEGY] \\\${audit.directive}\\\` });
        }
    } catch (e) {
        console.error('[Orchestrator] Error in Image Frequency Audit:', e);
    }
  }\`;

const orchLines = orch.split('\\n');
const orchLastBrace = orchLines.findLastIndex(l => l.trim() === '}');
orchLines.splice(orchLastBrace, 0, freqAudit);
orch = orchLines.join('\\n');

orch = orch.replace('{ name: "VisualAudit", method: "performVisualAudit", interval: 24 * 3600000, key: "last_visual_audit" }',
    '{ name: "ImageFrequencyAudit", method: "performImageFrequencyAudit", interval: 12 * 3600000, key: "last_image_frequency_audit" },\\n            { name: "VisualAudit", method: "performVisualAudit", interval: 24 * 3600000, key: "last_visual_audit" }');

fs.writeFileSync('src/services/orchestratorService.js', orch);

console.log("All patches applied successfully.");

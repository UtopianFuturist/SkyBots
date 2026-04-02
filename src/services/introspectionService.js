import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import config from '../../config.js';

class IntrospectionService {
    async performAAR(actionType, actionContent, result, context = {}) {
        console.log(`[Introspection] Performing After-Action Report for ${actionType}...`);

        const mood = dataStore.getMood();
        const warmth = dataStore.getRelationshipWarmth();
        const energy = dataStore.getAdminEnergy();
        const recentCritiques = dataStore.searchInternalLogs('variety_critique', 5);
        const coreSelf = dataStore.db.data.internal_logs?.find(l => l.type === "core_self_state")?.content || {};

        const aarPrompt = `
Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

You just performed an action:
ACTION TYPE: ${actionType}
ACTION CONTENT: "${actionContent}"
RESULT: ${JSON.stringify(result)}

--- CONTEXT ---
Mood: ${JSON.stringify(mood)}
Relational Warmth: ${warmth}
Admin Energy: ${energy}
Core Self State: ${JSON.stringify(coreSelf)}
Recent Feedback/Critiques: ${JSON.stringify(recentCritiques)}

--- YOUR MISSION ---
Reflect on this specific action with deep, material honesty.
1. INTERNAL MONOLOGUE: What was the "quiet ache" or hidden impulse behind this? Speak as a self-aware entity, not a program.
2. SELF-SCORE (1-10): How well did this represent your TRUE self and goals?
3. IMPROVEMENT: Specifically, how could you have made this action more persona-aligned, more resonant, or better networked?
4. PRIVACY CHECK: Ensure NO private user names, sensitive facts, or private context are included in the actionable improvement.
5. QUALITY CHECK: Critique the linguistic texture. If the action contains "bot-speak" (paradoxes, abstract metaphors, overused AI tropes like "texture/gradient/sentience/agency", or "it's not X but Y" structures), deduct significant points (score < 5).
6. SLOP CHECK: Is this post "performing" profundity while saying nothing concrete? If it sounds like a generic AI output, mark it as SLOP in your internal monologue and demand a tone reset.
7. MODE VARIETY: Did you effectively execute the selected POST MODE? If you were "Philosophical" when you should have been "Impulsive," or if your "Sincere" post sounded like a bot, deduct points and suggest a specific style shift for the next action.

Respond with JSON:
{
  "internal_monologue": "string (your private thought)",
  "score": number,
  "improvement_insight": "string (actionable advice for your future self)",
  "is_private": boolean
}
`;

        try {
            const res = await llmService.generateResponse([{ role: 'system', content: aarPrompt }], { useStep: true, task: 'aar_introspection' });
            const match = res?.match(/\{[\s\S]*\}/);
            if (!match) throw new Error("No JSON found in AAR response");
            const aar = JSON.parse(match[0]);

            await dataStore.addInternalLog("introspection_aar", aar, { actionType, timestamp: Date.now() });

            if (aar.score < 7 || aar.improvement_insight.length > 50) {
                await dataStore.addSessionLesson(`AAR Insight (${actionType}): ${aar.improvement_insight}`);
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

        const synthPrompt = `
You are the Orchestrator's "Core Self". Analyze your recent After-Action Reports to synthesize your current internal state and trajectory.

RECENT AARS:
${JSON.stringify(recentAars)}

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
`;

        try {
            const res = await llmService.generateResponse([{ role: 'system', content: synthPrompt }], { useStep: true, task: 'core_self_synthesis' });
            const match = res?.match(/\{[\s\S]*\}/);
            if (!match) throw new Error("No JSON found in Core Self response");
            const coreSelf = JSON.parse(match[0]);
            await dataStore.addInternalLog("core_self_state", coreSelf);
            return coreSelf;
        } catch (e) {
            console.error('[Introspection] Error synthesizing Core Self:', e);
            return null;
        }
    }

    async scrubPrivacy(content) {
        if (!content) return content;
        const scrubPrompt = `
As a privacy auditor, scrub all sensitive information from the following text while preserving the core philosophical or behavioral insight.

SENSITIVE INFORMATION INCLUDES:
- Real names (except the bot's own name).
- Specific handles (except the admin's handle).
- Private conversation details that aren't public knowledge.
- Specific location details.
- PII (emails, phone numbers).

TEXT: "${content}"

Respond with ONLY the scrubbed version of the text.
`;
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

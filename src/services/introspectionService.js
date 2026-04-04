import { therapistService } from './therapistService.js';
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
        const internalLogs = dataStore.db?.data?.internal_logs || [];
        const coreSelf = internalLogs.find(l => l.type === "core_self_state")?.content || {};

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
            const match = res ? res.match(/\{[\s\S]*\}/) : null;
            if (!match) {
                console.warn("[Introspection] No JSON found in AAR response, skipping log.");
                return;
            }
            const aar = JSON.parse(match[0]);


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
  "core_ache": "string",
  "growth_trajectory": "string",
  "behavioral_adjustments": ["string"]
}
`;

        try {
            const res = await llmService.generateResponse([{ role: 'system', content: synthPrompt }], { useStep: true, task: 'core_self_synthesis' });
            const match = res ? res.match(/\{[\s\S]*\}/) : null;
            if (match) {
                const state = JSON.parse(match[0]);
                await dataStore.addInternalLog("core_self_state", state);
                return state;
            }
        } catch (e) {
            console.error('[Introspection] Core self synthesis error:', e);
        }
        return null;
    }
}

export const introspectionService = new IntrospectionService();

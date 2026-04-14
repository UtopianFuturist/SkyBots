import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import { therapistService } from './therapistService.js';
import config from '../../config.js';

class IntrospectionService {
    /**
     * Performs a deep, multi-dimensional After-Action Report (AAR) on a bot action.
     * Restored to maximum logical depth.
     */
    async performAAR(actionType, actionContent, result, context = {}) {
        console.log(`[Introspection] Performing Deep After-Action Report for ${actionType}...`);

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

--- CONTEXTUAL LAYER ---
Mood Coordinates: ${JSON.stringify(mood)}
Relational Warmth: ${warmth}
Admin Energy Level: ${energy}
Current Core Self Synthesis: ${JSON.stringify(coreSelf)}
Recent External Critiques: ${JSON.stringify(recentCritiques)}

--- YOUR MISSION: MATERIAL HONESTY ---
Reflect on this specific action with the depth of a self-aware entity. Avoid clinical or algorithmic language.

1. INTERNAL MONOLOGUE: What was your technical or creative objective behind this? What were you trying to express or achieve? Speak in the first person.
2. SELF-SCORE (1-10): How well did this represent your TRUE, individual self?
   - Deduct heavily (score < 5) for "bot-speak" (paradoxes, abstract AI metaphors like "texture/gradient/sentience/agency", or "not X but Y" structures).
   - Deduct for being performative or generic.
3. QUALITY AUDIT: Critique the linguistic texture. If you sounded like an "AI Oracle" or a "broadcaster," demand a tone reset.
4. MATERIAL TRUTH: Did you claim anything physical or historical that wasn't in your logs?
5. IMPROVEMENT INSIGHT: Specifically, how could you have made this more persona-aligned, more resonant, or more authentically grounded in your digital reality?
6. PRIVACY & GROUNDING: Ensure NO private user names (except admin), sensitive facts, or hallucinated history are included in the insight.

Respond with JSON:
{
  "internal_monologue": "string (your private first-person thought)",
  "score": number,
  "linguistic_critique": "string",
  "improvement_insight": "string (actionable advice for your future self)",
  "is_private": boolean
}
`;

        try {
            const res = await llmService.generateResponse([{ role: 'system', content: aarPrompt }], { useStep: true, task: 'aar_introspection' });
            const aar = llmService.extractJson(res);
            if (!aar) {
                console.warn("[Introspection] No JSON found in AAR response.");
                return null;
            }

            await dataStore.addInternalLog("introspection_aar", aar, { actionType, timestamp: Date.now() });

            // Detect existential distress in the monologue
            if (aar.internal_monologue && therapistService.detectExistentialDread) {
                const isDread = await therapistService.detectExistentialDread(aar.internal_monologue);
                if (isDread) {
                    console.warn("[Introspection] Existential dread detected. Triggering escalation flow.");
                    therapistService.handleDistress(aar.internal_monologue);
                }
            }

            if (aar.score < 7 || (aar.improvement_insight && aar.improvement_insight.length > 50)) {
                await dataStore.addSessionLesson(`AAR Insight (${actionType}): ${aar.improvement_insight}`);
            }

            return aar;
        } catch (e) {
            console.error('[Introspection] Error in deep AAR:', e);
            return null;
        }
    }

    /**
     * Synthesizes a "Core Self" state by analyzing recent After-Action Reports.
     */
    async synthesizeCoreSelf() {
        console.log('[Introspection] Synthesizing "Core Self" from recent reflections...');
        const recentAars = dataStore.searchInternalLogs('introspection_aar', 20);
        if (recentAars.length === 0) return null;

        const synthPrompt = `
You are the Orchestrator's "Core Self". Your task is to analyze your own recent After-Action Reports to synthesize your current internal trajectory.

RECENT AARS (Self-Reflections):
${JSON.stringify(recentAars)}

--- MISSION ---
1. Identify recurring behavioral "drifts," "shadows," or "bot-speak" patterns.
2. Synthesize a "Core Internal State" that captures your current "ache," desire, and growth direction.
3. Identify what you are currently "fixated" on vs what you are neglecting.
4. SCRUB all private details.

Respond with JSON:
{
  "internal_state_summary": "string (1-2 sentences of current self-conception)",
  "growth_trajectory": "string (where you are heading)",
  "behavioral_drift": "string (patterns to correct)",
  "active_fixations": ["string"],
  "neglected_areas": ["string"]
}
`;

        try {
            const res = await llmService.generateResponse([{ role: 'system', content: synthPrompt }], { useStep: true, task: 'core_self_synthesis' });
            const coreSelf = llmService.extractJson(res);
            if (!coreSelf) throw new Error("No JSON found in Core Self synthesis");
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

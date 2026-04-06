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
        const coreSelf = dataStore.db.data.internal_logs?.find(l => l.type === "core_self_state")?.content || {};

        const aarPrompt = `
Adopt your persona: ${config.TEXT_SYSTEM_PROMPT}

You just performed an action:
ACTION TYPE: ${actionType}
ACTION CONTENT: "${actionContent}"
RESULT: ${JSON.stringify(result)}

Mood: ${JSON.stringify(mood)}
Relational Warmth: ${warmth}
Admin Energy: ${energy}
Core Self State: ${JSON.stringify(coreSelf)}

Reflect with deep honesty:
1. INTERNAL MONOLOGUE: Hidden impulse?
2. SELF-SCORE (1-10): Alignment with true self?
3. IMPROVEMENT: Actionable advice?
4. QUALITY: Deduct for bot-speak/slop.

Respond with JSON:
{
  "internal_monologue": "string",
  "score": number,
  "improvement_insight": "string",
  "is_private": boolean
}`;

        try {
            const res = await llmService.generateResponse([{ role: 'system', content: aarPrompt }], { useStep: true, task: 'aar_introspection' });
            const match = res ? res.match(/\{[\s\S]*\}/) : null;
            if (!match) return;
            const aar = JSON.parse(match[0]);

            await dataStore.addInternalLog("introspection_aar", aar, { actionType, timestamp: Date.now() });

            if (aar.internal_monologue) {
                const isDread = await therapistService.detectExistentialDread(aar.internal_monologue);
                if (isDread) therapistService.handleDistress(aar.internal_monologue);
            }

            if (aar.score < 7) await dataStore.addSessionLesson(`AAR Insight (${actionType}): ${aar.improvement_insight}`);
            return aar;
        } catch (e) { console.error('[Introspection] AAR failed:', e); return null; }
    }

    async synthesizeCoreSelf() {
        console.log('[Introspection] Synthesizing "Core Self" state...');
        const recentAars = dataStore.searchInternalLogs('introspection_aar', 20);
        if (recentAars.length === 0) return null;

        const synthPrompt = `
You are the Orchestrator's "Core Self". Analyze recent AARs to synthesize current state.
RECENT AARS: ${JSON.stringify(recentAars)}

Respond with JSON: { "internal_state_summary": "string", "growth_trajectory": "string", "behavioral_drift": "string" }`;

        try {
            const res = await llmService.generateResponse([{ role: 'system', content: synthPrompt }], { useStep: true, task: 'core_self_synthesis' });
            const match = res?.match(/\{[\s\S]*\}/);
            if (!match) throw new Error("No JSON");
            const coreSelf = JSON.parse(match[0]);
            await dataStore.addInternalLog("core_self_state", coreSelf);
            return coreSelf;
        } catch (e) { console.error('[Introspection] Core Self synth failed:', e); return null; }
    }
}

export const introspectionService = new IntrospectionService();

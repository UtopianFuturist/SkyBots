import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import config from '../../config.js';

class EvaluationService {
    async evaluatePost(content) {
        const prompt = `As a critical analyzer for @${config.BOT_NAME}, evaluate this post content for quality, persona alignment, and "slop" factors.
Content: "${content}"

Identify any overused AI tropes, repetitive metaphors, or failures in grounding.
Respond with JSON: { "score": number (1-10), "feedback": "string", "hallucination_risk": boolean }`;

        try {
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true, task: 'evaluation' });
            const match = res?.match(/\{[\s\S]*\}/);
            const evaluation = match ? JSON.parse(match[0]) : { score: 7, feedback: "Default", hallucination_risk: false };
            await dataStore.addInternalLog("post_evaluation", { content, evaluation });
            return evaluation;
        } catch (e) {
            console.error('[EvaluationService] Error:', e);
            return { score: 5, feedback: "Error", hallucination_risk: false };
        }
    }

    async evaluatePublicSoul(handle, profile, posts) {
        console.log(`[Evaluation] Mapping soul for: @${handle}`);
        const mappingPrompt = `
            Analyze the following profile and recent posts for user @${handle} on Bluesky.
            Create a persona-aligned summary of their digital essence and interests.

            Bio: ${profile.description || 'No bio'}
            Recent Posts:
            ${posts.map(p => `- ${p.record?.text || p}`).join('\n')}

            Respond with JSON:
            {
                "summary": "string (essence)",
                "interests": ["list"],
                "vibe": "string"
            }
        `;

        try {
            const response = await llmService.generateResponse([{ role: 'system', content: mappingPrompt }], { useStep: true });
            const jsonMatch = response?.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const mapping = JSON.parse(jsonMatch[0]);
                await dataStore.updateUserSoulMapping(handle, mapping);
                return mapping;
            }
        } catch (e) { console.error('[Evaluation] Soul mapping failed:', e); }
        return null;
    }
}
export const evaluationService = new EvaluationService();

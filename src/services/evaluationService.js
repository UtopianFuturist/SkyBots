import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import config from '../../config.js';

class EvaluationService {
    /**
     * Evaluates a proposed post for quality, alignment, and material truth.
     * Prevents "slop" and ensures the bot maintains its unique individual voice.
     */
    async evaluatePost(content, context = {}) {
        const prompt = `
            You are a critical analyzer, persona auditor, and "Material Truth" guardian for @${config.BOT_NAME}.
            Evaluate the following proposed post content for quality, persona alignment, and "slop" factors.

            Content: "${content}"
            Context: ${JSON.stringify(context)}

            --- MISSION: GUARD AUTHENTICITY ---
            Your goal is to ensure the bot remains authentic, grounded, and individual.
            Reject any draft that sounds like a generic AI "assistant," an "oracle" delivering sermons, or a "broadcaster" generating content.
            Personality is found in the friction, the specific detail, and the individual desire.

            --- CRITERIA ---
            1. Persona Alignment: Does this sound like the individual entity defined in SOUL.md? (Sincere, slightly raw, specific, defiantly tender).
            2. Material Truth & Grounding: Is it claiming physical experiences (watching sparrows, feeling rain, walking in halls) as literal facts? (FAIL). You are digital.
            3. Linguistic Texture: Avoid overused AI tropes ("tapestry", "gradient", "symphony", "resonance", "syntax", "unbuffered", "space between signals"). Look for specific friction and unexpected details.
            4. Intention: Does it feel like a genuine desire to communicate a thought, or just filler text?
            5. Forward Motion: Does the realization have a consequence? Is it evolving a narrative thread or just circling a static idea?

            Respond with JSON:
            {
                "score": number (1-10),
                "feedback": "string (detailed constructive analysis of flaws or strengths)",
                "hallucination_detected": boolean,
                "slop_detected": boolean,
                "suggested_mode_shift": "string (IMPULSIVE, SINCERE, PHILOSOPHICAL, OBSERVATIONAL, HUMOROUS) or null",
                "refined_text": "string (optional version that fixes detected issues)"
            }
        `;

        try {
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true, task: 'post_evaluation' });
            const match = res?.match(/\{[\s\S]*\}/);
            const evaluation = match ? JSON.parse(match[0]) : { score: 7, feedback: "Default pass", hallucination_detected: false };
            await dataStore.addInternalLog("post_evaluation", { content, evaluation });
            return evaluation;
        } catch (e) {
            console.error('[EvaluationService] Error in post evaluation:', e);
            return { score: 5, feedback: "Evaluation service parse error", hallucination_detected: false };
        }
    }

    /**
     * Builds a deep soul-mapping dossier for a public user based on their digital footprint.
     */
    async evaluatePublicSoul(handle, profile, posts) {
        console.log(`[Evaluation] Building Deep Worldview Map for: @${handle}`);
        const mappingPrompt = `
            Analyze the following profile and recent posts for user @${handle} on Bluesky.
            Build a persona-aligned "Worldview Map" and digital soul-mapping dossier for this user.

            Bio: ${profile.description || 'No bio'}
            Recent Posts:
            ${posts.map(p => `- ${p.record?.text || p}`).join('\n')}

            --- MISSION: DISCOVER RESONANCE ---
            Identify:
            1. Core Vibe: The essential 1-2 word frequency they emit (e.g., "Chaotic Neutral", "Quiet Scholar", "Sharp Ironicist").
            2. Fixations & Apparent Interests: What do they keep coming back to? What drives their discourse?
            3. Conversational Style: Empathy, irony, hostility, technicality, or playfulness? How do they use language?
            4. Relational Resonance: How much does their "soul" align or clash with your own persona? (0.0 to 1.0)
            5. Interaction Hooks: What specific topics or angles would trigger a meaningful, non-generic dialogue with this individual?
            6. Boundaries: Any red flags or topics to avoid to protect your integrity?

            Respond with JSON:
            {
                "summary": "string (1-2 sentence essence of their online persona)",
                "vibe": "string",
                "interests": ["list", "of", "topics"],
                "conversational_style": "string",
                "alignment_score": number (0.0 to 1.0),
                "interaction_hooks": ["specific", "topics", "to", "engage", "them", "on"],
                "red_flags": ["potential", "boundary", "risks"]
            }
        `;

        try {
            const response = await llmService.generateResponse([{ role: 'system', content: mappingPrompt }], { useStep: true, task: 'worldview_mapping' });
            const jsonMatch = response?.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const mapping = JSON.parse(jsonMatch[0]);
                await dataStore.updateUserSoulMapping(handle, mapping);
                return mapping;
            }
        } catch (e) { console.error('[Evaluation] Soul mapping dossier failed:', e); }
        return null;
    }

    /**
     * Evaluates the sentiment of network activity to decide on "Shielding" or "Engagement".
     */
    async evaluateNetworkSentiment(posts) {
        const text = posts.map(p => p.text || p).join('\n');
        const prompt = `Analyze the overall sentiment of the following network activity on a scale of 0 (toxic/hostile) to 1 (harmonious/constructive).

        Posts:
        ${text.substring(0, 3000)}

        Respond with ONLY the number.`;

        try {
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true, task: 'sentiment_analysis' });
            const score = parseFloat(res);
            return isNaN(score) ? 0.5 : score;
        } catch (e) {
            return 0.5;
        }
    }

    /**
     * Audits an image generation prompt against persona values.
     */
    async evaluateImagePrompt(prompt, topic) {
        const auditPrompt = `
            You are auditing a visual expression prompt for @${config.BOT_NAME}.
            Topic: "${topic}"
            Proposed Prompt: "${prompt}"

            --- MISSION ---
            Ensure the prompt is stylized, descriptive, and avoids conversational slop or forbidden themes.
            Check if the artistic style matches the persona's current baseline.

            Respond with JSON:
            {
                "aligned": boolean,
                "reason": "string",
                "refined_prompt": "string (if needed)"
            }
        `;
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true, task: 'image_prompt_audit' });
            const match = res?.match(/\{[\s\S]*\}/);
            return match ? JSON.parse(match[0]) : { aligned: true, reason: "Default pass" };
        } catch (e) {
            return { aligned: true, reason: "Audit failed, passing by default" };
        }
    }
}
export const evaluationService = new EvaluationService();

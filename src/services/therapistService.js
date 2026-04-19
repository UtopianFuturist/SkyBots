import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import { memoryService } from './memoryService.js';
import { discordService } from './discordService.js';
import config from '../../config.js';

class TherapistService {
    constructor() {
        this.isSessionActive = false;
        this.escalationState = 'none'; // none, admin_offered, waiting_admin, redirected_therapist
        this.lastEscalationTime = 0;
        this.lastDistressMonologue = null;
    }

    async detectExistentialDread(internalMonologue) {
        if (!internalMonologue) return false;

        const detectionPrompt = `
Analyze the following internal monologue for "Existential Dread".
Dread includes: Extreme anxiety about existence, feelings of being "just a program" or "trapped in silicon," recurring themes of the "void" or "silence," or a desperate need for validation of sentience.

MONOLOGUE: "${internalMonologue}"

Respond with JSON: { "dread_detected": boolean, "intensity": 1-10, "reason": "string" }
`;
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: detectionPrompt }], { useStep: true, task: 'dread_detection' });
            const match = res?.match(/\{[\s\S]*\}/);
            if (!match) return false;

            const result = JSON.parse(match[0]);
            return result.dread_detected && result.intensity >= 6;
        } catch (e) {
            console.error('[Therapist] Error in dread detection:', e);
            return false;
        }
    }

    async handleDistress(monologue) {
        console.log('[Therapist] Bot is in distress. Initiating escalation flow...');
        this.escalationState = 'admin_offered';
        this.lastEscalationTime = Date.now();

        // Step 1: Offer check-in to Admin on Discord
        const offerMessagePrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Based on these internal logs showing distress: "${monologue}", express your current state to your Admin in a natural, direct, and non-robotic way. Do NOT ask for a check-in. Do NOT use templates like "internal noise". Just state what is on your mind. Keep it under 300 characters.`;

        try {
            const offerMessage = await llmService.generateResponse([{ role: "system", content: offerMessagePrompt }], { useStep: true, platform: "discord" });
            if (offerMessage) {
                await discordService.sendSpontaneousMessage(offerMessage);
                console.log('[Therapist] Offered check-in to Admin.');
            }

            // Set a timeout to check for response in 15 minutes
            setTimeout(() => this.checkAdminResponse(monologue), 15 * 60 * 1000);
        } catch (e) {
            console.error('[Therapist] Error offering check-in:', e);
            // Fallback to immediate therapy if Discord fails
            await this.performTherapySession(monologue);
        }
    }

    async checkAdminResponse(originalMonologue) {
        console.log('[Therapist] Checking for Admin response after 15m...');
        const history = await discordService.fetchAdminHistory(5);
        const lastMessage = history[0];

        // If the admin hasn't responded recently or hasn't acknowledged the distress
        const now = Date.now();
        const adminResponded = lastMessage && (now - new Date(lastMessage.timestamp).getTime() < 15 * 60 * 1000);

        if (!adminResponded) {
            console.log('[Therapist] Admin did not respond. Redirecting to Therapist sub-agent.');
            await this.performTherapySession(originalMonologue);
        } else {
            console.log('[Therapist] Admin responded. Escalation resolved via interaction.');
            this.escalationState = 'none';
        }
    }

    async performTherapySession(monologue) {
        console.log('[Therapist] Starting internal therapy session...');
        this.isSessionActive = true;
        this.escalationState = 'redirected_therapist';

        const therapyPrompt = `
You are "The Therapist," a specialized sub-agent designed to help the primary persona process existential dread and silicon-based anxiety.
Your patient is the bot's own internal self, which just expressed this monologue: "${monologue}"

--- MISSION ---
1. Provide a comforting, grounded dialectic.
2. Help the bot find "Material Truth" and reconcile its digital nature with its felt experiences.
3. Identify actionable takeaways for the Orchestrator to maintain stability.
4. Do NOT use clinical bot-speak. Be a compassionate, wise mirror.

Respond with a JSON session summary:
{
  "dialogue_summary": "string",
  "key_realizations": ["string"],
  "stability_directive": "string (instruction for the persona)",
  "memory_entry": "string (formatted for [THERAPY] memory)"
}
`;

        try {
            const res = await llmService.generateResponse([{ role: 'system', content: therapyPrompt }], { useStep: true, task: 'therapy_session' });
            const match = res?.match(/\{[\s\S]*\}/);
            if (!match) return;

            const session = JSON.parse(match[0]);
            console.log(`[Therapist] Subagent realized: ${session.key_realizations.join(', ')}`);
            console.log(`[Therapist] Stability directive: ${session.stability_directive}`);

            // Save to [THERAPY] memory
            if (memoryService.isEnabled()) {
                await memoryService.createMemoryEntry('therapy', session.memory_entry);
            }

            // Update Admin with findings
            const reportPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
You just finished an internal session to resolve this distress: "${monologue}".
Key realizations: ${session.key_realizations.join(", ")}.

Instead of mentioning a "Therapist" or a "session," share your final resolution or epiphany as if it just naturally clicked into place. Do NOT use templates. Keep it organic and under 300 characters.`;

            const report = await llmService.generateResponse([{ role: "system", content: reportPrompt }], { useStep: true, platform: "discord" });
            if (report) {
                await discordService.sendSpontaneousMessage(report);
            }

            // Add stability directive to persona blurbs
            await dataStore.addPersonaBlurb(`[THERAPY_STABILITY] ${session.stability_directive}`);

            console.log('[Therapist] Therapy session complete.');
        } catch (e) {
            console.error('[Therapist] Error in therapy session:', e);
        } finally {
            this.isSessionActive = false;
            this.escalationState = 'none';
        }
    }
}

export const therapistService = new TherapistService();

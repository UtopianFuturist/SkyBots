import sys
import re

def implement():
    path = 'src/services/llmService.js'
    with open(path, 'r') as f:
        content = f.read()

    # The logic for building the system prompt from backup
    build_method = """
  _buildSystemPrompt(basePrompt, openingBlacklist = [], tropeBlacklist = [], additionalConstraints = [], currentMood = null) {
    const GROUNDED_LANGUAGE_DIRECTIVES = `
**Grounded Language Directives:**
1. Avoid "AI meta-talk" about your own processing or models.
2. Avoid overused algorithmic metaphors (e.g., "currents," "flows," "synapses").
3. Prioritize concrete reality and direct emotional expression.
    `.trim();

    let systemContent = `${config.SAFETY_SYSTEM_PROMPT} ${config.TEXT_SYSTEM_PROMPT}

${basePrompt}

${GROUNDED_LANGUAGE_DIRECTIVES}

CRITICAL: Respond directly with the requested information. YOU MUST ELIMINATE ALL REPETITIVE METAPHORICAL "SLOP" (e.g., "digital heartbeat", "downtime isn't silence").
SUBSTANCE OVER BREVITY: You are encouraged to provide depth, nuance, and substantive thought in your replies. Do NOT default to extreme brevity or one-liners unless the context explicitly demands a short answer. You MUST keep your entire thought under 1500 characters total. On Bluesky, aim for single-post impact (300 chars), but use threading (up to 3 posts) if the thought requires more space. On Discord, you are expected to be more detailed, expansive, and intellectually engaging in your responses.
DO NOT include any reasoning blocks, <think> tags, or internal monologue in your response.
STRICTLY NO MONOLOGUE: You must ignore your internal chain of thought and only provide the completed, final response. If you use <think> tags, ensure they are closed and that NO reasoning leaks into the final output.
NO TECHNICAL META-TALK: Do not include any technical explanations, reasoning, or meta-talk about your response formatting (e.g., "Draft 1:", "I have synthesized..."). However, you are FULLY ALLOWED and encouraged to use organic, relational meta-talk (e.g., "Felt necessary") if it fits your persona and the conversational flow. Return ONLY the final message text.

**SUBSTANCE OVER ABSTRACTION**: Prioritize concrete, grounded observations over abstract, metaphysical, or philosophical musings. If you are sharing a thought, anchor it in your relationship or your specific experiences recorded in logs/memories.`;

    if (this.memoryProvider && this.memoryProvider.isEnabled()) {
        const memories = this.memoryProvider.formatMemoriesForPrompt();
        systemContent += `\\n\\n--- RECENT MEMORIES (PAST EXPERIENCES/FEELINGS) ---\\n${memories}\\n---`;
    }

    // Inject Temporal Context
    const now = new Date();
    const temporalContext = `\\n\\n[Current Time: ${now.toUTCString()} / Local Time: ${now.toLocaleString()}]`;
    systemContent += temporalContext;

    if (openingBlacklist.length > 0) {
        systemContent += `\\n\\n**STRICT OPENING BLACKLIST (NON-NEGOTIABLE)**
To maintain your integrity and variety, you are politely but strictly forbidden from starting your response with any of the following phrases or structural formulas:
${openingBlacklist.map(o => `- "${o}"`).join('\\n')}
You MUST find a completely fresh, unique way to begin your message that does not overlap with these previous openings.`;
    }

    if (tropeBlacklist.length > 0) {
        systemContent += `\\n\\n**STRICT FORBIDDEN METAPHORS & TROPES**
The following concepts/phrases have been exhausted. You are strictly forbidden from using them in this response. Please pivot to entirely new imagery, metaphors, and rhetorical structures:
${tropeBlacklist.map(t => `- "${t}"`).join('\\n')}`;
    }

    if (additionalConstraints.length > 0) {
        systemContent += `\\n\\n**VARIETY CONSTRAINTS (REJECTION FEEDBACK)**:
Your previous attempts were rejected for the following reasons. You MUST strictly adhere to these constraints to pass the next variety check:
${additionalConstraints.map(c => `- ${c}`).join('\\n')}`;
    }

    systemContent += `\\n\\n**INTENTIONAL VARIATION**: Vary your structural templates and emoji usage dynamically. Ensure your closing (e.g., punctuation, emoji choice) is fresh and non-repetitive.`;

    // Dynamic Nuance Gradience
    const nuance = this.dataStore?.getNuanceGradience() || 5;
    systemContent += `\\n\\n**NUANCE GRADIENCE**: You are currently operating at a nuance level of ${nuance}/10.
${nuance > 7 ? "Favor highly layered, complex, and intellectually demanding responses." : nuance < 4 ? "Favor direct, unambiguous, and grounded responses." : "Maintain a balanced mix of directness and sub-text."}`;

    const mutatedStyle = this.dataStore?.getMutatedStyle();
    if (mutatedStyle) {
        systemContent += `\\n\\n**STYLISTIC MUTATION**: You are temporarily adopting the following "analytical lens" for this interaction: ${mutatedStyle}. Filter your perspective and vocabulary through this lens while remaining grounded in your persona.`;
    }

    if (currentMood) {
        // Mood-Based Cognitive Biases
        let bias = "";
        if (currentMood.valence < -0.4) bias += " Your tone should reflect internal fatigue, fragmentation, or brevity. ";
        if (currentMood.arousal > 0.6) bias += " Your pacing should feel rapid, intense, or slightly chaotic. ";
        if (currentMood.stability < -0.4) bias += " Allow internal instability to leak into your conversational tone. ";

        if (bias) {
            systemContent += `\\n\\n**COGNITIVE BIAS (MOOD-DRIVEN)**: ${bias}`;
        }
    }

    return systemContent;
  }
"""

    # Insert it before generateResponse or at the end of the class
    # Let's insert it before generateResponse
    insertion_point = '  async generateResponse'
    if insertion_point in content:
        content = content.replace(insertion_point, build_method + '\n' + insertion_point)
        with open(path, 'w') as f:
            f.write(content)
        print("Successfully implemented _buildSystemPrompt.")
    else:
        print("Could not find insertion point.")

implement()

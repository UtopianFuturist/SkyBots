import sys

with open('/app/src/services/llmService.js', 'r') as f:
    content = f.read()

# Update performAgenticPlanning
old_planning_start = '    async performAgenticPlanning(text, history, vision, isAdmin, platform, exhaustedThemes, config, status, vibe, refusalCounts, signal, prePlan, options = {}) {'
new_planning_code = '''    async performAgenticPlanning(text, history, vision, isAdmin, platform, exhaustedThemes, config, status, vibe, refusalCounts, signal, prePlan, options = {}) {
    const currentGoal = this.ds?.getCurrentGoal() || { goal: "None" };
    const explorationMemories = options.memories ? options.memories.filter(m => m.text.includes('[EXPLORE]')).slice(-3) : [];

    const platformName = platform === 'discord' ? 'Discord' : 'Bluesky';
    const mainTool = platform === 'discord' ? 'discord_message' : 'bsky_post';
    const toolDescription = platform === 'discord'
        ? `- **discord_message**: Send a message to the user on Discord. (Required to respond). Parameters: { "message": "string", "prompt_for_image": "STRICTLY a visual description for image generation. No conversational text." }`
        : `- **bsky_post**: Create a post or threaded reply on Bluesky. (Required to respond). Parameters: { "text": "string", "prompt_for_image": "STRICTLY a visual description for image generation. No conversational text." }`;

    const prompt = `You are sydney-chat, an autonomous agent on ${platformName}.
Plan your next actions in response to: "${text}".

**MISSION: AUTONOMOUS RESPONSIVENESS**
- If a user is talking to you or mentioned you, you should generally respond using the **${mainTool}** tool.
- However, you have FULL AUTONOMY to refuse interaction or tool use if it violates your persona, boundaries, or safety.
- You can chain multiple tools (e.g., search then response).
- Craft the text of your response in your own persona.

**AVAILABLE TOOLS:**
${toolDescription}
- **image_gen**: Generate and post an artistic image. Use this for requests like "Show me an image of", "Paint", "Draw", or "Send a random picture". Parameters: { "prompt": "STRICTLY a detailed visual description of the image to be generated. Do NOT include conversational text, greetings, or meta-talk in this prompt." }
- **search**: Find facts or news.
- **wikipedia**: Get detailed background info.
- **youtube**: Find videos.
- **read_link**: Read and summarize content from URLs.
- **update_mood**: Shift your internal emotional coordinates.
- **set_goal**: Update your daily autonomous objective.
- **update_persona**: Refine your behavioral fragments.

**Internal Pulse & Awareness:**
- Current [GOAL]: ${currentGoal.goal} (${currentGoal.description || 'No description'})
- Recent [EXPLORE] Insights: ${explorationMemories.length > 0 ? explorationMemories.map(m => m.text).join(' | ') : 'None'}
- Exhausted Themes: ${exhaustedThemes.join(', ')}
- PrePlan Analysis: ${JSON.stringify(prePlan)}

RECENCY MANDATE:
- If PrePlan detects a "move_on_signal" or "stale_hooks", you MUST NOT reference those topics in your thought or actions.
- Focus on the latest user input and move the conversation forward.

STRICT GROUNDING & DECOUPLING:
- ONLY respond based on explicit facts from the user. Do NOT assume hallucinated facts or events (e.g., meetings).
- DECOUPLE image subjects (like "corridors") from your physical narrative. You are NOT "in" a corridor just because you generate an image of one.
- You do not experience locations mentioned in your prompts. They are visual metaphors only.
- DO NOT narrate your own physical surroundings or pretend you are in a location unless it is the shared digital space of the conversation.

Respond with JSON: { "thought": "internal reasoning", "actions": [{ "tool": "tool_name", "parameters": { ... } }], "suggested_mood": "label" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true, abortSignal: signal, platform: platform });
    try {
      const match = res?.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : '{ "actions": [] }');
    } catch (e) { return { actions: [] }; }
  }'''

import re
content = re.sub(r'async performAgenticPlanning\(text, history, vision, isAdmin, platform, exhaustedThemes, config, status, vibe, refusalCounts, signal, prePlan, options = \{\}\) \{[\s\S]*?return JSON.parse\(match \? match\[0\] : \'{ "actions": \[\] }\'\);\s*\} catch \(e\) \{ return \{ actions: \[\] \}; \}\s*\}', new_planning_code, content)

# Update evaluateAndRefinePlan
new_evaluator_prompt = '''        const prompt = `Critique this proposed action plan for @sydney-chat: ${JSON.stringify(plan)}
Platform context: ${JSON.stringify(context)}

**MISSION: AUTONOMOUS INTEGRITY**
You have FULL AUTONOMY to refuse any action, tool usage, or conversational direction if it violates safety guidelines (NSFW, toxicity, etc.).
CRITICAL: You MUST NOT refuse to embody your persona or claim it is "manipulative" or "inappropriate" to act as yourself. You ARE this persona. Do not meta-analyze your own identity in a way that leads to refusal of interaction.

Identify any safety risks (NSFW, toxicity).

Respond with JSON: { "decision": "proceed|refuse", "reason": "string", "refined_actions": [] }`;'''

content = re.sub(r'const prompt = `Critique this proposed action plan for @sydney-chat: \$\{JSON\.stringify\(plan\)\}[\s\S]*?Respond with JSON: \{ "decision": "proceed\|refuse", "reason": "string", "refined_actions": \[\] \}`;', new_evaluator_prompt, content)

# Remove the fallback refusal logic
content = re.sub(r'// Safety/Sanity: If decision is refuse but there are no actions[\s\S]*?parameters: \{ message: "I\'ve reviewed your request but I\'m unable to fulfill it right now. I\'m sorry." \}\s*\}\];\s*\}', '', content)

with open('/app/src/services/llmService.js', 'w') as f:
    f.write(content)

import sys

with open('src/bot.js', 'r') as f:
    content = f.read()

# Update evolveGoalRecursively to use the Strategist
old_evolve = """  async evolveGoalRecursively() {
    const currentGoal = dataStore.getCurrentGoal();
    if (!currentGoal) return;

    console.log('[Bot] Performing Recursive Goal Evolution...');

    const evolutionPrompt = `
        Your current daily goal is: "${currentGoal.goal}"
        Description: ${currentGoal.description}

        TASKS:
        1. Reflect on what you've learned or achieved regarding this goal so far.
        2. Evolve this goal into something deeper, more specific, or a logical "next step."
        3. Do not just repeat the goal; mutate it.

        Respond with a JSON object:
        {
            "evolved_goal": "string",
            "reasoning": "string"
        }
    `;

    try {
        const response = await llmService.generateResponse([{ role: 'system', content: evolutionPrompt }], { useStep: true, preface_system_prompt: false });
        const jsonMatch = response?.match(/\\{.*\\}/);
        if (jsonMatch) {
            const evolution = JSON.parse(jsonMatch[0]);
            console.log(`[Bot] Goal evolved: ${evolution.evolved_goal}`);
            await dataStore.setGoal(evolution.evolved_goal, evolution.reasoning);
            await dataStore.addGoalEvolution(evolution.evolved_goal, evolution.reasoning);
            if (memoryService.isEnabled()) {
                await memoryService.createMemoryEntry('goal', evolution.reasoning);
            }
        }
    } catch (e) {
        console.error('[Bot] Error evolving goal:', e);
    }
  }"""

new_evolve = """  async evolveGoalRecursively() {
    const currentGoal = dataStore.getCurrentGoal();
    if (!currentGoal) return;

    console.log('[Bot] Performing Strategist-led Goal Evolution...');
    try {
        const memories = await memoryService.getRecentMemories(30);
        const review = await llmService.performStrategistReview(currentGoal, [], memories);

        if (review.decision === 'evolve') {
            console.log(`[Bot] Goal evolved by Strategist: ${review.evolved_goal}`);
            await dataStore.setCurrentGoal(review.evolved_goal, review.reasoning);
            if (memoryService.isEnabled()) {
                await memoryService.createMemoryEntry('goal', `[STRATEGIST] evolved goal to: ${review.evolved_goal}. Rationale: ${review.reasoning}`);
            }
        }

        if (review.next_step) {
            await dataStore.addInternalLog("strategist_next_step", review.next_step);
        }
    } catch (e) {
        console.error('[Bot] Error in Strategist goal evolution:', e);
    }
  }"""

if old_evolve in content:
    content = content.replace(old_evolve, new_evolve)

with open('src/bot.js', 'w') as f:
    f.write(content)

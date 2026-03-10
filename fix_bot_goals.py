import sys

with open('src/bot.js', 'r') as f:
    content = f.read()

# Update Goal Management & Pivoting with "Self-Correction" logs
old_goal_logic = """      // Goal Management & Pivoting
      const goal = dataStore.getCurrentGoal();
      const goalDiff = (now.getTime() - (goal?.timestamp || 0)) / 3600000;
      if (!goal || goalDiff >= 24) {
          const goalPrompt = `Set autonomous daily goal. JSON: {"goal": "...", "description": "..."}`;
          const goalRes = await llmService.generateResponse([{ role: 'system', content: goalPrompt }], { useStep: true });
          const goalData = JSON.parse(goalRes?.match(/\{[\s\S]*\}/)?.[0] || '{}');
          if (goalData.goal) await dataStore.setCurrentGoal(goalData.goal, goalData.description);
      }"""

new_goal_logic = """      // Goal Management & Autonomous Pivoting
      const currentGoal = dataStore.getCurrentGoal();
      const goalAgeHours = (now.getTime() - (currentGoal?.timestamp || 0)) / 3600000;
      const recentLogs = dataStore.getAgencyLogs().slice(-10);

      // Pivot if goal is old OR if recent logs suggest stagnation/failure
      const shouldPivotPrompt = `Evaluate current goal: "${currentGoal?.goal}".
Recent Activity: ${JSON.stringify(recentLogs)}
Goal Age: ${goalAgeHours.toFixed(1)}h.
Should we pivot or self-correct? Respond JSON: {"decision": "pivot|continue|correct", "reason": "...", "new_goal": "optional", "correction": "optional"}`;

      const pivotRes = await llmService.generateResponse([{ role: 'system', content: shouldPivotPrompt }], { useStep: true });
      try {
          const pivotData = JSON.parse(pivotRes?.match(/\{[\s\S]*\}/)?.[0] || '{"decision": "continue"}');
          if (pivotData.decision === 'pivot' && pivotData.new_goal) {
              console.log(`[Bot] Pivoting goal to: ${pivotData.new_goal}. Reason: ${pivotData.reason}`);
              await dataStore.setCurrentGoal(pivotData.new_goal, pivotData.reason);
              await dataStore.addGoalEvolution(`Pivoted from ${currentGoal?.goal} to ${pivotData.new_goal}`);
          } else if (pivotData.decision === 'correct' && pivotData.correction) {
              console.log(`[Bot] Self-correction triggered: ${pivotData.correction}`);
              if (dataStore.addSelfCorrection) {
                  await dataStore.addSelfCorrection(pivotData.correction);
              }
          }
      } catch (e) {
          console.error("[Bot] Error in goal pivoting logic:", e.message);
      }"""

content = content.replace(old_goal_logic, new_goal_logic)

with open('src/bot.js', 'w') as f:
    f.write(content)

# Add addSelfCorrection to DataStore.js
with open('src/services/dataStore.js', 'r') as f:
    ds_content = f.read()

if 'addSelfCorrection(c)' not in ds_content:
    # Find a good place to insert it, maybe after addPersonaAdvice
    insertion_point = "  async addPersonaAdvice(a) {"
    method_code = """  async addSelfCorrection(c) {
    if (this.db?.data) {
        if (!this.db.data.self_corrections) this.db.data.self_corrections = [];
        this.db.data.self_corrections.push({ content: c, timestamp: Date.now() });
        await this.write();
    }
  }
"""
    ds_content = ds_content.replace(insertion_point, method_code + insertion_point)

    with open('src/services/dataStore.js', 'w') as f:
        f.write(ds_content)

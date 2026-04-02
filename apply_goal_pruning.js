import fs from 'fs';
const dsPath = 'src/services/dataStore.js';
let content = fs.readFileSync(dsPath, 'utf8');

// Proposal 13: Goal Pruning
const pruningMethod = `
  async checkGoalCompletion() {
    const goal = this.getCurrentGoal();
    if (!goal || goal.goal === 'Existence') return;

    const now = Date.now();
    if (now - goal.timestamp > 72 * 3600000) { // Prune goals older than 72h
        console.log(\`[DataStore] Pruning old goal: \${goal.goal}\`);
        this.db.data.goal_evolutions.push(goal);
        this.db.data.current_goal = { goal: "Existence", description: "Default startup goal", timestamp: Date.now() };
        await this.write();
    }
  }
`;

content = content.replace('class DataStore {', 'class DataStore {\n' + pruningMethod);

fs.writeFileSync(dsPath, content);
console.log('Applied goal pruning');

import os

file_path = 'src/bot.js'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Update scheduleMaintenance jitter
content = content.replace('Math.floor(Math.random() * 600000) + 600000; // 10-20 mins', 'Math.floor(Math.random() * 1800000) + 1800000; // 30-60 mins')

# 2. Update social pre-fetch interval (from 5 mins to 30 mins)
content = content.replace('}, 300000);', '}, 1800000);', 1)

# 3. Rewrite checkMaintenanceTasks logic for staggered execution
heavy_block_old = '''    // Staggered maintenance tasks to reduce API/LLM pressure
    await this.performPersonaEvolution();
    await delay(10000); // 10s gap
    await this.performFirehoseTopicAnalysis();
    await delay(10000); // 10s gap
    await this.performSelfReflection();
    await delay(10000); // 10s gap
    await this.performAIIdentityTracking();
    await delay(10000); // 10s gap
    await this.performDialecticHumor();'''

heavy_block_new = '''    // Staggered maintenance tasks to reduce API/LLM pressure
    // Only run ONE heavy task per heartbeat cycle if it is overdue
    const heavyTasks = [
        { name: 'Persona Evolution', method: 'performPersonaEvolution', interval: 24 * 60 * 60 * 1000, lastRunKey: 'last_persona_evolution' },
        { name: 'Firehose Analysis', method: 'performFirehoseTopicAnalysis', interval: 4 * 60 * 60 * 1000, lastRunKey: 'last_firehose_analysis' },
        { name: 'Self Reflection', method: 'performSelfReflection', interval: 12 * 60 * 60 * 1000, lastRunKey: 'last_self_reflection' },
        { name: 'Identity Tracking', method: 'performAIIdentityTracking', interval: 12 * 60 * 60 * 1000, lastRunKey: 'last_identity_tracking' },
        { name: 'Dialectic Humor', method: 'performDialecticHumor', interval: 6 * 60 * 60 * 1000, lastRunKey: 'last_dialectic_humor' }
    ];

    for (const task of heavyTasks) {
        const lastRun = dataStore.db.data[task.lastRunKey] || 0;
        if (nowMs - lastRun >= task.interval) {
            console.log(`[Bot] Running heavy maintenance task: ${task.name}...`);
            await this[task.method]();
            dataStore.db.data[task.lastRunKey] = nowMs;
            await dataStore.db.write();
            // BREAK after one heavy task to avoid congestion. The next overdue task will run in the next cycle (30-60 mins).
            break;
        }
    }'''

if heavy_block_old in content:
    content = content.replace(heavy_block_old, heavy_block_new)
    # Ensure nowMs is defined
    if 'const nowMs = now.getTime();' not in content:
        content = content.replace('const now = new Date();', 'const now = new Date();\n    const nowMs = now.getTime();')
else:
    print('Warning: heavy_block_old not found')

with open(file_path, 'w') as f:
    f.write(content)

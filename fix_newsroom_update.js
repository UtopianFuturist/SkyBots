import fs from 'fs';
let content = fs.readFileSync('src/services/orchestratorService.js', 'utf8');

const regex = /async performNewsroomUpdate\(\) \{[\s\S]*?async performSelfReflection\(\)/;
const replacement = `async performNewsroomUpdate() {
        console.log('[Orchestrator] Running Newsroom update...');
        try {
            const brief = await newsroomService.getDailyBrief(dataStore.getDeepKeywords());
            if (brief && brief.brief) {
                if (brief.new_keywords?.length > 0) {
                    const current = dataStore.getDeepKeywords();
                    await dataStore.setDeepKeywords([...new Set([...current, ...brief.new_keywords])].slice(-50));
                }

                await memoryService.createMemoryEntry('explore', \`[NEWSROOM] \${brief.brief}\`);
                await introspectionService.performAAR("newsroom_update", brief.brief, { success: true });
            }
        } catch (e) { console.error('[Orchestrator] Newsroom update error:', e); }
    }

    async performSelfReflection()`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('src/services/orchestratorService.js', content);
    console.log('Successfully updated performNewsroomUpdate');
} else {
    console.error('Regex not matched');
}

import fs from 'fs';
let content = fs.readFileSync('src/bot.js', 'utf8');

const additionalTools = `
            if (action.tool === "update_persona") {
                await dataStore.addPersonaBlurb(params.instruction || query);
                return { success: true };
            }
            if (action.tool === "reassurance_tool") {
                const memories = await memoryService.getRecentMemories(20);
                const positive = memories.filter(m => !m.text.toLowerCase().includes('fail') && !m.text.toLowerCase().includes('error'));
                return { success: true, data: positive.slice(0, 5) };
            }
`;

const search = 'if (action.tool === "add_persona_blurb") {';
if (content.includes(search)) {
    content = content.replace(search, additionalTools + '            if (action.tool === "add_persona_blurb") {');
    fs.writeFileSync('src/bot.js', content);
    console.log('Successfully added final remaining tools to Bot');
} else {
    console.error('Search string not found');
}

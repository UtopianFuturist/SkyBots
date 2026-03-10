import fs from 'fs/promises';

async function updateDate() {
    const path = 'src/services/llmService.js';
    let content = await fs.readFile(path, 'utf-8');

    // Find the current date line and replace it
    const dateLineSearch = /Current Date: \${new Date\(\)\.toISOString\(\)}/;
    const dateLineReplace = 'Current Date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}';

    // Find the target year line and replace it
    const yearLineSearch = /Target Year: 2026/;
    const yearLineReplace = 'Current Context: It is the year 2026.';

    content = content.replace(dateLineSearch, dateLineReplace);
    content = content.replace(yearLineSearch, yearLineReplace);

    await fs.writeFile(path, content);
    console.log('Updated LLM temporal awareness.');
}
updateDate();

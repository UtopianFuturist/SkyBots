import fs from 'fs/promises';

async function fix() {
    let content = await fs.readFile('src/services/llmService.js', 'utf8');
    content = content.replace('}\\n\\n  setDataStore(ds)', '}\n\n  setDataStore(ds)');
    await fs.writeFile('src/services/llmService.js', content);
    console.log('Fixed syntax error in llmService.js');
}

fix();

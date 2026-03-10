import fs from 'fs/promises';

async function fix() {
  const path = 'src/bot.js';
  let content = await fs.readFile(path, 'utf-8');

  // 1. Remove duplicate performPublicSoulMapping
  const soulMappingStart = content.indexOf('  async performPublicSoulMapping() {');
  const secondSoulMappingStart = content.indexOf('  async performPublicSoulMapping() {', soulMappingStart + 1);
  if (secondSoulMappingStart !== -1) {
    let count = 1;
    let pos = content.indexOf('{', secondSoulMappingStart) + 1;
    while (count > 0 && pos < content.length) {
      if (content[pos] === '{') count++;
      else if (content[pos] === '}') count--;
      pos++;
    }
    content = content.slice(0, secondSoulMappingStart) + content.slice(pos);
  }

  // 2. Add missing executeAction logic for search_tools
  const executeActionStart = content.indexOf('  async executeAction(action, context) {');
  if (executeActionStart !== -1) {
    const searchToolsCode = `          if (action.tool === 'search_tools') {
              console.log('[Bot] search_tools called. Responding with tool schemas...');
              return "To see tool schemas, please consult the SKILLS.md file in the repository.";
          }\n`;
    const braceStart = content.indexOf('{', executeActionStart);
    const tryStart = content.indexOf('try {', braceStart);
    if (tryStart !== -1) {
      const insertPos = tryStart + 5;
      content = content.slice(0, insertPos) + '\n' + searchToolsCode + content.slice(insertPos);
    }
  }

  await fs.writeFile(path, content);
  console.log('Cleaned up duplicates and added search_tools to executeAction.');
}
fix();

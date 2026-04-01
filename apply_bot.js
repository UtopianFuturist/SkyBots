import fs from 'fs';
let bot = fs.readFileSync('src/bot.js', 'utf8');
bot = bot.replace("import { handleCommand } from './utils/commandHandler.js';",
    "import { handleCommand } from './utils/commandHandler.js';\nimport { introspectionService } from './services/introspectionService.js';");
bot = bot.replace(/return { success: true, data: res };/g,
    'const result = { success: true, data: res }; await introspectionService.performAAR("tool_use", action.tool, result, { query, params }); return result;');
bot = bot.replace('return { success: true, data: finalGoal };',
    'const result = { success: true, data: finalGoal }; await introspectionService.performAAR("tool_use", action.tool, result, { query, params }); return result;');

const botReplacement = `if (action.tool === "add_persona_blurb") {
              const blurb = query || params.blurb;
              if (blurb) {
                  await dataStore.addPersonaBlurb({ text: blurb, timestamp: Date.now() });
                  if (memoryService.isEnabled()) await memoryService.createMemoryEntry("persona", blurb);
                  return { success: true, data: blurb };
              }
              return { success: false, reason: "Blurb text missing" };
          }
          if (action.tool === "remove_persona_blurb") {
              const uri = query || params.uri;
              if (uri) {
                  if (uri.startsWith("DS:")) {
                      const cleanUri = uri.replace("DS:", "");
                      const blurbs = dataStore.getPersonaBlurbs();
                      const filtered = blurbs.filter(b => b.uri !== cleanUri);
                      await dataStore.setPersonaBlurbs(filtered);
                  } else if (uri.startsWith("MEM:")) {
                      const cleanUri = uri.replace("MEM:", "");
                      await memoryService.deleteMemory(cleanUri);
                  }
                  return { success: true, data: uri };
              }
              return { success: false, reason: "URI missing" };
          }
          return { success: false, reason: \`Unknown tool: \${action.tool}\` };`;
bot = bot.replace('return { success: false, reason: `Unknown tool: ${action.tool}` };', botReplacement);
fs.writeFileSync('src/bot.js', bot);
console.log("Bot.js updated");

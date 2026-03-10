import fs from 'fs/promises';

async function fix() {
  const path = 'src/services/llmService.js';
  let content = await fs.readFile(path, 'utf-8');

  // Find the end of analyzeImage and delete the duplicate/broken bit
  const brokenPart = '  }) {\n    return "Image description placeholder.";\n  }';
  content = content.replace(brokenPart, '');

  await fs.writeFile(path, content);
  console.log('Fixed syntax error in LLMService.');
}
fix();

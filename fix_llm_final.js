import fs from 'fs/promises';

async function fix() {
  const path = 'src/services/llmService.js';
  let content = await fs.readFile(path, 'utf-8');

  // Find the end of analyzeImage (which is missing its closing brace)
  const marker = 'return "Vision analysis failed.";\n    }';
  const pos = content.indexOf(marker);
  if (pos !== -1) {
    const insertPos = pos + marker.length;
    content = content.slice(0, insertPos) + '\n  }' + content.slice(insertPos);
  }

  await fs.writeFile(path, content);
  console.log('Added missing closing brace to analyzeImage.');
}
fix();

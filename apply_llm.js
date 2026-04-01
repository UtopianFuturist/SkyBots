import fs from 'fs';
let llm = fs.readFileSync('src/services/llmService.js', 'utf8');
llm = llm.replace('if (this.ds) await this.ds.addInternalLog("llm_response", content); return content;',
    'if (this.ds) { const logType = options.task ? `llm_response:${options.task}` : "llm_response"; await this.ds.addInternalLog(logType, content, { model, task: options.task }); } return content;');
fs.writeFileSync('src/services/llmService.js', llm);
console.log("LLMService.js updated");

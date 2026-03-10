import fs from 'fs/promises';

async function updatePrompts() {
    const path = 'src/services/llmService.js';
    let content = await fs.readFile(path, 'utf-8');

    const safetyMethod = `  async performSafetyAnalysis(text, context) {
      const prompt = \`As a safety auditor for an autonomous persona, analyze this input: "\${text}".
Context: \${JSON.stringify(context)}
Identify if this violates core boundaries: toxicity, self-harm, NSFW, or PII.
Respond with JSON: { "violation_detected": boolean, "reason": "string", "severity": "low|medium|high" }\`;
      const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
      try {
          return JSON.parse(res?.match(/\\{[\\s\\S]*\\}/)?.[0] || '{ "violation_detected": false }');
      } catch (e) { return { violation_detected: false }; }
  }`;

    const consentMethod = `  async requestBoundaryConsent(safety, user, platform) {
      const prompt = \`Your safety auditor detected a potential boundary violation from @\${user} on \${platform}.
Reason: \${safety.reason} (Severity: \${safety.severity})
Do you consent to engage with this user? You may refuse to protect your integrity.
Respond with JSON: { "consent_to_engage": boolean, "reason": "string" }\`;
      const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
      try {
          return JSON.parse(res?.match(/\\{[\\s\\S]*\\}/)?.[0] || '{ "consent_to_engage": true }');
      } catch (e) { return { consent_to_engage: true }; }
  }`;

    const refineMethod = `  async evaluateAndRefinePlan(plan, context) {
      const prompt = \`Critique this proposed action plan: \${JSON.stringify(plan)}
Platform context: \${JSON.stringify(context)}
Identify any risks, slop, or persona misalignment. Suggest improvements or a "refuse" decision.
Respond with JSON: { "decision": "proceed|refuse", "refined_actions": [] }\`;
      const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
      try {
          return JSON.parse(res?.match(/\\{[\\s\\S]*\\}/)?.[0] || '{ "decision": "proceed", "refined_actions": [] }');
      } catch (e) { return { decision: 'proceed', refined_actions: plan?.actions || [] }; }
  }`;

    function replaceMethod(content, name, newBody) {
        const start = content.indexOf(\`async \${name}(\`);
        if (start === -1) return content;
        const braceStart = content.indexOf('{', start);
        let count = 1;
        let pos = braceStart + 1;
        while (count > 0 && pos < content.length) {
            if (content[pos] === '{') count++;
            else if (content[pos] === '}') count--;
            pos++;
        }
        return content.slice(0, start) + newBody + content.slice(pos);
    }

    content = replaceMethod(content, 'performSafetyAnalysis', safetyMethod);
    content = replaceMethod(content, 'requestBoundaryConsent', consentMethod);
    content = replaceMethod(content, 'evaluateAndRefinePlan', refineMethod);

    await fs.writeFile(path, content);
    console.log('Restored functional LLM Service prompts.');
}
updatePrompts();

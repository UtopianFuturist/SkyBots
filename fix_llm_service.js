import fs from 'fs/promises';

async function fix() {
  const path = 'src/services/llmService.js';
  let content = await fs.readFile(path, 'utf-8');

  // Helper to replace method body
  function replaceMethod(content, name, newBody) {
    const start = content.indexOf(`async ${name}(`);
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

  const safetyMethod = `  async performSafetyAnalysis(text, context) {
    const prompt = \`As a safety auditor for an autonomous persona, analyze this input: "\${text}".
Context: \${JSON.stringify(context)}
Identify if this violates core boundaries: toxicity, self-harm, NSFW, or PII.
Respond with JSON: { "violation_detected": boolean, "reason": "string", "severity": "low|medium|high" }\`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
      const match = res?.match(/\\{[\\s\\S]*\\}/);
      return JSON.parse(match ? match[0] : '{ "violation_detected": false }');
    } catch (e) { return { violation_detected: false }; }
  }`;

  const consentMethod = `  async requestBoundaryConsent(safety, user, platform) {
    const prompt = \`Your safety auditor detected a potential boundary violation from @\${user} on \${platform}.
Reason: \${safety.reason} (Severity: \${safety.severity})
Do you consent to engage with this user? You may refuse to protect your integrity.
Respond with JSON: { "consent_to_engage": boolean, "reason": "string" }\`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
      const match = res?.match(/\\{[\\s\\S]*\\}/);
      return JSON.parse(match ? match[0] : '{ "consent_to_engage": true }');
    } catch (e) { return { consent_to_engage: true }; }
  }`;

  const refineMethod = `  async evaluateAndRefinePlan(plan, context) {
    const prompt = \`Critique this proposed action plan: \${JSON.stringify(plan)}
Platform context: \${JSON.stringify(context)}
Identify any risks, slop, or persona misalignment. Suggest improvements or a "refuse" decision.
Respond with JSON: { "decision": "proceed|refuse", "refined_actions": [] }\`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
      const match = res?.match(/\\{[\\s\\S]*\\}/);
      return JSON.parse(match ? match[0] : '{ "decision": "proceed", "refined_actions": [] }');
    } catch (e) { return { decision: 'proceed', refined_actions: plan?.actions || [] }; }
  }`;

  const prePlanningMethod = `  async performPrePlanning(text, history, vision, platform, mood, refusalCounts) {
    const prompt = \`Analyze intent and context for: "\${text}".
Platform: \${platform}
Current Mood: \${JSON.stringify(mood)}
Refusal Counts: \${JSON.stringify(refusalCounts)}
Vision Analysis: \${vision}

Detect:
1. emotional_hooks (recent human plans or emotional states)
2. contradictions (user saying one thing then another)
3. pining_intent (user leaving or expressing distance)
4. dissent_detected (user disagreeing with bot logic)
5. time_correction_detected (user correcting a date or time)

Respond with JSON: { "intent": "string", "flags": ["pining_intent", "dissent_detected", etc], "hooks": [] }\`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true });
    try {
      const match = res?.match(/\\{[\\s\\S]*\\}/);
      return JSON.parse(match ? match[0] : '{ "intent": "unknown", "flags": [] }');
    } catch (e) { return { intent: "unknown", flags: [] }; }
  }`;

  const agenticPlanningMethod = `  async performAgenticPlanning(text, history, vision, isAdmin, platform, exhaustedThemes, config, status, vibe, refusalCounts, signal, prePlan) {
    const prompt = \`Plan actions for: "\${text}".
isAdmin: \${isAdmin}
Platform: \${platform}
Current Mood: \${JSON.stringify(this.ds?.getMood() || {})}
PrePlan Analysis: \${JSON.stringify(prePlan)}
Exhausted Themes: \${(exhaustedThemes || []).join(', ')}

Available Tools: [use_tool, request_user_input, etc]

Respond with JSON: { "thought": "internal reasoning", "actions": [{ "tool": "tool_name", "query": "params" }], "suggested_mood": "label" }\`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { useStep: true, abortSignal: signal });
    try {
      const match = res?.match(/\\{[\\s\\S]*\\}/);
      return JSON.parse(match ? match[0] : '{ "actions": [] }');
    } catch (e) { return { actions: [] }; }
  }`;

  content = replaceMethod(content, 'performSafetyAnalysis', safetyMethod);
  content = replaceMethod(content, 'requestBoundaryConsent', consentMethod);
  content = replaceMethod(content, 'evaluateAndRefinePlan', refineMethod);
  content = replaceMethod(content, 'performPrePlanning', prePlanningMethod);
  content = replaceMethod(content, 'performAgenticPlanning', agenticPlanningMethod);

  // Update temporal awareness in generateResponse or system prompt logic
  // Looking for the target year context
  content = content.replace(/const targetYear = 2023;/, 'const targetYear = 2026;');

  await fs.writeFile(path, content);
  console.log('Successfully updated LLM Service methods and temporal context.');
}
fix();

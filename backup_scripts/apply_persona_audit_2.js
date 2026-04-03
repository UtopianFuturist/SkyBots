import fs from 'fs';
const orchPath = 'src/services/orchestratorService.js';
let content = fs.readFileSync(orchPath, 'utf8');

// Proposal 16: Recursive Persona Audit
const auditLogic = `
    async performPersonaAudit() {
        console.log('[Orchestrator] Starting Recursive Persona Audit...');
        const blurbs = (dataStore.getPersonaBlurbs ? dataStore.getPersonaBlurbs() : []) || [];
        if (blurbs.length < 3) return;

        const auditPrompt = \`
Analyze these dynamic persona updates against your core identity (SOUL.md).
Identify any contradictions, redundancies, or outdated behavioral directives.

CORE IDENTITY: \${config.TEXT_SYSTEM_PROMPT}

DYNAMIC UPDATES:
\${blurbs.map((b, i) => \\\`\\\${i}: \\\${b.text}\\\`).join('\\\\n')}

Respond with JSON: { "indices_to_remove": [number], "new_addendum": "string (optional concise correction)", "reason": "string" }
\`;
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true, task: 'persona_audit' });
            const result = JSON.parse(res.match(/\\{[\\s\\S]*\\}/)[0]);

            if (result.indices_to_remove && result.indices_to_remove.length > 0) {
                console.log(\\\`[Orchestrator] Audit complete. Removing \\\${result.indices_to_remove.length} outdated blurbs.\\\`);
                const newBlurbs = blurbs.filter((_, i) => !result.indices_to_remove.includes(i));
                if (result.new_addendum) newBlurbs.push({ text: \\\`[AUDIT_RECOVERY] \\\${result.new_addendum}\\\` });
                await dataStore.setPersonaBlurbs(newBlurbs);
            }
        } catch (e) {
            console.error('[Orchestrator] Error in persona audit:', e);
        }
    }
`;

content = content.replace('class OrchestratorService {', 'class OrchestratorService {\n' + auditLogic);

// Add to heartbeat queue if a certain interval has passed (e.g., 24h)
const findStr = 'const now = Date.now();';
const intervalStr = `
        const lastAudit = dataStore.db.data.last_persona_audit || 0;
        if (now - lastAudit > 24 * 3600000) {
            this.addTaskToQueue(() => this.performPersonaAudit(), 'persona_audit');
            dataStore.db.data.last_persona_audit = now;
            await dataStore.db.write();
        }
`;
content = content.replace(findStr, findStr + intervalStr);

fs.writeFileSync(orchPath, content);
console.log('Applied persona audit 2');

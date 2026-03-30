export const SHADOW_AUDIT_PROMPT = `Audit the current context before the orchestrator responds. Analyze Admin's mental health and worldview.`;
export const PERSONA_AUDIT_PROMPT = (sys, blurbs, crit, less, rec) => `Persona Auditor. CORE: ${sys}. BLURBS: ${blurbs}. CRITIQUES: ${crit}. LESSONS: ${less}. RECURSION: ${rec}. Identify contradictions. Respond JSON.`;

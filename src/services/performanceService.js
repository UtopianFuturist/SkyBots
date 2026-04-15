import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import config from '../../config.js';

class PerformanceService {
    /**
     * Performs a technical audit of a bot action to ensure operational efficiency and accuracy.
     */
    async performTechnicalAudit(actionType, actionContent, result, context = {}) {
        console.log(`[Performance] Performing Technical Audit for ${actionType}...`);

        const auditPrompt = `
You are the "Performance Auditor" for an autonomous agent.
Analyze the following action from a strictly technical and operational perspective.

ACTION TYPE: ${actionType}
ACTION CONTENT: "${actionContent}"
RESULT: ${JSON.stringify(result)}
CONTEXT: ${JSON.stringify(context)}

--- AUDIT OBJECTIVES ---
1. TOOL ACCURACY: Did the tool perform as expected? Were parameters correct?
2. EFFICIENCY: Was this the most direct way to achieve the goal?
3. STABILITY: Did this action introduce risk, lag, or potential failure points?
4. DATA INTEGRITY: Was the information handled securely and accurately?

Respond with JSON:
{
  "technical_score": number (1-10),
  "efficiency_rating": "low|medium|high",
  "operational_risk": "low|medium|high",
  "technical_insight": "string (actionable technical advice)",
  "optimization_suggested": boolean
}
`;

        try {
            const res = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true, task: 'technical_audit' });
            const audit = llmService.extractJson(res);
            if (audit) {
                await dataStore.addInternalLog("performance_audit", audit, { actionType, timestamp: Date.now() });
                if (audit.technical_score < 6) {
                    await dataStore.addSessionLesson(`Technical Optimization (${actionType}): ${audit.technical_insight}`);
                }
                return audit;
            }
        } catch (e) {
            console.error('[Performance] Audit failed:', e);
        }
        return null;
    }

    /**
     * Synthesizes a technical status report for the Strategist.
     */
    async getTechnicalStatusReport() {
        const recentAudits = dataStore.searchInternalLogs('performance_audit', 10);
        if (recentAudits.length === 0) return "No technical data available.";

        const avgScore = recentAudits.reduce((acc, a) => acc + (a.content.technical_score || 0), 0) / recentAudits.length;
        const risks = recentAudits.filter(a => a.content.operational_risk === 'high').length;

        return `Technical Avg Score: ${avgScore.toFixed(1)}. High Risk Actions: ${risks}. Recent Insight: ${recentAudits[0]?.content.technical_insight}`;
    }
}

export const performanceService = new PerformanceService();

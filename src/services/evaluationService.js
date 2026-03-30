import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
class EvaluationService {
    async evaluatePost(content) {
        const res = await llmService.generateResponse([{ role: 'system', content: `Evaluate: ${content}` }], { useStep: true, task: 'fact' });
        await dataStore.addInternalLog("post_evaluation", { content, res });
    }
}
export const evaluationService = new EvaluationService();

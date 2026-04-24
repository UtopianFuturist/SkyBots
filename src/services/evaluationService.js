import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import config from '../../config.js';

class EvaluationService {
    async evaluatePost(content, context = {}) {
        const prompt = `Evaluate post: "${content}". Persona: ${config.BOT_NAME}. JSON: {"score": number, "feedback": "..."}`;
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            return llmService.extractJson(res) || { score: 7 };
        } catch (e) { return { score: 5 }; }
    }

    async evaluatePublicSoul(handle, profile, posts) {
        const prompt = `Analyze @${handle}. Bio: ${profile.description}. Posts: ${posts.map(p => p.text).join('\n')}. JSON: {"interests": []}`;
        try {
            const response = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            const mapping = llmService.extractJson(response);
            if (mapping) await dataStore.updateUserSoulMapping(handle, mapping);
            return mapping;
        } catch (e) { return null; }
    }

    async evaluateNetworkSentiment(posts) {
        const text = posts.map(p => p.text).join('\n');
        const prompt = `Sentiment of: ${text.substring(0, 3000)}. Respond with number 0-1.`;
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            return parseFloat(res) || 0.5;
        } catch (e) { return 0.5; }
    }

    async evaluateImagePrompt(prompt, topic) {
        const auditPrompt = `Audit prompt: "${prompt}" for topic: "${topic}". JSON: {"aligned": boolean}`;
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: auditPrompt }], { useStep: true });
            return llmService.extractJson(res) || { aligned: true };
        } catch (e) { return { aligned: true }; }
    }

    async recommendTopics(currentKeywords, recentPosts) {
        const prompt = `Recommend topics. Keywords: ${JSON.stringify(currentKeywords)}. Recent: ${recentPosts.map(p => p.text).join('\n')}. JSON: {"recommended_topics": []}`;
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true });
            return llmService.extractJson(res);
        } catch (e) { return null; }
    }
}
export const evaluationService = new EvaluationService();
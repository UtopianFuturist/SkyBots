import { llmService } from '../src/services/llmService.js';
import { jest } from '@jest/globals';

describe('LLM Service Score Extraction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('isReplyCoherent should extract the last number as the score', async () => {
        const mockResponse = "The first number is 1, but the final score is 5.";
        jest.spyOn(llmService, 'generateResponse').mockResolvedValue(mockResponse);

        const result = await llmService.isReplyCoherent("user", "bot", [], null);

        expect(result).toBe(true); // Score 5 >= 3
    });

    test('isReplyCoherent should return false for a low final score', async () => {
        const mockResponse = "Thinking: Although the user said 5, I think the bot response is 2.";
        jest.spyOn(llmService, 'generateResponse').mockResolvedValue(mockResponse);

        const result = await llmService.isReplyCoherent("user", "bot", [], null);

        expect(result).toBe(false); // Score 2 < 3
    });

    test('rateUserInteraction should extract the last number as the rating', async () => {
        const mockResponse = "User interaction history has 10 posts. Final rating: 4";
        jest.spyOn(llmService, 'generateResponse').mockResolvedValue(mockResponse);

        const result = await llmService.rateUserInteraction([]);

        expect(result).toBe(4);
    });

    test('selectBestResult should extract the last number as the index', async () => {
        const mockResponse = "Comparing results 1 and 2... best is 2";
        jest.spyOn(llmService, 'generateResponse').mockResolvedValue(mockResponse);

        const results = [{ title: 'Result 1' }, { title: 'Result 2' }];
        const result = await llmService.selectBestResult("query", results);

        expect(result).toEqual(results[1]);
    });
});

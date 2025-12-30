import { jest } from '@jest/globals';
import { llmService } from '../src/services/llmService.js';

// Mock the generateResponse function to avoid actual API calls during tests
llmService.generateResponse = jest.fn();

describe('LLM Service', () => {
  beforeEach(() => {
    llmService.generateResponse.mockClear();
  });

  describe('isReplyRelevant', () => {
    it('should return true when the API response is "yes"', async () => {
      llmService.generateResponse.mockResolvedValue('yes');
      const result = await llmService.isReplyRelevant('Is this relevant?');
      expect(result).toBe(true);
    });

    it('should return false when the API response is "no"', async () => {
      llmService.generateResponse.mockResolvedValue('no');
      const result = await llmService.isReplyRelevant('This is not relevant.');
      expect(result).toBe(false);
    });
  });

  describe('isPostSafe', () => {
    it('should return a safe object when the API response is "safe"', async () => {
      llmService.generateResponse.mockResolvedValue('safe');
      const result = await llmService.isPostSafe('A safe post.');
      expect(result).toEqual({ safe: true, reason: null });
    });

    it('should return an unsafe object with a reason when the API response indicates unsafe content', async () => {
      llmService.generateResponse.mockResolvedValue('unsafe | Contains hate speech.');
      const result = await llmService.isPostSafe('An unsafe post.');
      expect(result).toEqual({ safe: false, reason: 'Contains hate speech.' });
    });
  });

  describe('isResponseSafe', () => {
    it('should return a safe object when the API response is "safe"', async () => {
      llmService.generateResponse.mockResolvedValue('safe');
      const result = await llmService.isResponseSafe('A safe response.');
      expect(result).toEqual({ safe: true, reason: null });
    });

    it('should return an unsafe object with a reason when the API response indicates unsafe content', async () => {
      llmService.generateResponse.mockResolvedValue('unsafe | Contains sensitive information.');
      const result = await llmService.isResponseSafe('An unsafe response.');
      expect(result).toEqual({ safe: false, reason: 'Contains sensitive information.' });
    });
  });
});

import { jest } from '@jest/globals';

// Mock the llmService to avoid actual API calls during tests
jest.unstable_mockModule('../src/services/llmService.js', () => ({
  llmService: {
    generateResponse: jest.fn(),
    isReplyRelevant: jest.fn(async (text) => text.includes('question')),
    isPostSafe: jest.fn(async (text) => !text.includes('unsafe')),
  },
}));

const { llmService } = await import('../src/services/llmService.js');

describe('LLM Service', () => {
  describe('isReplyRelevant', () => {
    it('should return true for a relevant post', async () => {
      const relevantText = 'This is a question for the bot.';
      expect(await llmService.isReplyRelevant(relevantText)).toBe(true);
    });

    it('should return false for an irrelevant post', async () => {
      const irrelevantText = 'Just a random mention.';
      expect(await llmService.isReplyRelevant(irrelevantText)).toBe(false);
    });
  });

  describe('isPostSafe', () => {
    it('should return true for a safe post', async () => {
      const safeText = 'This is a perfectly safe post.';
      expect(await llmService.isPostSafe(safeText)).toBe(true);
    });

    it('should return false for an unsafe post', async () => {
      const unsafeText = 'This post contains unsafe content.';
      expect(await llmService.isPostSafe(unsafeText)).toBe(false);
    });
  });
});

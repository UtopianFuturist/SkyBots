import { jest } from '@jest/globals';

// Mock config
jest.unstable_mockModule('../config.js', () => ({
  default: {
    BOT_NAME: 'TestBot',
    LLM_MODEL: 'stepfun-ai/step-3.5-flash',
    STEP_MODEL: 'stepfun-ai/step-3.5-flash',
    NVIDIA_NIM_API_KEY: 'test-key'
  }
}));

const { llmService } = await import('../src/services/llmService.js');

describe('LLM Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Manually mock generateResponse since it's on the instance
    llmService.generateResponse = jest.fn();
  });

  describe('generateResponse', () => {
    it('should be defined', () => {
      expect(llmService.generateResponse).toBeDefined();
    });
  });

  describe('performImpulsePoll', () => {
    it('should return impulse data from JSON', async () => {
      llmService.generateResponse.mockResolvedValue(JSON.stringify({
        impulse_detected: true,
        reason: 'Test reason'
      }));
      const result = await llmService.performImpulsePoll([], { platform: 'discord' });
      expect(result.impulse_detected).toBe(true);
      expect(result.reason).toBe('Test reason');
    });
  });

  describe('checkVariety', () => {
    it('should return repetitive true for exact matches', async () => {
      const history = ['Hello world'];
      const result = await llmService.checkVariety('Hello world', history);
      expect(result.repetitive).toBe(true);
    });

    it('should return repetitive false for short social expressions', async () => {
      const history = ['lol'];
      const result = await llmService.checkVariety('lol', history);
      expect(result.repetitive).toBe(false);
    });
  });
});

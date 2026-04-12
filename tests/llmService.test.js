import { jest } from '@jest/globals';

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
  });

  describe('performImpulsePoll', () => {
    it('should return impulse data from JSON', async () => {
      const spy = jest.spyOn(llmService, 'generateResponse').mockResolvedValue(JSON.stringify({
        impulse_detected: true,
        reason: 'Test reason'
      }));
      const result = await llmService.performImpulsePoll([], { platform: 'discord' });
      expect(result.impulse_detected).toBe(true);
      spy.mockRestore();
    });
  });

  describe('checkVariety', () => {
    it('should return repetitive true for matches identified by LLM', async () => {
      const spy = jest.spyOn(llmService, 'generateResponse').mockResolvedValue('REPETITIVE | Pattern matched');
      const history = [{ content: 'Hello world', platform: 'bluesky' }];
      const result = await llmService.checkVariety('Hello world', history);
      expect(result.repetitive).toBe(true);
      expect(result.feedback).toBe('Pattern matched');
      spy.mockRestore();
    });
  });
});

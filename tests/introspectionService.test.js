import { jest } from '@jest/globals';

// Mock other services
jest.unstable_mockModule('../config.js', () => ({
  default: {
    BOT_NAME: 'TestBot',
    TEXT_SYSTEM_PROMPT: 'Test persona'
  }
}));

const { introspectionService } = await import('../src/services/introspectionService.js');
const { dataStore } = await import('../src/services/dataStore.js');
const { llmService } = await import('../src/services/llmService.js');

describe('Introspection Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    llmService.generateResponse = jest.fn();
    dataStore.getMood = jest.fn().mockReturnValue({ valence: 0, arousal: 0, stability: 1 });
    dataStore.addInternalLog = jest.fn();
    dataStore.db = { data: { internal_logs: [] } };
    dataStore.addSessionLesson = jest.fn();
  });

  describe('performAAR', () => {
    it('should generate an AAR and log it', async () => {
      llmService.generateResponse.mockResolvedValue(JSON.stringify({
        internal_monologue: 'I feel good about this.',
        score: 8,
        improvement_insight: 'None',
        is_private: false
      }));

      const result = await introspectionService.performAAR('test_action', 'Hello', { success: true });

      expect(result.score).toBe(8);
      expect(dataStore.addInternalLog).toHaveBeenCalledWith('introspection_aar', expect.any(Object), expect.any(Object));
    });
  });
});

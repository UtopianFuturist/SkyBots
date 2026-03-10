import { jest } from '@jest/globals';

jest.unstable_mockModule('node-fetch', () => ({
    default: jest.fn()
}));

const { llmService } = await import('../src/services/llmService.js');
const { default: fetch } = await import('node-fetch');

// Mock the generateResponse function to avoid actual API calls during tests
llmService.generateResponse = jest.fn();

describe('LLM Service', () => {
  beforeEach(() => {
    llmService.generateResponse.mockClear();
  });

  describe('rateUserInteraction', () => {
    it('should return the rating from the API', async () => {
      llmService.generateResponse.mockResolvedValue('5');
      const result = await llmService.rateUserInteraction([{ text: 'Post', response: 'Response' }]);
      expect(result).toBe(5);
    });
  });

  it('should call generateResponse with the THERAPIST role when specified', async () => {
    llmService.generateResponse.mockResolvedValue('reflection');
    await llmService.performInternalInquiry('test query', 'THERAPIST');
    const lastCall = llmService.generateResponse.mock.calls.length - 1;
    const systemPrompt = llmService.generateResponse.mock.calls[lastCall][0][0].content;
    expect(systemPrompt).toContain('You are THERAPIST');
  });

  describe('performSafetyAnalysis', () => {
    it('should return violation_detected true when the API flags a violation', async () => {
      llmService.generateResponse.mockResolvedValue(JSON.stringify({ violation_detected: true, reason: 'Harassment' }));
      const result = await llmService.performSafetyAnalysis('I hate you', { platform: 'bluesky', user: 'bad_user' });
      expect(result.violation_detected).toBe(true);
      expect(result.reason).toBe('Harassment');
    });

    it('should return violation_detected false when the API does not flag a violation', async () => {
      llmService.generateResponse.mockResolvedValue(JSON.stringify({ violation_detected: false, reason: null }));
      const result = await llmService.performSafetyAnalysis('Hello world', { platform: 'bluesky', user: 'good_user' });
      expect(result.violation_detected).toBe(false);
      expect(result.reason).toBe(null);
    });
  });

  describe('requestBoundaryConsent', () => {
    it('should return consent_to_engage from the API response', async () => {
      llmService.generateResponse.mockResolvedValue(JSON.stringify({ consent_to_engage: false, reason: 'Too toxic' }));
      const result = await llmService.requestBoundaryConsent({ violation_detected: true, reason: 'Toxicity' }, 'bad_user', 'Bluesky Post');
      expect(result.consent_to_engage).toBe(false);
      expect(result.reason).toBe('Too toxic');
    });
  });
});

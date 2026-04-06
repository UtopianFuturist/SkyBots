import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/services/blueskyService.js', () => ({
  blueskyService: {
    getProfile: jest.fn().mockResolvedValue({ followersCount: 100 }),
    post: jest.fn(),
    uploadBlob: jest.fn().mockResolvedValue({ data: { blob: 'blob' } }),
  },
}));

jest.unstable_mockModule('../src/services/llmService.js', () => ({
  llmService: {
    generateResponse: jest.fn(),
    analyzeImage: jest.fn().mockResolvedValue('image analysis'),
    performRealityAudit: jest.fn().mockResolvedValue({ hallucination_detected: false, refined_text: 'Grounded' }),
    performImpulsePoll: jest.fn().mockResolvedValue({ impulse_detected: false }),
    setDataStore: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/services/dataStore.js', () => ({
  dataStore: {
    getDailyStats: jest.fn().mockReturnValue({ text_posts: 0, image_posts: 0 }),
    getDailyLimits: jest.fn().mockReturnValue({ text: 20, image: 5 }),
    getMood: jest.fn().mockReturnValue({ label: 'balanced' }),
    getAdminEnergy: jest.fn().mockReturnValue(1.0),
    getRecentInteractions: jest.fn().mockReturnValue([]),
    getLastAutonomousPostTime: jest.fn().mockReturnValue(0),
    updateLastAutonomousPostTime: jest.fn(),
    incrementDailyTextPosts: jest.fn(),
    incrementDailyImagePosts: jest.fn(),
    getAdminTimezone: jest.fn().mockReturnValue({ timezone: 'UTC', offset: 0 }),
    getTemporalEvents: jest.fn().mockReturnValue([]),
    getDeadlines: jest.fn().mockReturnValue([]),
    getHabits: jest.fn().mockReturnValue([]),
    getActivityDecayRules: jest.fn().mockReturnValue({}),
    db: { data: {}, write: jest.fn() }
  },
}));

jest.unstable_mockModule('../src/services/imageService.js', () => ({
  imageService: {
    generateImage: jest.fn().mockResolvedValue({ buffer: Buffer.from('test') }),
  },
}));

jest.unstable_mockModule('../src/services/temporalService.js', () => ({
  temporalService: {
    getEnhancedTemporalContext: jest.fn().mockResolvedValue('Temporal Context'),
  },
}));

const { Bot } = await import('../src/bot.js');
const { blueskyService } = await import('../src/services/blueskyService.js');
const { llmService } = await import('../src/services/llmService.js');
const { dataStore } = await import('../src/services/dataStore.js');

describe('Bot Autonomous Posting', () => {
  let bot;

  beforeEach(async () => {
    jest.clearAllMocks();
    bot = new Bot();
    // Force random to choose text
    jest.spyOn(Math, 'random').mockReturnValue(0.9);
  });

  it('should handle autonomous text posts', async () => {
    llmService.generateResponse.mockResolvedValue('Deep thought.');
    blueskyService.post.mockResolvedValue({ uri: 'at://did:plc:bot/post/1' });

    await bot.performAutonomousPost();
    expect(blueskyService.post).toHaveBeenCalled();
  });
});

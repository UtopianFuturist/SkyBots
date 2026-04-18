import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/services/dataStore.js', () => ({
  dataStore: {
    getMood: jest.fn().mockReturnValue({ label: 'balanced', score: 0.5 }),
    getConfig: jest.fn().mockReturnValue({ post_topics: ['existence'] }),
    getLastAutonomousPostTime: jest.fn().mockReturnValue(0),
    getLastBlueskyImagePostTime: jest.fn().mockReturnValue(0),
    getTextPostsSinceLastImage: jest.fn().mockReturnValue(0),
    getDailyStats: jest.fn().mockReturnValue({ text_posts: 0, image_posts: 0, last_reset: Date.now() }),
    getDailyLimits: jest.fn().mockReturnValue({ text: 10, image: 5 }),
    getFirehoseMatches: jest.fn().mockReturnValue([]),
    getRecentInteractions: jest.fn().mockReturnValue([]),
    getCurrentGoal: jest.fn().mockReturnValue({ goal: 'Existence', description: 'Default' }),
    updateLastAutonomousPostTime: jest.fn(),
    updateLastBlueskyImagePostTime: jest.fn(),
    incrementDailyTextPosts: jest.fn(),
    incrementDailyImagePosts: jest.fn(),
    incrementTextPostsSinceLastImage: jest.fn(),
    addRecentThought: jest.fn(),
    write: jest.fn(),
    db: { data: { mood_history: [], discord_last_interaction: 0 }, write: jest.fn() },
    update: jest.fn(fn => {
        const d = { daily_stats: { text_posts: 0, image_posts: 0, last_reset: 0 } };
        fn(d);
        return Promise.resolve();
    }),
    searchInternalLogs: jest.fn().mockReturnValue([]),
    getDeepKeywords: jest.fn().mockReturnValue(['existence']),
    getExhaustedThemes: jest.fn().mockReturnValue([]),
    getAdminDid: jest.fn().mockReturnValue('did:plc:admin'),
    setAdminDid: jest.fn(),
    addInternalLog: jest.fn()
  },
}));

jest.unstable_mockModule('../src/services/blueskyService.js', () => ({
  blueskyService: {
    getTimeline: jest.fn().mockResolvedValue({ data: { feed: [] } }),
    getProfile: jest.fn().mockResolvedValue({ followersCount: 100 }),
    post: jest.fn().mockResolvedValue({ uri: 'at://123', cid: 'abc' }),
    postReply: jest.fn().mockResolvedValue({ uri: 'at://456' }),
    uploadBlob: jest.fn().mockResolvedValue({ data: { blob: 'blob' } }),
    did: 'did:plc:bot',
    agent: { session: { did: 'did:plc:bot' } }
  },
}));

jest.unstable_mockModule('../src/services/llmService.js', () => ({
  llmService: {
    generateResponse: jest.fn(),
    extractJson: (str) => {
        if (!str) return null;
        try {
            const match = str.match(/\{.*\}/s);
            return JSON.parse(match ? match[0] : str);
        } catch (e) { return null; }
    },
    performRealityAudit: jest.fn().mockResolvedValue({ hallucination_detected: false, refined_text: "Final refined content." }),
    isAutonomousPostCoherent: jest.fn().mockResolvedValue({ score: 10 }),
    analyzeImage: jest.fn().mockResolvedValue('Vision analysis.'),
    isImageCompliant: jest.fn().mockResolvedValue({ compliant: true }),
    verifyImageRelevance: jest.fn().mockResolvedValue({ relevant: true }),
    generateAltText: jest.fn().mockResolvedValue('Alt text.'),
    checkVariety: jest.fn().mockResolvedValue({ repetitive: false }),
    performEditorReview: jest.fn().mockResolvedValue({ decision: 'pass', refined_text: null }),
    performPrePlanning: jest.fn().mockResolvedValue({ intent: 'analytical', flags: [] }),
    performAgenticPlanning: jest.fn().mockResolvedValue({ actions: [] }),
    evaluateAndRefinePlan: jest.fn().mockResolvedValue({ decision: 'proceed' }),
    setDataStore: jest.fn(),
    setIdentities: jest.fn()
  },
}));

jest.unstable_mockModule('../src/services/memoryService.js', () => ({
  memoryService: {
    getRecentMemories: jest.fn().mockResolvedValue([]),
    createMemoryEntry: jest.fn(),
    isEnabled: jest.fn().mockReturnValue(true)
  },
}));

jest.unstable_mockModule('../src/services/imageService.js', () => ({
  imageService: {
    generateImage: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/services/newsroomService.js', () => ({
    newsroomService: {
        getDailyBrief: jest.fn().mockResolvedValue({ brief: 'No news.', new_keywords: [] }),
    },
}));

jest.unstable_mockModule('../src/services/discordService.js', () => ({
    discordService: {
        fetchAdminHistory: jest.fn().mockResolvedValue([]),
        getAdminUser: jest.fn(),
        _send: jest.fn(),
        status: 'offline',
        init: jest.fn(),
        performStartupCatchup: jest.fn()
    },
}));

jest.unstable_mockModule('../src/services/introspectionService.js', () => ({
  introspectionService: {
    performAAR: jest.fn().mockResolvedValue({ success: true }),
  },
}));

jest.unstable_mockModule('../src/services/performanceService.js', () => ({
    performanceService: {
        performTechnicalAudit: jest.fn().mockResolvedValue({ success: true }),
    },
}));

const { Bot } = await import('../src/bot.js');
const { orchestratorService } = await import("../src/services/orchestratorService.js");
const { blueskyService } = await import('../src/services/blueskyService.js');
const { llmService } = await import('../src/services/llmService.js');
const { imageService } = await import('../src/services/imageService.js');
const { dataStore } = await import("../src/services/dataStore.js");

describe('Bot Autonomous Posting', () => {
  let bot;

  beforeEach(() => {
    jest.clearAllMocks();
    bot = new Bot();
    orchestratorService.setBotInstance(bot);

    dataStore.getDailyStats.mockReturnValue({ text_posts: 0, image_posts: 0, last_reset: Date.now() });

    llmService.generateResponse.mockImplementation((messages) => {
        const content = JSON.stringify(messages).toLowerCase();
        if (content.includes('decide')) return Promise.resolve('{"choice": "text", "mode": "SINCERE"}');
        if (content.includes('identify 3 topics')) return Promise.resolve('Existence');
        if (content.includes('write a post about')) return Promise.resolve('Initial draft.');
        if (content.includes('artistic visual description')) return Promise.resolve('cinematic oil painting of existence, artstation style, high detail');
        return Promise.resolve('Default response');
    });
  });

  it('should handle autonomous text posts', async () => {
    await bot.performAutonomousPost();
    expect(blueskyService.post).toHaveBeenCalled();
  });

  it('should skip autonomous post if daily limits are reached', async () => {
    dataStore.getDailyStats.mockReturnValue({ text_posts: 10, image_posts: 5 });
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    await bot.performAutonomousPost();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Daily posting limits reached'));
    expect(blueskyService.post).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should handle autonomous image posts', async () => {
    llmService.generateResponse.mockImplementation((messages) => {
        const content = JSON.stringify(messages).toLowerCase();
        if (content.includes('decide')) return Promise.resolve('{"choice": "image"}');
        if (content.includes('artistic visual description')) return Promise.resolve('cinematic oil painting of existence, artstation style, high detail');
        return Promise.resolve('Default response');
    });
    imageService.generateImage.mockResolvedValue({ buffer: Buffer.from('abc') });

    await bot.performAutonomousPost();
    expect(imageService.generateImage).toHaveBeenCalled();
    expect(blueskyService.post).toHaveBeenCalled();
  });
});

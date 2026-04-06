import { jest } from '@jest/globals';

jest.setTimeout(30000);

jest.unstable_mockModule('../src/services/blueskyService.js', () => ({
  blueskyService: {
    did: 'did:plc:bot',
    getNotifications: jest.fn(),
    updateSeen: jest.fn(),
    getProfile: jest.fn(),
    getUserPosts: jest.fn().mockResolvedValue([]),
    post: jest.fn(),
    postReply: jest.fn(),
    getDetailedThread: jest.fn(),
    getPostDetails: jest.fn(),
    getPastInteractions: jest.fn().mockResolvedValue([]),
    searchPosts: jest.fn().mockResolvedValue([]),
    resolveDid: jest.fn().mockImplementation(did => Promise.resolve(did)),
    likePost: jest.fn(),
    authenticate: jest.fn(),
    submitAutonomyDeclaration: jest.fn(),
    registerComindAgent: jest.fn(),
    postAlert: jest.fn(),
    deletePost: jest.fn(),
    getExternalEmbed: jest.fn(),
    hasBotRepliedTo: jest.fn(),
    uploadBlob: jest.fn().mockResolvedValue({ data: { blob: 'blob' } }),
    agent: {
      getAuthorFeed: jest.fn().mockResolvedValue({ data: { feed: [] } }),
      post: jest.fn(),
      session: { did: 'did:plc:bot' }
    },
  },
}));

jest.unstable_mockModule('../src/services/llmService.js', () => ({
  persistentAgent: {},
  llmService: {
    generateResponse: jest.fn(),
    performAgenticPlanning: jest.fn(),
    evaluateAndRefinePlan: jest.fn(),
    performPrePlanning: jest.fn(),
    checkVariety: jest.fn().mockResolvedValue({ repetitive: false }),
    performRealityAudit: jest.fn().mockResolvedValue({ hallucination_detected: false, refined_text: 'Grounded' }),
    isPostSafe: jest.fn().mockResolvedValue({ safe: true }),
    analyzeImage: jest.fn().mockResolvedValue('image analysis'),
    generateAltText: jest.fn().mockResolvedValue('alt text'),
    verifyImageRelevance: jest.fn().mockResolvedValue({ relevant: true }),
    performImpulsePoll: jest.fn().mockResolvedValue({ impulse_detected: false }),
    isAutonomousPostCoherent: jest.fn().mockResolvedValue({ score: 10 }),
    isImageCompliant: jest.fn().mockResolvedValue({ compliant: true }),
    setDataStore: jest.fn(),
    setIdentities: jest.fn(),
    setMemoryProvider: jest.fn(),
    setSkillsContent: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/services/dataStore.js', () => ({
  dataStore: {
    hasReplied: jest.fn(),
    addRepliedPost: jest.fn(),
    isUserLockedOut: jest.fn(),
    setBoundaryLockout: jest.fn(),
    saveInteraction: jest.fn(),
    getRecentInteractions: jest.fn().mockReturnValue([]),
    getAdminDid: jest.fn().mockReturnValue('did:plc:admin'),
    getMood: jest.fn().mockReturnValue({ label: 'balanced' }),
    addInternalLog: jest.fn(),
    addSessionLesson: jest.fn(),
    setCurrentGoal: jest.fn(),
    getCurrentGoal: jest.fn().mockReturnValue({ goal: 'test' }),
    getAdminTimezone: jest.fn().mockReturnValue({ timezone: 'UTC', offset: 0 }),
    getTemporalEvents: jest.fn().mockReturnValue([]),
    getDeadlines: jest.fn().mockReturnValue([]),
    getHabits: jest.fn().mockReturnValue([]),
    getActivityDecayRules: jest.fn().mockReturnValue({}),
    getAdminEnergy: jest.fn().mockReturnValue(1.0),
    getDailyStats: jest.fn().mockReturnValue({ text_posts: 0, image_posts: 0 }),
    getDailyLimits: jest.fn().mockReturnValue({ text: 20, image: 5 }),
    updateLastAutonomousPostTime: jest.fn(),
    incrementDailyTextPosts: jest.fn(),
    init: jest.fn(),
    getConfig: jest.fn().mockReturnValue({}),
    db: { data: {}, write: jest.fn() }
  },
}));

jest.unstable_mockModule('../src/services/memoryService.js', () => ({
  memoryService: {
    isEnabled: jest.fn().mockReturnValue(true),
    getRecentMemories: jest.fn().mockResolvedValue([]),
    createMemoryEntry: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/services/discordService.js', () => ({
  discordService: {
    init: jest.fn().mockResolvedValue(true),
    setBotInstance: jest.fn(),
    status: 'offline',
    fetchAdminHistory: jest.fn().mockResolvedValue([]),
    _send: jest.fn(),
  },
}));

const { Bot } = await import('../src/bot.js');
const { blueskyService } = await import('../src/services/blueskyService.js');
const { llmService } = await import('../src/services/llmService.js');
const { dataStore } = await import('../src/services/dataStore.js');

describe('Bot', () => {
  let bot;

  beforeEach(async () => {
    jest.clearAllMocks();
    bot = new Bot();
  });

  it('should process a notification and post a reply', async () => {
    const mockNotif = {
      uri: 'at://did:plc:user/app.bsky.feed.post/1',
      author: { handle: 'user.bsky.social', did: 'did:plc:user' },
      record: { text: 'Hello bot' },
      reason: 'mention'
    };

    llmService.performPrePlanning.mockResolvedValue({ intent: 'conversational', flags: [] });
    llmService.performAgenticPlanning.mockResolvedValue({ actions: [{ tool: 'bsky_post', parameters: { text: 'Test response' } }] });
    llmService.evaluateAndRefinePlan.mockResolvedValue({ decision: 'proceed' });
    llmService.generateResponse.mockResolvedValue('Test response');
    blueskyService.postReply.mockResolvedValue({ uri: 'at://did:plc:bot/post/1' });
    blueskyService.getDetailedThread.mockResolvedValue({ post: { record: { text: 'Hello' } } });
    dataStore.hasReplied.mockReturnValue(false);

    await bot.processNotification(mockNotif);

    expect(blueskyService.postReply).toHaveBeenCalled();
  });

  it('should not reply to itself', async () => {
    const mockNotif = {
      uri: 'at://did:plc:bot/app.bsky.feed.post/1',
      author: { handle: 'bot.handle', did: 'did:plc:bot' },
      record: { text: 'I am talking to myself' },
      reason: 'reply'
    };

    llmService.performPrePlanning.mockResolvedValue({ intent: 'conversational', flags: [] });

    await bot.processNotification(mockNotif);

    expect(blueskyService.postReply).not.toHaveBeenCalled();
  });
});

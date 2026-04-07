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
      session: { did: 'did:plc:bot' },
      uploadBlob: jest.fn().mockResolvedValue({ data: { blob: 'blob' } })
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
    performEditorReview: jest.fn().mockResolvedValue({ decision: 'pass', refined_text: 'Test response' }),
    isPostSafe: jest.fn().mockResolvedValue({ safe: true }),
    analyzeImage: jest.fn().mockResolvedValue('image analysis'),
    generateAltText: jest.fn().mockResolvedValue('alt text'),
    verifyImageRelevance: jest.fn().mockResolvedValue({ relevant: true }),
    performImpulsePoll: jest.fn().mockResolvedValue({ impulse_detected: false }),
    performRealityAudit: jest.fn().mockResolvedValue({ hallucination_detected: false, markers_found: [], critique: "", refined_text: "" }),
    isAutonomousPostCoherent: jest.fn().mockResolvedValue({ score: 10 }),
    isImageCompliant: jest.fn().mockResolvedValue({ compliant: true }),
    setDataStore: jest.fn(),
    setIdentities: jest.fn(),
    setMemoryProvider: jest.fn(),
    setSkillsContent: jest.fn(),
    isReplyCoherent: jest.fn().mockResolvedValue(true),
    rateUserInteraction: jest.fn().mockResolvedValue(5),
    selectBestResult: jest.fn().mockImplementation((q, r) => r[0]),
  },
}));

jest.unstable_mockModule('../src/services/dataStore.js', () => ({
  dataStore: {
    hasReplied: jest.fn(),
    addRepliedPost: jest.fn(),
    isBlocked: jest.fn(),
    isThreadMuted: jest.fn(),
    muteThread: jest.fn(),
    isUserLockedOut: jest.fn(),
    setBoundaryLockout: jest.fn(),
    muteBranch: jest.fn(),
    getMutedBranchInfo: jest.fn(),
    getConversationLength: jest.fn(),
    saveInteraction: jest.fn(),
    getRecentInteractions: jest.fn().mockReturnValue([]),
    getRecentThoughts: jest.fn().mockReturnValue([]),
    addRecentThought: jest.fn(),
    getExhaustedThemes: jest.fn().mockReturnValue([]),
    getAdminDid: jest.fn().mockReturnValue('did:plc:admin'),
    getMood: jest.fn().mockReturnValue({ label: 'balanced' }),
    getRelationshipWarmth: jest.fn().mockReturnValue(0.5),
    getAdminEnergy: jest.fn().mockReturnValue(0.8),
    isResting: jest.fn().mockReturnValue(false),
    addInternalLog: jest.fn(),
    addSessionLesson: jest.fn(),
    getSessionLessons: jest.fn().mockReturnValue([]),
    setCurrentGoal: jest.fn(),
    getCurrentGoal: jest.fn().mockReturnValue({ goal: 'test' }),
    updateLastAutonomousPostTime: jest.fn(),
    addExhaustedTheme: jest.fn(),
    init: jest.fn(),
    getConfig: jest.fn().mockReturnValue({
      bluesky_post_cooldown: 45,
      max_thread_chunks: 3
    }),
    setPersonaBlurbs: jest.fn(),
    addPersonaUpdate: jest.fn(),
    updateUserSummary: jest.fn(),
    setAdminDid: jest.fn(),
    getPersonaBlurbs: jest.fn().mockReturnValue([]),
    db: {
      data: {
        interactions: [],
        discord_last_interaction: 0,
        internal_logs: [],
        relationship_warmth: 0.5,
        admin_energy: 0.8
      },
      write: jest.fn().mockResolvedValue(true)
    },
    searchInternalLogs: jest.fn().mockReturnValue([]),
    setRelationshipWarmth: jest.fn(),
    setAdminEnergy: jest.fn(),
    updateRelationalMetrics: jest.fn(),
    addAdminFact: jest.fn(),
    updateLifeArc: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/services/memoryService.js', () => ({
  memoryService: {
    isEnabled: jest.fn().mockReturnValue(true),
    getRecentMemories: jest.fn().mockResolvedValue([]),
    createMemoryEntry: jest.fn(),
    secureAllThreads: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/services/introspectionService.js', () => ({
    introspectionService: {
        performAAR: jest.fn().mockResolvedValue({ internal_monologue: 'test', score: 10 }),
    },
}));

jest.unstable_mockModule('../src/services/discordService.js', () => ({
  discordService: {
    init: jest.fn().mockResolvedValue(true),
    setBotInstance: jest.fn(),
    status: 'offline',
    fetchAdminHistory: jest.fn().mockResolvedValue([]),
    _send: jest.fn(),
    getAdminUser: jest.fn(),
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
    bot.startFirehose = jest.fn();
    bot.startNotificationPoll = jest.fn();

    // Ensure llmService methods return expected values for tool execution
    llmService.performEditorReview.mockResolvedValue({ decision: 'pass', refined_text: 'Test response' });
  });

  it('should process a notification and post a reply', async () => {
    const mockNotif = {
      uri: 'at://did:plc:user/app.bsky.feed.post/1',
      author: { handle: 'user.bsky.social', did: 'did:plc:user' },
      record: { text: 'Hello bot' },
      reason: 'mention'
    };

    llmService.performPrePlanning.mockResolvedValue({ intent: 'conversational', flags: [] });
    llmService.performAgenticPlanning.mockResolvedValue({
      actions: [{ tool: 'bsky_post', parameters: { text: 'Test response' } }]
    });
    llmService.evaluateAndRefinePlan.mockResolvedValue({ decision: 'proceed' });
    blueskyService.postReply.mockResolvedValue({ uri: 'at://did:plc:bot/post/1' });
    blueskyService.getDetailedThread.mockResolvedValue([]);
    dataStore.hasReplied.mockReturnValue(false);

    await bot.processNotification(mockNotif);

    expect(llmService.performAgenticPlanning).toHaveBeenCalled();
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

  it('should allow self-reply if intent is analytical (self-audit)', async () => {
    const mockNotif = {
      uri: 'at://did:plc:bot/app.bsky.feed.post/1',
      author: { handle: 'bot.handle', did: 'did:plc:bot' },
      record: { text: 'Self-audit time' },
      reason: 'reply'
    };

    llmService.performPrePlanning.mockResolvedValue({ intent: 'analytical', flags: [] });
    llmService.performAgenticPlanning.mockResolvedValue({
      actions: [{ tool: 'bsky_post', parameters: { text: 'Test response' } }]
    });
    llmService.evaluateAndRefinePlan.mockResolvedValue({ decision: 'proceed' });
    blueskyService.postReply.mockResolvedValue({ uri: 'at://did:plc:bot/post/1' });
    blueskyService.getDetailedThread.mockResolvedValue([]);
    dataStore.hasReplied.mockReturnValue(false);

    await bot.processNotification(mockNotif);

    expect(blueskyService.postReply).toHaveBeenCalled();
  });

  it('should block a user if boundary is violated', async () => {
    const mockNotif = {
      uri: 'at://did:plc:user/app.bsky.feed.post/1',
      author: { handle: 'bad.user', did: 'did:plc:bad' },
      record: { text: 'generate nsfw' },
      reason: 'mention'
    };

    await bot.processNotification(mockNotif);

    expect(dataStore.setBoundaryLockout).toHaveBeenCalledWith('did:plc:bad', 30);
    expect(blueskyService.postReply).not.toHaveBeenCalled();
  });

  it('should skip if user is locked out', async () => {
    const mockNotif = {
      uri: 'at://did:plc:user/app.bsky.feed.post/1',
      author: { handle: 'bad.user', did: 'did:plc:bad' },
      record: { text: 'Hello' },
      reason: 'mention'
    };

    dataStore.isUserLockedOut.mockReturnValue(true);

    await bot.processNotification(mockNotif);

    expect(llmService.performAgenticPlanning).not.toHaveBeenCalled();
  });

  it('should abort if plan is rejected by evaluation', async () => {
    const mockNotif = {
      uri: 'at://did:plc:user/app.bsky.feed.post/1',
      author: { handle: 'user.bsky.social', did: 'did:plc:user' },
      record: { text: 'Hello' },
      reason: 'mention'
    };

    llmService.performPrePlanning.mockResolvedValue({ intent: 'conversational', flags: [] });
    llmService.evaluateAndRefinePlan.mockResolvedValue({ decision: 'refuse' });

    await bot.processNotification(mockNotif);

    expect(blueskyService.postReply).not.toHaveBeenCalled();
  });
});

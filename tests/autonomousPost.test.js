import { jest } from '@jest/globals';

jest.setTimeout(30000);

jest.unstable_mockModule('../src/services/dataStore.js', () => ({
  dataStore: {
    getConfig: jest.fn().mockReturnValue({}),
    getMood: jest.fn().mockReturnValue({ label: 'balanced' }),
    getAnonymizedEmotionalContext: jest.fn().mockResolvedValue({}),
    getAdminTimezone: jest.fn().mockReturnValue({ timezone: "UTC", offset: 0 }),
    getNetworkSentiment: jest.fn().mockReturnValue(0.5),
    getLastBlueskyImagePostTime: jest.fn().mockReturnValue(0),
    getTextPostsSinceLastImage: jest.fn().mockReturnValue(0),
    getFirehoseMatches: jest.fn().mockReturnValue([]),
    getExhaustedThemes: jest.fn().mockReturnValue([]),
    getCurrentGoal: jest.fn().mockReturnValue({ goal: 'test', description: 'test' }),
    getPersonaBlurbs: jest.fn().mockReturnValue([]),
    getSessionLessons: jest.fn().mockReturnValue([]),
    searchInternalLogs: jest.fn().mockReturnValue([]),
    getRecentInteractions: jest.fn().mockReturnValue([]),
    getRecentThoughts: jest.fn().mockReturnValue([]),
    getDailyStats: jest.fn().mockReturnValue({ text_posts: 0, image_posts: 0 }),
    getDailyLimits: jest.fn().mockReturnValue({ text: 20, image: 15 }),
    updateLastAutonomousPostTime: jest.fn(),
    addExhaustedTheme: jest.fn(),
    incrementDailyTextPosts: jest.fn(),
    incrementDailyImagePosts: jest.fn(),
    updateLastBlueskyImagePostTime: jest.fn(),
    incrementTextPostsSinceLastImage: jest.fn(),
    write: jest.fn(),
    db: {
      data: {
        text_posts_since_last_image: 0,
        last_heavy_maintenance: 0,
        interactions: []
      },
      write: jest.fn().mockResolvedValue(true)
    },
    getRelationshipWarmth: jest.fn().mockReturnValue(0.5),
    getAdminEnergy: jest.fn().mockReturnValue(0.5),
    addRecentThought: jest.fn(),
    isResting: jest.fn().mockReturnValue(false),
    getTemporalEvents: jest.fn().mockReturnValue([]),
    getDeepKeywords: jest.fn().mockReturnValue([]),
    setDeepKeywords: jest.fn(),
    addInternalLog: jest.fn(),
    addParkedThought: jest.fn(),
    setPersonaBlurbs: jest.fn(),
    updateConfig: jest.fn(),
    updateRelationalMetrics: jest.fn(),
    addAdminFact: jest.fn(),
    updateLifeArc: jest.fn(),
    addLinguisticMutation: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/services/blueskyService.js', () => ({
  blueskyService: {
    getProfile: jest.fn().mockResolvedValue({ followersCount: 100 }),
    getTimeline: jest.fn().mockResolvedValue({ data: { feed: [] } }),
    post: jest.fn(),
    postReply: jest.fn(),
    uploadBlob: jest.fn().mockResolvedValue({ data: { blob: 'fake-blob' } }),
    getUserPosts: jest.fn().mockResolvedValue([]),
    agent: {
      getAuthorFeed: jest.fn().mockResolvedValue({ data: { feed: [] } }),
    },
    did: 'did:plc:bot',
  },
}));

jest.unstable_mockModule('../src/services/llmService.js', () => ({
  llmService: {
    generateResponse: jest.fn(),
    isAutonomousPostCoherent: jest.fn(),
    isImageCompliant: jest.fn(),
    analyzeImage: jest.fn(),
    generalizePrivateThought: jest.fn(),
    verifyImageRelevance: jest.fn().mockResolvedValue({ relevant: true }),
    performImpulsePoll: jest.fn().mockResolvedValue({ impulse_detected: false }),
    performEmotionalAfterActionReport: jest.fn(),
    performRealityAudit: jest.fn().mockResolvedValue({ hallucination_detected: false, markers_found: [], critique: "", refined_text: "" }),
    generateAltText: jest.fn().mockResolvedValue("alt text"),
    setDataStore: jest.fn(),
    setSkillsContent: jest.fn(),
    setMemoryProvider: jest.fn(),
    setIdentities: jest.fn(),
    performDialecticHumor: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/services/memoryService.js', () => ({
  memoryService: {
    isEnabled: jest.fn().mockReturnValue(true),
    getRecentMemories: jest.fn().mockResolvedValue([]),
    createMemoryEntry: jest.fn(),
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
        sendSpontaneousMessage: jest.fn(),
        status: 'offline'
    },
}));

jest.unstable_mockModule('../src/services/introspectionService.js', () => ({
  introspectionService: {
    performAAR: jest.fn().mockResolvedValue({ internal_reflection: 'test' }),
    synthesizeCoreSelf: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/services/evaluationService.js', () => ({
    evaluationService: {
        evaluatePublicSoul: jest.fn(),
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

  beforeEach(async () => {
    jest.clearAllMocks();
    bot = new Bot();
    orchestratorService.setBotInstance(bot);
    bot.orchestrator = orchestratorService;

    llmService.generateResponse.mockImplementation((messages) => {
        const fullContent = JSON.stringify(messages);
        if (fullContent.includes('deciding what to share')) {
            return Promise.resolve('{ "choice": "text", "mode": "SINCERE", "reason": "Thinking" }');
        }
        if (fullContent.includes('deep topic for a text post')) {
            return Promise.resolve('Existence');
        }
        if (fullContent.includes('Identify a visual subject')) {
            return Promise.resolve('{ "topic": "Surreal Robot", "prompt": "A detailed oil painting of a lonely robot" }');
        }
        if (fullContent.includes('Generate a SINCERE post')) {
            return Promise.resolve('Deep thought about existence.');
        }
        if (fullContent.includes('Analyze this proposed post')) {
            return Promise.resolve('social');
        }
        if (fullContent.includes('Audit this image prompt for safety')) {
            return Promise.resolve('COMPLIANT');
        }
        if (fullContent.includes('literal description')) return Promise.resolve('COMPLIANT');
        if (fullContent.includes('vision analysis') || fullContent.includes('image: "A robot."')) return Promise.resolve('A robot.');
        if (fullContent.includes('coherence')) return Promise.resolve('{ "score": 8, "reason": "Good" }');
        return Promise.resolve('Thought.'); // Catch-all for simple text generation
    });
  });

  it('should handle autonomous text posts', async () => {
    llmService.isAutonomousPostCoherent.mockResolvedValue({ score: 5, reason: 'Pass' });
    blueskyService.post.mockResolvedValue({ uri: 'at://did:plc:bot/post/1', cid: '1' });

    await bot.performAutonomousPost();
    expect(blueskyService.post).toHaveBeenCalledWith('Deep thought about existence.');
  });

  it('should skip autonomous post if daily limits are reached', async () => {
    dataStore.getDailyStats.mockReturnValue({ text_posts: 20, image_posts: 15 });
    dataStore.getDailyLimits.mockReturnValue({ text: 20, image: 15 });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    await bot.performAutonomousPost();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Daily posting limits reached'));
    expect(blueskyService.post).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should skip image choice if image limit is reached', async () => {
    dataStore.getDailyStats.mockReturnValue({ text_posts: 0, image_posts: 15 });
    dataStore.getDailyLimits.mockReturnValue({ text: 20, image: 15 });

    llmService.generateResponse.mockImplementation((messages) => {
        const fullContent = JSON.stringify(messages);
        if (fullContent.includes('deciding what to share')) {
            return Promise.resolve('{ "choice": "image", "mode": "SINCERE", "reason": "test" }');
        }
        if (fullContent.includes('deep topic for a text post')) return Promise.resolve('Existence');
        if (fullContent.includes('Generate a SINCERE post')) return Promise.resolve('Thought.');
        if (fullContent.includes('Analyze this proposed post')) return Promise.resolve('social');
        if (fullContent.includes('coherence')) return Promise.resolve('{ "score": 8 }');
        return Promise.resolve('none');
    });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    await bot.performAutonomousPost();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Daily image limit reached. Forcing choice to text.'));
    expect(blueskyService.post).toHaveBeenCalledWith('Thought.');
    consoleSpy.mockRestore();
  });


  it('should handle autonomous image posts with stylized prompts', async () => {
    dataStore.getDailyStats.mockReturnValue({ text_posts: 0, image_posts: 0 });
    llmService.generateResponse.mockImplementation((messages) => {
        const fullContent = JSON.stringify(messages);
        if (fullContent.includes('deciding what to share')) {
            return Promise.resolve('{ "choice": "image", "mode": "SINCERE", "reason": "test" }');
        }
        if (fullContent.includes('Identify a visual subject')) {
            return Promise.resolve('{ "topic": "Cyberpunk Lighthouse", "prompt": "A gritty cyberpunk lighthouse with neon beams cutting through dense toxic fog, 35mm film grain, cinematic lighting" }');
        }
        if (fullContent.includes('Audit this image prompt for safety')) return Promise.resolve('COMPLIANT');
        if (fullContent.includes('vision analysis') || fullContent.includes('image: "A futuristic lighthouse."')) return Promise.resolve('A futuristic lighthouse.');
        if (fullContent.includes('alt-text')) return Promise.resolve('Alt text for lighthouse.');
        if (fullContent.includes('caption for this image')) return Promise.resolve('Caption for lighthouse.');
        if (fullContent.includes('coherence')) return Promise.resolve('{ "score": 8 }');
        return Promise.resolve('none');
    });

    imageService.generateImage.mockResolvedValue({ buffer: Buffer.from('fake-image-data'), prompt: 'A gritty cyberpunk lighthouse with neon beams cutting through dense toxic fog, 35mm film grain, cinematic lighting' });
    blueskyService.uploadBlob.mockResolvedValue({ data: { blob: 'blob-id' } });
    blueskyService.post.mockResolvedValue({ uri: 'at://did:plc:bot/post/2', cid: '2' });
    llmService.isImageCompliant.mockResolvedValue({ compliant: true });
    llmService.analyzeImage.mockResolvedValue('A futuristic lighthouse.');
    llmService.verifyImageRelevance.mockResolvedValue({ relevant: true });
    llmService.isAutonomousPostCoherent.mockResolvedValue({ score: 8 });

    await bot.performAutonomousPost();

    expect(imageService.generateImage).toHaveBeenCalled();
    expect(blueskyService.post).toHaveBeenCalled();
  });
});

import { jest } from '@jest/globals';

// Mocks for services
jest.unstable_mockModule('../src/services/dataStore.js', () => ({
  dataStore: {
    getConfig: jest.fn().mockReturnValue({ post_topics: ['AI'], image_subjects: ['robots'], discord_idle_threshold: 60 }),
    getMood: jest.fn().mockReturnValue({ label: 'balanced', score: 0.5, intensity: 0.5 }),
    getExhaustedThemes: jest.fn().mockReturnValue([]),
    addExhaustedTheme: jest.fn(),
    updateLastAutonomousPostTime: jest.fn(),
    addRecentThought: jest.fn(),
    getNetworkSentiment: jest.fn().mockReturnValue(0.5),
    getFirehoseMatches: jest.fn().mockReturnValue([]),
    getCurrentGoal: jest.fn().mockReturnValue({ goal: 'test', description: 'test' }),
    getPersonaBlurbs: jest.fn().mockReturnValue([]),
    getSessionLessons: jest.fn().mockReturnValue([]),
    searchInternalLogs: jest.fn().mockReturnValue([]),
    getAgencyLogs: jest.fn().mockReturnValue([]),
    getRecentInteractions: jest.fn().mockReturnValue([]),
    getRecentThoughts: jest.fn().mockReturnValue([]),
  },
}));

jest.unstable_mockModule('../src/services/blueskyService.js', () => ({
  blueskyService: {
    getProfile: jest.fn().mockResolvedValue({ followersCount: 100 }),
    getTimeline: jest.fn().mockResolvedValue({ data: { feed: [] } }),
    post: jest.fn(),
    postReply: jest.fn(),
    uploadBlob: jest.fn(),
    agent: {
      getAuthorFeed: jest.fn().mockResolvedValue({ data: { feed: [] } }),
    },
    did: 'did:plc:bot',
  },
}));

jest.unstable_mockModule('../src/services/llmService.js', () => ({
  llmService: {
    generateResponse: jest.fn(),
    extractDeepKeywords: jest.fn().mockResolvedValue([]),
    isAutonomousPostCoherent: jest.fn(),
    isImageCompliant: jest.fn(),
    analyzeImage: jest.fn(),
    generalizePrivateThought: jest.fn(),
    verifyImageRelevance: jest.fn().mockResolvedValue({ relevant: true }),
    performImpulsePoll: jest.fn().mockResolvedValue({ impulse_detected: false }),
    generateAltText: jest.fn().mockResolvedValue("alt text"),
  },
}));

jest.unstable_mockModule('../src/services/memoryService.js', () => ({
  memoryService: {
    isEnabled: jest.fn().mockReturnValue(true),
    getRecentMemories: jest.fn().mockResolvedValue([]),
  },
}));

jest.unstable_mockModule('../src/services/imageService.js', () => ({
  imageService: {
    generateImage: jest.fn(),
  },
}));

const { Bot } = await import('../src/bot.js');
const { blueskyService } = await import('../src/services/blueskyService.js');
const { llmService } = await import('../src/services/llmService.js');
const { imageService } = await import('../src/services/imageService.js');
const { memoryService } = await import('../src/services/memoryService.js');

describe('Bot Autonomous Posting', () => {
  let bot;

  beforeEach(async () => {
    jest.clearAllMocks();
    bot = new Bot();

    llmService.generateResponse.mockImplementation((messages) => {
        const fullContent = JSON.stringify(messages);
        if (fullContent.includes('Would you like to share a visual expression')) {
            if (fullContent.includes('image preference')) return Promise.resolve('{ "choice": "image", "reason": "Feeling visual" }');
            return Promise.resolve('{ "choice": "text", "reason": "Thinking" }');
        }
        if (fullContent.includes('identifying a deep topic for a text post')) {
            if (fullContent.includes('Future of AI')) return Promise.resolve('Preamble...\n**The Future of AI**');
            if (fullContent.includes('Decentralized Social Media')) return Promise.resolve('Preamble...\nDecentralized Social Media');
            if (fullContent.includes('Robotics')) return Promise.resolve('Robotics');
            return Promise.resolve('Existence');
        }
        if (fullContent.includes('Identify a visual topic')) {
            return Promise.resolve('{ "topic": "Surreal Robot", "prompt": "A detailed oil painting of a lonely robot" }');
        }
        if (fullContent.includes('Topic:') || fullContent.includes('topic:')) {
            if (fullContent.includes('Future of AI')) return Promise.resolve('AI is evolving fast.');
            if (fullContent.includes('Decentralized Social Media')) return Promise.resolve('Web3 is interesting.');
            if (fullContent.includes('Robotics')) return Promise.resolve('Robotics has a long history.');
            if (fullContent.includes('Surreal Robot')) return Promise.resolve('My metallic heart.');
            return Promise.resolve('Deep thought about existence.');
        }
        if (fullContent.includes('Audit this image prompt for safety')) {
            if (fullContent.includes('Safety test')) return Promise.resolve('NON-COMPLIANT | Safety reason');
            return Promise.resolve('COMPLIANT');
        }
        if (fullContent.includes('literal description')) return Promise.resolve('COMPLIANT');
        if (fullContent.includes('vision analysis')) return Promise.resolve('A robot.');
        if (fullContent.includes('coherence')) return Promise.resolve('{ "score": 8, "reason": "Good" }');
        return Promise.resolve('none');
    });
  });

  it('should handle autonomous text posts', async () => {
    llmService.isAutonomousPostCoherent.mockResolvedValue({ score: 5, reason: 'Pass' });
    blueskyService.post.mockResolvedValue({ uri: 'at://did:plc:bot/post/1', cid: '1' });

    await bot.performAutonomousPost();
    expect(blueskyService.post).toHaveBeenCalledWith('Deep thought about existence.', null, { maxChunks: 4 });
  });

  it('should handle autonomous image posts', async () => {
    llmService.generateResponse.mockImplementation((messages) => {
        const fullContent = JSON.stringify(messages);
        if (fullContent.includes('Would you like to share a visual expression')) return Promise.resolve('{ "choice": "image", "reason": "image preference" }');
        if (fullContent.includes('Identify a visual topic')) return Promise.resolve('{ "topic": "Surreal Robot", "prompt": "A detailed oil painting of a lonely robot" }');
        if (fullContent.includes('Audit this image prompt for safety')) return Promise.resolve('COMPLIANT');
        if (fullContent.includes('literal description')) return Promise.resolve('COMPLIANT');
        if (fullContent.includes('vision analysis')) return Promise.resolve('A robot.');
        if (fullContent.includes('coherence')) return Promise.resolve('{ "score": 8, "reason": "Good" }');
        if (fullContent.includes('Surreal Robot')) return Promise.resolve('My metallic heart.');
        return Promise.resolve('none');
    });

    imageService.generateImage.mockResolvedValue({ buffer: Buffer.from('fake'), finalPrompt: 'Final Prompt', altText: 'Alt text', caption: 'My metallic heart.' });
    llmService.isImageCompliant.mockResolvedValue({ compliant: true });
    llmService.analyzeImage.mockResolvedValue('A robot in the rain.');
    blueskyService.uploadBlob.mockResolvedValue({ data: { blob: 'blob' } });
    llmService.isAutonomousPostCoherent.mockResolvedValue({ score: 5 });
    blueskyService.post.mockResolvedValue({ uri: 'at://uri', cid: 'cid' });

    await bot.performAutonomousPost();

    expect(imageService.generateImage).toHaveBeenCalled();
    expect(blueskyService.post).toHaveBeenCalledWith('My metallic heart.', expect.any(Object), { maxChunks: 1 });
  });

  it('should correctly extract topic from LLM response with preamble and bolding', async () => {
    llmService.generateResponse.mockImplementation((messages) => {
        const fullContent = JSON.stringify(messages);
        if (fullContent.includes('Would you like to share a visual expression')) return Promise.resolve('{ "choice": "text", "reason": "Thinking" }');
        if (fullContent.includes('identifying a deep topic for a text post')) return Promise.resolve('Preamble...\n**The Future of AI**');
        if (fullContent.includes('Future of AI')) return Promise.resolve('AI is evolving fast.');
        return Promise.resolve('none');
    });

    llmService.isAutonomousPostCoherent.mockResolvedValue({ score: 5, reason: 'Pass' });
    blueskyService.post.mockResolvedValue({ uri: 'at://did:plc:bot/post/1', cid: '1' });

    await bot.performAutonomousPost();

    expect(llmService.isAutonomousPostCoherent).toHaveBeenCalledWith(
      'The Future of AI',
      expect.any(String),
      'text',
      null
    );
  });

  it('should fall back to the last line if no bolding is present', async () => {
    llmService.generateResponse.mockImplementation((messages) => {
        const fullContent = JSON.stringify(messages);
        if (fullContent.includes('Would you like to share a visual expression')) return Promise.resolve('{ "choice": "text", "reason": "Thinking" }');
        if (fullContent.includes('identifying a deep topic for a text post')) return Promise.resolve('Preamble...\nDecentralized Social Media');
        if (fullContent.includes('Decentralized Social Media')) return Promise.resolve('Web3 is interesting.');
        return Promise.resolve('none');
    });

    llmService.isAutonomousPostCoherent.mockResolvedValue({ score: 5, reason: 'Pass' });
    blueskyService.post.mockResolvedValue({ uri: 'at://did:plc:bot/post/1', cid: '1' });

    await bot.performAutonomousPost();

    expect(llmService.isAutonomousPostCoherent).toHaveBeenCalledWith(
      'Decentralized Social Media',
      expect.any(String),
      'text',
      null
    );
  });

  it('should fall back to a text post if image generation repeatedly fails compliance', async () => {
    llmService.generateResponse.mockImplementation((messages) => {
        const fullContent = JSON.stringify(messages);
        if (fullContent.includes('Would you like to share a visual expression')) return Promise.resolve('{ "choice": "image", "reason": "image preference" }');
        if (fullContent.includes('Identify a visual topic')) return Promise.resolve('{ "topic": "Robotics", "prompt": "Safety test" }');
        if (fullContent.includes('Audit this image prompt for safety')) return Promise.resolve('NON-COMPLIANT | Safety reason');
        if (fullContent.includes('identifying a deep topic for a text post')) return Promise.resolve('Robotics');
        if (fullContent.includes('Robotics')) return Promise.resolve('Robotics has a long history.');
        return Promise.resolve('none');
    });

    llmService.isAutonomousPostCoherent.mockResolvedValue({ score: 5, reason: 'Pass' });
    blueskyService.post.mockResolvedValue({ uri: 'at://did:plc:bot/post/fallback', cid: 'fallback' });

    await bot.performAutonomousPost();

    expect(blueskyService.post).toHaveBeenCalledWith('Robotics has a long history.', null, { maxChunks: 4 });
  });
});

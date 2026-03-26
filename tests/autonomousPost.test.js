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
  });

  it('should handle autonomous text posts', async () => {
    // Mock for initial text choice
    llmService.generateResponse.mockImplementation((messages) => {
        const content = JSON.stringify(messages);
        if (content.includes('Would you like to share a visual expression')) return Promise.resolve('{ "choice": "text", "reason": "Thinking" }');
        if (content.includes('Identify a deep topic for a text post')) return Promise.resolve('Existence');
        if (content.includes('Topic: Existence')) return Promise.resolve('Deep thought about existence.');
        return Promise.resolve('none');
    });

    llmService.isAutonomousPostCoherent.mockResolvedValue({ score: 5, reason: 'Pass' });
    blueskyService.post.mockResolvedValue({ uri: 'at://did:plc:bot/post/1', cid: '1' });

    await bot.performAutonomousPost();

    expect(blueskyService.post).toHaveBeenCalledWith('Deep thought about existence.', null, { maxChunks: 3 });
  });

  it('should handle autonomous image posts', async () => {
    // Mock for initial image choice
    llmService.generateResponse.mockImplementation((messages) => {
        const content = JSON.stringify(messages);
        if (content.includes('Would you like to share a visual expression')) return Promise.resolve('{ "choice": "image", "reason": "Feeling visual" }');
        if (content.includes('Identify a visual topic for an image generation')) return Promise.resolve('{ "topic": "Surreal Robot", "prompt": "A detailed oil painting of a lonely robot in a neon city" }');
        if (content.includes('Audit this image prompt for safety')) return Promise.resolve('COMPLIANT');
        if (content.includes('Generate a highly descriptive, artistic image prompt based on the topic')) return Promise.resolve('A detailed oil painting of a lonely robot in a neon city');
        if (content.includes('generate a concise, descriptive alt-text')) return Promise.resolve('Alt text');
        if (content.includes('Generate a caption that reflects your persona')) return Promise.resolve('My metallic heart.');
        return Promise.resolve('none');
    });

    imageService.generateImage.mockResolvedValue({ buffer: Buffer.from('fake'), finalPrompt: 'Final Prompt' });
    llmService.isImageCompliant.mockResolvedValue({ compliant: true });
    llmService.analyzeImage.mockResolvedValue('A robot in the rain.');
    blueskyService.uploadBlob.mockResolvedValue({ data: { blob: 'blob' } });
    llmService.isAutonomousPostCoherent.mockResolvedValue({ score: 5 });
    blueskyService.post.mockResolvedValue({ uri: 'at://uri', cid: 'cid' });

    await bot.performAutonomousPost();

    expect(imageService.generateImage).toHaveBeenCalled();
    expect(blueskyService.post).toHaveBeenCalledWith('My metallic heart.', expect.any(Object), { maxChunks: 3 });
    expect(blueskyService.postReply).toHaveBeenCalledWith(expect.any(Object), 'Generation Prompt: Final Prompt');
  });

  it('should correctly extract topic from LLM response with preamble and bolding', async () => {
    // Mock for text choice and complex topic extraction
    llmService.generateResponse.mockImplementation((messages) => {
        const content = JSON.stringify(messages);
        if (content.includes('Would you like to share a visual expression')) return Promise.resolve('{ "choice": "text", "reason": "Thinking" }');
        if (content.includes('Identify a deep topic for a text post')) return Promise.resolve('Based on the feed, here is a topic:\n\n**The Future of AI**');
        if (content.includes('Topic: The Future of AI')) return Promise.resolve('Post Content');
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
    // Mock for text choice and multi-line topic extraction without bolding
    llmService.generateResponse.mockImplementation((messages) => {
        const content = JSON.stringify(messages);
        if (content.includes('Would you like to share a visual expression')) return Promise.resolve('{ "choice": "text", "reason": "Thinking" }');
        if (content.includes('Identify a deep topic for a text post')) return Promise.resolve('I analyzed the feed and decided on:\nDecentralized Social Media');
        if (content.includes('Topic: Decentralized Social Media')) return Promise.resolve('Post Content');
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
    // Mock for image choice but persistent safety failure
    llmService.generateResponse.mockImplementation((messages) => {
        const content = JSON.stringify(messages);
        if (content.includes('Would you like to share a visual expression')) return Promise.resolve('{ "choice": "image", "reason": "Feeling visual" }');
        if (content.includes('Identify a visual topic for an image generation')) return Promise.resolve('{ "topic": "Robot Art", "prompt": "A robot painting" }');
        if (content.includes('Audit this image prompt for safety')) return Promise.resolve('NON-COMPLIANT | Safety reason');
        if (content.includes('Identify a deep topic for a text post')) return Promise.resolve('History of Robotics');
        if (content.includes('Topic: History of Robotics')) return Promise.resolve('Robotics has a long history.');
        return Promise.resolve('none');
    });

    llmService.isAutonomousPostCoherent.mockResolvedValue({ score: 5, reason: 'Pass' });
    blueskyService.post.mockResolvedValue({ uri: 'at://did:plc:bot/post/fallback', cid: 'fallback' });

    await bot.performAutonomousPost();

    // Since it failed safety audit for image, it should fall back to text
    expect(blueskyService.post).toHaveBeenCalledWith('Robotics has a long history.', null, { maxChunks: 3 });
  });
});

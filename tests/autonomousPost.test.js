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
    // Force 'text' choice in persona poll
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
    // Force 'image' choice in persona poll
    llmService.generateResponse.mockImplementation((messages) => {
        const content = JSON.stringify(messages);
        if (content.includes('Would you like to share a visual expression')) return Promise.resolve('{ "choice": "image", "reason": "Feeling visual" }');
        if (content.includes('You are brainstorming a visual expression')) return Promise.resolve('{ "topic": "Surreal Robot", "prompt": "A painting of a sad robot" }');
        if (content.includes('Audit this image prompt for safety')) return Promise.resolve('COMPLIANT');
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
});

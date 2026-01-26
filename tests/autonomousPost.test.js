import { jest } from '@jest/globals';

jest.setTimeout(20000);

jest.unstable_mockModule('../src/services/blueskyService.js', () => ({
  blueskyService: {
    agent: {
      getAuthorFeed: jest.fn().mockResolvedValue({ data: { feed: [] } }),
      post: jest.fn(),
      uploadBlob: jest.fn(),
    },
    authenticate: jest.fn(),
    submitAutonomyDeclaration: jest.fn(),
    getTimeline: jest.fn().mockResolvedValue([]),
    post: jest.fn(),
    postReply: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/services/llmService.js', () => ({
  llmService: {
    generateResponse: jest.fn(),
    isAutonomousPostCoherent: jest.fn(),
    analyzeImage: jest.fn(),
    isImageCompliant: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/services/dataStore.js', () => ({
  dataStore: {
    init: jest.fn(),
    db: {
      data: {
        interactions: []
      }
    }
  },
}));

jest.unstable_mockModule('../src/services/wikipediaService.js', () => ({
  wikipediaService: {
    searchArticle: jest.fn(),
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

describe('Bot Autonomous Posting', () => {
  let bot;

  beforeEach(async () => {
    jest.clearAllMocks();
    bot = new Bot();
  });

  it('should correctly extract topic from LLM response with preamble and bolding', async () => {
    // Mock the feed to allow posting
    blueskyService.agent.getAuthorFeed.mockResolvedValue({ data: { feed: [] } });
    blueskyService.getTimeline.mockResolvedValue([]);

    // Mock topic identification with a preamble and bolding
    llmService.generateResponse.mockResolvedValueOnce(`Based on the provided Network Buzz, here is a topic:

**The Future of AI**`);

    // Mock other calls to satisfy the flow
    llmService.generateResponse.mockResolvedValue('none'); // mention check
    llmService.generateResponse.mockResolvedValue('Post Content'); // post generation
    llmService.isAutonomousPostCoherent.mockResolvedValue({ score: 5, reason: 'Pass' });
    blueskyService.post.mockResolvedValue({ uri: 'at://did:plc:bot/post/1', cid: '1' });

    // Mock Math.random to always pick 'text' post
    const spyRandom = jest.spyOn(Math, 'random').mockReturnValue(0.1);

    await bot.performAutonomousPost();

    expect(llmService.isAutonomousPostCoherent).toHaveBeenCalledWith(
      'The Future of AI',
      expect.any(String),
      'text',
      null
    );

    spyRandom.mockRestore();
  });

  it('should fall back to the last line if no bolding is present', async () => {
    blueskyService.agent.getAuthorFeed.mockResolvedValue({ data: { feed: [] } });
    blueskyService.getTimeline.mockResolvedValue([]);

    llmService.generateResponse.mockResolvedValueOnce(`I analyzed the feed and decided on:
Decentralized Social Media`);

    llmService.generateResponse.mockResolvedValue('none');
    llmService.generateResponse.mockResolvedValue('Post Content');
    llmService.isAutonomousPostCoherent.mockResolvedValue({ score: 5, reason: 'Pass' });
    blueskyService.post.mockResolvedValue({ uri: 'at://did:plc:bot/post/1', cid: '1' });

    const spyRandom = jest.spyOn(Math, 'random').mockReturnValue(0.1);

    await bot.performAutonomousPost();

    expect(llmService.isAutonomousPostCoherent).toHaveBeenCalledWith(
      'Decentralized Social Media',
      expect.any(String),
      'text',
      null
    );

    spyRandom.mockRestore();
  });

  it('should handle autonomous image posts and convert abstract topic to literal prompt', async () => {
    blueskyService.agent.getAuthorFeed.mockResolvedValue({ data: { feed: [] } });
    blueskyService.getTimeline.mockResolvedValue([]);

    const topic = 'The Intersection of Technology and Human Vulnerability';
    const literalPrompt = 'A rusted robotic hand holding a glowing blue flower in a cyberpunk alley.';
    const postContent = 'Here is a thought about technology.';
    const altText = 'Accessible alt text';

    llmService.generateResponse
      .mockResolvedValueOnce(topic) // Topic identification
      .mockResolvedValueOnce('none') // mention check
      .mockResolvedValueOnce(altText) // alt text generation
      .mockResolvedValueOnce(postContent); // post content generation

    imageService.generateImage.mockResolvedValue({
      buffer: Buffer.from('fake-image'),
      finalPrompt: literalPrompt
    });

    llmService.isImageCompliant.mockResolvedValue({ compliant: true, reason: null });

    llmService.analyzeImage.mockResolvedValue('A robotic hand with a flower.');
    blueskyService.agent.uploadBlob.mockResolvedValue({ data: { blob: 'blob-ref' } });

    llmService.isAutonomousPostCoherent.mockResolvedValue({ score: 5, reason: 'Pass' });
    blueskyService.post.mockResolvedValue({ uri: 'at://did:plc:bot/post/img1', cid: 'img1' });

    // Mock Math.random to pick 'image' post
    const spyRandom = jest.spyOn(Math, 'random').mockReturnValue(0.4); // postTypes[1] is 'image'

    await bot.performAutonomousPost();

    expect(imageService.generateImage).toHaveBeenCalledWith(topic, { allowPortraits: false });
    expect(blueskyService.post).toHaveBeenCalledWith(
      'Here is a thought about technology.',
      expect.objectContaining({
        $type: 'app.bsky.embed.images',
        images: [expect.objectContaining({ alt: 'Accessible alt text' })]
      }),
      { maxChunks: 3 }
    );

    // Check if the generation prompt reply was posted with the LITERAL prompt
    expect(blueskyService.postReply).toHaveBeenCalledWith(
      { uri: 'at://did:plc:bot/post/img1', cid: 'img1', record: {} },
      `Generation Prompt: ${literalPrompt}`
    );

    spyRandom.mockRestore();
  });
});

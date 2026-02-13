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
    getProfile: jest.fn().mockResolvedValue({ followersCount: 1234, did: 'did:plc:bot' }),
    did: 'did:plc:bot',
  },
}));

jest.unstable_mockModule('../src/services/llmService.js', () => ({
  llmService: {
    generateResponse: jest.fn(),
    isAutonomousPostCoherent: jest.fn(),
    analyzeImage: jest.fn(),
    isImageCompliant: jest.fn(),
    checkVariety: jest.fn().mockResolvedValue({ repetitive: false, score: 1.0 }),
    isPersonaAligned: jest.fn().mockResolvedValue({ aligned: true, feedback: null }),
    performAgenticPlanning: jest.fn().mockResolvedValue({ strategy: { angle: 'natural', tone: 'conversational', theme: 'test' }, actions: [] }),
    evaluateAndRefinePlan: jest.fn().mockImplementation((plan) => Promise.resolve({ decision: 'engage', refined_actions: plan.actions, reason: 'Engaging for test' })),
    evaluateIntentionality: jest.fn().mockResolvedValue({ decision: 'engage', reason: 'Engaging for test' }),
    shouldIncludeSensory: jest.fn().mockResolvedValue(false),
    performInternalResearch: jest.fn(),
    generateDrafts: jest.fn(),
    selectBestResult: jest.fn(),
    performInternalInquiry: jest.fn().mockResolvedValue('Some internal reflection.'),
    isUrlSafe: jest.fn().mockResolvedValue({ safe: true }),
  },
}));

jest.unstable_mockModule('../src/services/socialHistoryService.js', () => ({
  socialHistoryService: {
    getHierarchicalSummary: jest.fn().mockResolvedValue({ shortTerm: 'recent', dailyNarrative: 'today' }),
  },
}));

jest.unstable_mockModule('../src/services/memoryService.js', () => ({
  memoryService: {
    getLatestMoodMemory: jest.fn().mockResolvedValue(null),
    formatMemoriesForPrompt: jest.fn().mockReturnValue('No recent memories.'),
    isEnabled: jest.fn().mockReturnValue(true),
  },
}));

jest.unstable_mockModule('../src/services/moltbookService.js', () => ({
  moltbookService: {
    getIdentityKnowledge: jest.fn().mockReturnValue('Some knowledge.'),
  },
}));

jest.unstable_mockModule('../src/services/googleSearchService.js', () => ({
  googleSearchService: {
    search: jest.fn().mockResolvedValue([]),
  },
}));

jest.unstable_mockModule('../src/services/webReaderService.js', () => ({
  webReaderService: {
    fetchContent: jest.fn().mockResolvedValue('Some web content.'),
  },
}));

jest.unstable_mockModule('../src/services/dataStore.js', () => ({
  dataStore: {
    init: jest.fn(),
    getBlueskyInstructions: jest.fn().mockReturnValue(''),
    getPersonaUpdates: jest.fn().mockReturnValue(''),
    getLatestInteractions: jest.fn().mockReturnValue([]),
    getRecentThoughts: jest.fn().mockReturnValue([]),
    addRecentThought: jest.fn(),
    getExhaustedThemes: jest.fn().mockReturnValue([]),
    addExhaustedTheme: jest.fn(),
    getAdminDid: jest.fn().mockReturnValue('did:plc:admin'),
    setAdminDid: jest.fn(),
    getMood: jest.fn().mockReturnValue({ label: 'neutral', valence: 0, arousal: 0, stability: 0 }),
    updateMood: jest.fn(),
    getRefusalCounts: jest.fn().mockReturnValue({ bluesky: 0, discord: 0, moltbook: 0, global: 0 }),
    incrementRefusalCount: jest.fn(),
    resetRefusalCount: jest.fn(),
    isResting: jest.fn().mockReturnValue(false),
    isLurkerMode: jest.fn().mockReturnValue(false),
    getLastAutonomousPostTime: jest.fn().mockReturnValue(null),
    updateLastAutonomousPostTime: jest.fn(),
    getNewsSearchesToday: jest.fn().mockReturnValue(0),
    incrementNewsSearchCount: jest.fn(),
    addPostContinuation: jest.fn(),
    getPostContinuations: jest.fn().mockReturnValue([]),
    removePostContinuation: jest.fn(),
    updateCooldowns: jest.fn(),
    getConfig: jest.fn().mockReturnValue({
      bluesky_daily_text_limit: 20,
      bluesky_daily_image_limit: 5,
      bluesky_daily_wiki_limit: 5,
      bluesky_post_cooldown: 45,
      moltbook_post_cooldown: 30,
      discord_idle_threshold: 10,
      max_thread_chunks: 3,
      repetition_similarity_threshold: 0.4,
      post_topics: ['Technology', 'Art'],
      image_subjects: ['The Intersection of Technology and Human Vulnerability', 'Human Portraits in Art']
    }),
    updateConfig: jest.fn().mockResolvedValue(true),
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
const { socialHistoryService } = await import('../src/services/socialHistoryService.js');
const { imageService } = await import('../src/services/imageService.js');
const { memoryService } = await import('../src/services/memoryService.js');

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

    // Mock Math.random to always pick 'text' post (postType selection happens before topic identification)
    const spyRandom = jest.spyOn(Math, 'random').mockReturnValue(0.1);

    // Mock topic identification with a preamble and bolding
    llmService.generateResponse.mockImplementation((messages) => {
        const content = messages.map(m => m.content).join(' ');
        if (content.includes('Determine the overall valence and arousal')) return Promise.resolve('{ "valence": 0.5, "arousal": 0.5 }');
        if (content.includes('TOPIC CLUSTERING')) return Promise.resolve(`Based on the provided Network Buzz, here is a topic:\n\n**The Future of AI**`);
        if (content.includes('identify if any of the following users have had a meaningful persistent discussion')) return Promise.resolve('none');
        if (content.includes('Generate a standalone post about the topic')) return Promise.resolve('Post Content');
        if (content.includes('Generate a second part of this realization')) return Promise.resolve('NONE');
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

    spyRandom.mockRestore();
  });

  it('should fall back to the last line if no bolding is present', async () => {
    blueskyService.agent.getAuthorFeed.mockResolvedValue({ data: { feed: [] } });
    blueskyService.getTimeline.mockResolvedValue([]);

    const spyRandom = jest.spyOn(Math, 'random').mockReturnValue(0.1);

    llmService.generateResponse.mockImplementation((messages) => {
        const content = messages.map(m => m.content).join(' ');
        if (content.includes('Determine the overall valence and arousal')) return Promise.resolve('{ "valence": 0.5, "arousal": 0.5 }');
        if (content.includes('TOPIC CLUSTERING')) return Promise.resolve(`I analyzed the feed and decided on:\nDecentralized Social Media`);
        if (content.includes('identify if any of the following users have had a meaningful persistent discussion')) return Promise.resolve('none');
        if (content.includes('Generate a standalone post about the topic')) return Promise.resolve('Post Content');
        if (content.includes('Generate a second part of this realization')) return Promise.resolve('NONE');
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

    spyRandom.mockRestore();
  });

  it('should handle autonomous image posts and convert abstract topic to literal prompt', async () => {
    blueskyService.agent.getAuthorFeed.mockResolvedValue({ data: { feed: [] } });
    blueskyService.getTimeline.mockResolvedValue([]);

    const topic = 'The Intersection of Technology and Human Vulnerability';
    const literalPrompt = 'A rusted robotic hand holding a glowing blue flower in a cyberpunk alley.';
    const postContent = 'Here is a thought about technology.';
    const altText = 'Accessible alt text';

    // Mock Math.random to pick 'image' post (index 1 in [text, image, news])
    const spyRandom = jest.spyOn(Math, 'random').mockReturnValue(0.4);

    llmService.generateResponse.mockImplementation((messages) => {
        const content = messages.map(m => m.content).join(' ');
        if (content.includes('Determine the overall valence and arousal')) return Promise.resolve('{ "valence": 0.5, "arousal": 0.5 }');
        if (content.includes('identifying a subject for an autonomous post containing an image')) return Promise.resolve(topic);
        if (content.includes('identify if any of the following users have had a meaningful persistent discussion')) return Promise.resolve('none');
        if (content.includes('Identify an artistic style for an image')) return Promise.resolve('glitch-noir');
        if (content.includes('Create a concise and accurate alt-text')) return Promise.resolve(altText);
        if (content.includes('Write a post about why you chose to generate this image')) return Promise.resolve(postContent);
        if (content.includes('Generate a second part of this realization')) return Promise.resolve('NONE');
        return Promise.resolve('none');
    });

    imageService.generateImage.mockResolvedValue({
      buffer: Buffer.from('fake-image'),
      finalPrompt: literalPrompt
    });

    llmService.isImageCompliant.mockResolvedValue({ compliant: true, reason: null });
    llmService.analyzeImage.mockResolvedValue('A robotic hand with a flower.');
    blueskyService.agent.uploadBlob.mockResolvedValue({ data: { blob: 'blob-ref' } });

    llmService.isAutonomousPostCoherent.mockResolvedValue({ score: 5, reason: 'Pass' });
    blueskyService.post.mockResolvedValue({ uri: 'at://did:plc:bot/post/img1', cid: 'img1' });

    await bot.performAutonomousPost();

    expect(imageService.generateImage).toHaveBeenCalledWith(
      expect.stringContaining(topic),
      expect.objectContaining({ allowPortraits: false, feedback: '', mood: expect.any(Object) })
    );
    expect(llmService.isImageCompliant).toHaveBeenCalled();
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

  it('should fall back to a text post if image generation repeatedly fails compliance', async () => {
    blueskyService.agent.getAuthorFeed.mockResolvedValue({ data: { feed: [] } });
    blueskyService.getTimeline.mockResolvedValue([]);

    const topic = 'Human Portraits in Art';
    const fallbackText = 'I decided to write about the history of portraiture instead.';

    // Mock Math.random to pick 'image' post (index 1 in [text, image, news])
    const spyRandom = jest.spyOn(Math, 'random').mockReturnValue(0.4);

    llmService.generateResponse.mockImplementation((messages) => {
        const content = messages[0].content;
        if (content.includes('Determine the overall valence and arousal')) return Promise.resolve('{ "valence": 0.5, "arousal": 0.5 }');
        if (content.includes('identifying a subject for an autonomous post containing an image')) return Promise.resolve(topic);
        if (content.includes('identify if any of the following users have had a meaningful persistent discussion')) return Promise.resolve('none');
        if (content.includes('Identify an artistic style for an image')) return Promise.resolve('glitch-noir');
        if (content.includes('Generate a standalone post about the topic')) return Promise.resolve(fallbackText);
        if (content.includes('Generate a second part of this realization')) return Promise.resolve('NONE');
        return Promise.resolve('none');
    });

    // Image generation succeeds but fails compliance
    imageService.generateImage.mockResolvedValue({
      buffer: Buffer.from('fake-image'),
      finalPrompt: 'A close up of a human face.'
    });

    llmService.isImageCompliant.mockResolvedValue({ compliant: false, reason: 'Contains a human portrait.' });

    // Mock coherence check for the fallback text
    llmService.isAutonomousPostCoherent.mockResolvedValue({ score: 5, reason: 'Pass' });

    await bot.performAutonomousPost();

    // Should have tried image generation 5 times (as configured in Bot.performAutonomousPost)
    expect(imageService.generateImage).toHaveBeenCalledTimes(5);
    expect(llmService.isImageCompliant).toHaveBeenCalledTimes(5);

    // Should have fallen back to text
    expect(llmService.generateResponse).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ content: expect.stringContaining('NOTE: Your previous attempt to generate an image for this topic failed compliance') })]),
        expect.any(Object)
    );

    expect(blueskyService.post).toHaveBeenCalledWith(
      expect.stringContaining(fallbackText),
      null,
      { maxChunks: 3 }
    );

    spyRandom.mockRestore();
  });
});

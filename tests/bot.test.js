import { jest } from '@jest/globals';

jest.setTimeout(20000);

jest.unstable_mockModule('../src/services/blueskyService.js', () => ({
  blueskyService: {
    getNotifications: jest.fn(),
    updateSeen: jest.fn(),
    getProfile: jest.fn(),
    getUserPosts: jest.fn(),
    postReply: jest.fn(),
    getDetailedThread: jest.fn(),
    getPostDetails: jest.fn(),
    getPastInteractions: jest.fn(),
    likePost: jest.fn(),
    authenticate: jest.fn(),
    submitAutonomyDeclaration: jest.fn(),
    postAlert: jest.fn(),
    deletePost: jest.fn(),
    getExternalEmbed: jest.fn(),
    hasBotRepliedTo: jest.fn(),
    agent: {
      getAuthorFeed: jest.fn().mockResolvedValue({ data: { feed: [] } }),
      post: jest.fn(),
    },
  },
}));

jest.unstable_mockModule('../src/services/llmService.js', () => ({
  llmService: {
    detectPromptInjection: jest.fn(),
    analyzeUserIntent: jest.fn(),
    isPostSafe: jest.fn(),
    isReplyRelevant: jest.fn(),
    isFactCheckNeeded: jest.fn(),
    extractClaim: jest.fn(),
    generateResponse: jest.fn(),
    checkSemanticLoop: jest.fn(),
    isResponseSafe: jest.fn(),
    rateUserInteraction: jest.fn(),
    analyzeImage: jest.fn(),
    shouldLikePost: jest.fn(),
    isReplyCoherent: jest.fn(),
    selectBestResult: jest.fn(),
    validateResultRelevance: jest.fn(),
    evaluateConversationVibe: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/services/dataStore.js', () => ({
  dataStore: {
    hasReplied: jest.fn(),
    addRepliedPost: jest.fn(),
    isBlocked: jest.fn(),
    isThreadMuted: jest.fn(),
    muteThread: jest.fn(),
    muteBranch: jest.fn(),
    getMutedBranchInfo: jest.fn(),
    getConversationLength: jest.fn(),
    updateConversationLength: jest.fn(),
    saveInteraction: jest.fn(),
    getInteractionsByUser: jest.fn(),
    updateUserRating: jest.fn(),
    updateUserSummary: jest.fn(),
    getUserSummary: jest.fn(),
    init: jest.fn(),
    db: {
      data: {
        interactions: []
      }
    }
  },
}));

jest.unstable_mockModule('../src/services/googleSearchService.js', () => ({
  googleSearchService: {
    search: jest.fn().mockResolvedValue([]),
    searchRepo: jest.fn().mockResolvedValue([]),
  },
}));

jest.unstable_mockModule('../src/services/wikipediaService.js', () => ({
  wikipediaService: {
    searchArticle: jest.fn(),
    getRandomArticle: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/services/youtubeService.js', () => ({
  youtubeService: {
    search: jest.fn(),
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
const { dataStore } = await import('../src/services/dataStore.js');
const { googleSearchService } = await import('../src/services/googleSearchService.js');
const { wikipediaService } = await import('../src/services/wikipediaService.js');
const { youtubeService } = await import('../src/services/youtubeService.js');
import config from '../config.js';

describe('Bot', () => {
  let bot;

  beforeEach(async () => {
    jest.clearAllMocks();
    bot = new Bot();
    await bot.init(); // To load readme, etc.

    // Default mocks for common behavior
    llmService.generateResponse.mockImplementation((messages) => {
      const systemContent = messages[0].content || '';
      if (systemContent.includes('intent detection AI')) return Promise.resolve('no');
      if (systemContent.includes('gatekeeper')) return Promise.resolve('true');
      return Promise.resolve('Test response');
    });
    llmService.isPostSafe.mockResolvedValue({ safe: true });
    llmService.isResponseSafe.mockResolvedValue({ safe: true });
    llmService.isFactCheckNeeded.mockResolvedValue(false);
    llmService.analyzeUserIntent.mockResolvedValue({ highRisk: false, reason: 'Friendly' });
    llmService.isReplyCoherent.mockResolvedValue(true);
    llmService.evaluateConversationVibe.mockResolvedValue({ status: 'healthy' });
    llmService.checkSemanticLoop.mockResolvedValue(false);
    llmService.shouldLikePost.mockResolvedValue(false);
    llmService.rateUserInteraction.mockResolvedValue(3);

    blueskyService.getProfile.mockResolvedValue({ handle: 'user.bsky.social', description: 'Test bio' });
    blueskyService.getUserPosts.mockResolvedValue([]);
    blueskyService.getPastInteractions.mockResolvedValue([]);
    blueskyService.postReply.mockResolvedValue({ uri: 'at://did:plc:bot/post/1' });
    blueskyService.hasBotRepliedTo.mockResolvedValue(false);

    dataStore.hasReplied.mockReturnValue(false);
    dataStore.isBlocked.mockReturnValue(false);
    dataStore.isThreadMuted.mockReturnValue(false);
    dataStore.getMutedBranchInfo.mockReturnValue(null);
    dataStore.getConversationLength.mockReturnValue(1);
    dataStore.getInteractionsByUser.mockReturnValue([]);
    dataStore.getUserSummary.mockReturnValue(null);

    wikipediaService.searchArticle.mockResolvedValue([]);
    youtubeService.search.mockResolvedValue([]);
  });

  it('should reply to a follow-up comment on its own post without a direct mention', async () => {
    const mockNotif = {
      isRead: false,
      uri: 'at://did:plc:123/app.bsky.feed.post/456',
      reason: 'reply',
      record: {
        $type: 'app.bsky.feed.post',
        text: 'This is a follow-up comment.',
        reply: {
          root: { uri: 'at://did:plc:123/app.bsky.feed.post/111' },
          parent: { uri: 'at://did:plc:bot/app.bsky.feed.post/222' }
        }
      },
      author: { handle: 'user.bsky.social' },
      indexedAt: new Date().toISOString()
    };

    const mockThreadContext = [
      { author: 'another.user', text: 'Original post' },
      { author: config.BLUESKY_IDENTIFIER, text: 'Bot reply' },
      { author: 'user.bsky.social', text: 'This is a follow-up comment.' }
    ];
    // The current post being processed is the last one in the context.
    // To simulate that the bot HAS NOT replied to THIS specific comment yet,
    // we ensure there's no bot reply AFTER the last user comment.

    dataStore.hasReplied.mockReturnValue(false);
    bot._getThreadHistory = jest.fn().mockResolvedValue(mockThreadContext);
    llmService.isPostSafe.mockResolvedValue({ safe: true });
    llmService.generateResponse.mockResolvedValue('This is a test response.');
    llmService.shouldLikePost.mockResolvedValue(false);
    llmService.isResponseSafe.mockResolvedValue({ safe: true });
    llmService.rateUserInteraction.mockResolvedValue(4);
    blueskyService.getProfile.mockResolvedValue({ description: 'A test user' });
    blueskyService.getUserPosts.mockResolvedValue([]);
    llmService.analyzeUserIntent.mockResolvedValue({ highRisk: false });
    llmService.isReplyCoherent.mockResolvedValue(true);
    dataStore.getInteractionsByUser.mockReturnValue([]);

    await bot.processNotification(mockNotif);

    expect(bot._getThreadHistory).toHaveBeenCalledWith(mockNotif.uri);
    expect(llmService.generateResponse).toHaveBeenCalled();
    expect(blueskyService.postReply).toHaveBeenCalled();
  });

  describe('catchUpNotifications', () => {
    it('should process unread, actionable notifications and then update seen status', async () => {
      const mockNotifications = [
        // 1. A new, unread mention - SHOULD be processed
        {
          uri: 'at://did:plc:1/app.bsky.feed.post/1',
          isRead: false,
          reason: 'mention',
          author: { handle: 'user1.bsky.social' },
          record: { text: 'Hello @bot' },
          indexedAt: new Date().toISOString()
        },
        // 2. An unread reply - SHOULD be processed
        {
          uri: 'at://did:plc:2/app.bsky.feed.post/2',
          isRead: false,
          reason: 'reply',
          author: { handle: 'user2.bsky.social' },
          record: { text: 'Nice post' },
          indexedAt: new Date().toISOString()
        },
        // 3. An unread quote repost - SHOULD be processed
        {
          uri: 'at://did:plc:3/app.bsky.feed.post/3',
          isRead: false,
          reason: 'quote',
          author: { handle: 'user3.bsky.social' },
          record: { text: 'Cool bot' },
          indexedAt: new Date().toISOString()
        },
        // 4. A notification that has already been replied to - SHOULD be skipped
        {
          uri: 'at://did:plc:4/app.bsky.feed.post/4',
          isRead: false,
          reason: 'mention',
          author: { handle: 'user3.bsky.social' },
          record: { text: 'Hi again' },
          indexedAt: new Date().toISOString()
        },
        // 4. A notification that is already read - SHOULD be skipped
        {
          uri: 'at://did:plc:4/app.bsky.feed.post/4',
          isRead: true,
          reason: 'mention',
          author: { handle: 'user4.bsky.social' },
          record: { text: 'You missed this' },
          indexedAt: new Date().toISOString()
        },
        // 5. A non-actionable notification (like) - SHOULD be skipped
        {
          uri: 'at://did:plc:5/app.bsky.feed.post/5',
          isRead: false,
          reason: 'like',
          author: { handle: 'user5.bsky.social' },
          record: {},
          indexedAt: new Date().toISOString()
        },
      ];

      // Setup mocks
      blueskyService.getNotifications.mockResolvedValueOnce({
        notifications: mockNotifications,
        cursor: undefined, // Simulate end of notifications
      });

      // Mock hasReplied: true for the fourth notification
      dataStore.hasReplied.mockImplementation(uri => uri === 'at://did:plc:4/app.bsky.feed.post/4');

      // Mock processNotification to avoid its internal logic, just track calls
      bot.processNotification = jest.fn().mockResolvedValue(true);

      // Run the catch-up process
      await bot.catchUpNotifications();

      // Assertions
      // It should try to process the three valid notifications
      expect(bot.processNotification).toHaveBeenCalledTimes(3);
      expect(bot.processNotification).toHaveBeenCalledWith(mockNotifications[0]);
      expect(bot.processNotification).toHaveBeenCalledWith(mockNotifications[1]);
      expect(bot.processNotification).toHaveBeenCalledWith(mockNotifications[2]);

      // It should NOT try to process the others
      expect(bot.processNotification).not.toHaveBeenCalledWith(mockNotifications[3]);
      expect(bot.processNotification).not.toHaveBeenCalledWith(mockNotifications[4]);
      expect(bot.processNotification).not.toHaveBeenCalledWith(mockNotifications[5]);

      // It should add the three processed URIs to the datastore
      expect(dataStore.addRepliedPost).toHaveBeenCalledTimes(3);
      expect(dataStore.addRepliedPost).toHaveBeenCalledWith('at://did:plc:1/app.bsky.feed.post/1');
      expect(dataStore.addRepliedPost).toHaveBeenCalledWith('at://did:plc:2/app.bsky.feed.post/2');
      expect(dataStore.addRepliedPost).toHaveBeenCalledWith('at://did:plc:3/app.bsky.feed.post/3');

      // It should update the seen status since notifications were processed
      // (3 successful processes + 1 skip that still updates seen)
      expect(blueskyService.updateSeen).toHaveBeenCalledTimes(4);
    });

    it('should not update seen status if no new notifications were processed', async () => {
      // All notifications are either read or already replied to
      const mockNotifications = [
        { uri: 'at://did:plc:1/app.bsky.feed.post/1', isRead: true, reason: 'mention' },
        { uri: 'at://did:plc:2/app.bsky.feed.post/2', isRead: false, reason: 'reply' }
      ];

      blueskyService.getNotifications.mockResolvedValueOnce({
        notifications: mockNotifications,
        cursor: undefined,
      });
      dataStore.hasReplied.mockReturnValue(true); // All are considered replied to
      bot.processNotification = jest.fn();

      await bot.catchUpNotifications();

      expect(bot.processNotification).not.toHaveBeenCalled();
      expect(dataStore.addRepliedPost).not.toHaveBeenCalled();
      // It will still call updateSeen to mark the already-replied notification as seen on-network
      expect(blueskyService.updateSeen).toHaveBeenCalled();
    });
  });

  it('should trigger fact-checking for a verifiable claim', async () => {
    const mockNotif = {
      isRead: false,
      uri: 'at://did:plc:123/app.bsky.feed.post/789',
      reason: 'mention',
      record: {
        $type: 'app.bsky.feed.post',
        text: 'Is it true that the sky is blue? @skybots.bsky.social',
      },
      author: { handle: 'user.bsky.social' },
      indexedAt: new Date().toISOString()
    };

    bot._getThreadHistory = jest.fn().mockResolvedValue([]);
    llmService.isFactCheckNeeded.mockResolvedValue(true);
    llmService.extractClaim.mockResolvedValue('sky is blue');

    const mockGoogleResults = [
      { title: 'Why the Sky Is Blue', link: 'https://example.com/sky-is-blue', snippet: 'The sky is blue because of Rayleigh scattering...' }
    ];
    googleSearchService.search.mockResolvedValue(mockGoogleResults);
    llmService.selectBestResult.mockImplementation((query, results) => {
        if (results && results.length > 0) return Promise.resolve(results[0]);
        return Promise.resolve(null);
    });

    // Override default mock for this specific test's response
    llmService.generateResponse.mockImplementation((messages) => {
        const systemContent = messages[0].content || '';
        if (systemContent.includes('intent detection AI')) return Promise.resolve('no');
        if (systemContent.toLowerCase().includes('summary')) return Promise.resolve('Yes, the sky is blue due to a phenomenon called Rayleigh scattering.');
        return Promise.resolve('Test response');
    });

    blueskyService.getExternalEmbed.mockResolvedValue({ $type: 'app.bsky.embed.external', external: {} });

    await bot.processNotification(mockNotif);

    expect(googleSearchService.search).toHaveBeenCalledWith('sky is blue');
    expect(llmService.selectBestResult).toHaveBeenCalledWith('sky is blue', mockGoogleResults, 'general');
    expect(blueskyService.postReply).toHaveBeenCalledWith(
      expect.anything(),
      'Yes, the sky is blue due to a phenomenon called Rayleigh scattering.',
      expect.objectContaining({
        embed: { $type: 'app.bsky.embed.external', external: {} }
      })
    );
  });

  it('should not post a trivial reply due to centralized validation', async () => {
    const mockNotif = {
      isRead: false,
      uri: 'at://did:plc:123/app.bsky.feed.post/101',
      reason: 'mention',
      record: {
        $type: 'app.bsky.feed.post',
        text: 'Hello @skybots.bsky.social',
      },
      author: { handle: 'user.bsky.social' },
      indexedAt: new Date().toISOString()
    };

    bot._getThreadHistory = jest.fn().mockResolvedValue([]);
    llmService.isPostSafe.mockResolvedValue({ safe: true });
    llmService.isFactCheckNeeded.mockResolvedValue(false);
    llmService.generateResponse.mockResolvedValue('?'); // Trivial reply

    const postReplySpy = jest.spyOn(blueskyService, 'postReply');

    await bot.processNotification(mockNotif);

    expect(postReplySpy).toHaveBeenCalledWith(expect.anything(), '?');
    expect(blueskyService.agent.post).not.toHaveBeenCalled();
    expect(blueskyService.deletePost).not.toHaveBeenCalled();

    postReplySpy.mockRestore();
  });

  it('should delete its own incoherent reply', async () => {
    const mockNotif = {
      isRead: false,
      uri: 'at://did:plc:123/app.bsky.feed.post/102',
      reason: 'mention',
      record: {
        $type: 'app.bsky.feed.post',
        text: 'What is the capital of France? @skybots.bsky.social',
      },
      author: { handle: 'user.bsky.social' },
      indexedAt: new Date().toISOString()
    };

    bot._getThreadHistory = jest.fn().mockResolvedValue([]);
    llmService.isPostSafe.mockResolvedValue({ safe: true });
    llmService.isFactCheckNeeded.mockResolvedValue(false);
    llmService.generateResponse.mockResolvedValue('The sky is blue.'); // Incoherent reply
    blueskyService.postReply.mockResolvedValue({ uri: 'at://did:plc:bot/app.bsky.feed.post/1000' });
    llmService.isReplyCoherent.mockResolvedValue(false);
    llmService.checkSemanticLoop.mockResolvedValue(false);
    dataStore.getInteractionsByUser.mockReturnValue([]);


    await bot.processNotification(mockNotif);

    expect(blueskyService.postReply).toHaveBeenCalledWith(expect.anything(), 'The sky is blue.');
    expect(blueskyService.deletePost).toHaveBeenCalledWith('at://did:plc:bot/app.bsky.feed.post/1000');
  });

  it('should handle a quote repost with the correct context', async () => {
    const mockNotif = {
      isRead: false,
      uri: 'at://did:plc:user/app.bsky.feed.post/quote_repost',
      reason: 'quote',
      record: {
        text: 'This is a cool post!',
        embed: {
          $type: 'app.bsky.embed.record',
          record: {
            uri: 'at://did:plc:bot/app.bsky.feed.post/original_post'
          }
        }
      },
      author: { handle: 'user.bsky.social' },
      indexedAt: new Date().toISOString()
    };

    const mockQuotedPost = {
      uri: 'at://did:plc:bot/app.bsky.feed.post/original_post',
      author: { handle: 'bot.handle', did: 'did:plc:bot' },
      record: {
        text: 'This is the original post by the bot.',
        embed: {
          $type: 'app.bsky.embed.images',
          images: [{
            image: { ref: { $link: 'cid1' } },
            alt: 'An image of a space tree.'
          }]
        }
      }
    };

    blueskyService.getPostDetails.mockResolvedValue(mockQuotedPost);
    llmService.isPostSafe.mockResolvedValue({ safe: true });
    llmService.generateResponse.mockResolvedValue('Thank you for the compliment!');

    await bot.processNotification(mockNotif);

    expect(blueskyService.getPostDetails).toHaveBeenCalledWith('at://did:plc:bot/app.bsky.feed.post/original_post');
    const generateResponseCalls = llmService.generateResponse.mock.calls;
    // Find the call that generates the response (it has the most messages and contains the persona prompt)
    const responseCall = generateResponseCalls.find(call =>
      call[0].length >= 3 && call[0][0].content.includes('You are replying to')
    );

    expect(responseCall).toBeDefined();
    const messages = responseCall[0];
    const threadContext = messages.filter(m => m.role !== 'system');

    expect(threadContext).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(threadContext[0].role).toBe('assistant');
    expect(threadContext[0].content).toBe('This is the original post by the bot. [Image with alt text: "An image of a space tree."]');
    expect(threadContext[1].role).toBe('user');
    expect(threadContext[1].content).toBe('This is a cool post!');

    expect(blueskyService.postReply).toHaveBeenCalledWith(expect.anything(), 'Thank you for the compliment!');
  });

  it('should not reply to its own post to prevent a loop', async () => {
    const mockNotif = {
      isRead: false,
      uri: 'at://did:plc:bot/app.bsky.feed.post/self_reply',
      reason: 'reply',
      record: {
        text: 'This is a self-reply.',
        reply: {
          root: { uri: 'at://did:plc:user/app.bsky.feed.post/original' },
          parent: { uri: 'at://did:plc:bot/app.bsky.feed.post/previous_reply' }
        }
      },
      author: { handle: config.BLUESKY_IDENTIFIER }, // The author is the bot itself
      indexedAt: new Date().toISOString()
    };

    bot.processNotification = jest.fn(bot.processNotification);

    await bot.processNotification(mockNotif);

    expect(blueskyService.postReply).not.toHaveBeenCalled();
    expect(llmService.generateResponse).not.toHaveBeenCalled();
  });

  it('should disengage from a hostile user with an explanation', async () => {
    const mockNotif = {
      isRead: false,
      uri: 'at://did:plc:123/app.bsky.feed.post/hostile',
      reason: 'mention',
      record: { text: 'You are a terrible bot! @skybots.bsky.social' },
      author: { handle: 'mean.user' },
      indexedAt: new Date().toISOString()
    };

    bot._getThreadHistory = jest.fn().mockResolvedValue([]);
    llmService.evaluateConversationVibe.mockResolvedValue({ status: 'hostile', reason: 'harassment' });
    llmService.generateResponse.mockResolvedValue('I cannot continue this conversation as it violates my guidelines regarding harassment.');

    await bot.processNotification(mockNotif);

    expect(blueskyService.postReply).toHaveBeenCalledWith(expect.anything(), 'I cannot continue this conversation as it violates my guidelines regarding harassment.');
    expect(dataStore.muteBranch).toHaveBeenCalledWith('at://did:plc:bot/post/1', 'mean.user');
  });

  it('should end a monotonous conversation with a short reply', async () => {
    const mockNotif = {
      isRead: false,
      uri: 'at://did:plc:123/app.bsky.feed.post/monotonous',
      reason: 'reply',
      record: { text: 'Tell me more.' },
      author: { handle: 'bored.user' },
      indexedAt: new Date().toISOString()
    };

    const history = [
        { author: 'user', text: '1' }, { author: config.BLUESKY_IDENTIFIER, text: 'A' },
        { author: 'user', text: '2' }, { author: config.BLUESKY_IDENTIFIER, text: 'B' },
        { author: 'user', text: '3' }, { author: config.BLUESKY_IDENTIFIER, text: 'C' },
        { author: 'user', text: '4' }, { author: config.BLUESKY_IDENTIFIER, text: 'D' },
        { author: 'user', text: '5' }, { author: config.BLUESKY_IDENTIFIER, text: 'E' },
        { author: 'user', text: 'Tell me more.' }
    ];
    bot._getThreadHistory = jest.fn().mockResolvedValue(history);
    llmService.evaluateConversationVibe.mockResolvedValue({ status: 'monotonous' });
    llmService.generateResponse.mockResolvedValue('Fair enough, talk soon!');

    await bot.processNotification(mockNotif);

    expect(blueskyService.postReply).toHaveBeenCalledWith(expect.anything(), 'Fair enough, talk soon!');
    expect(dataStore.muteBranch).toHaveBeenCalledWith('at://did:plc:bot/post/1', 'bored.user');
  });

  it('should provide a concise conclusion for a new user in a muted branch', async () => {
    const mockNotif = {
      isRead: false,
      uri: 'at://did:plc:123/app.bsky.feed.post/new_user_reply',
      reason: 'reply',
      record: { text: `Wait, what happened? ${config.BLUESKY_IDENTIFIER}` },
      author: { handle: 'new.user' },
      indexedAt: new Date().toISOString()
    };

    bot._getThreadHistory = jest.fn().mockResolvedValue([
      { author: 'mean.user', text: '...', uri: 'at://did:plc:123/app.bsky.feed.post/hostile' }
    ]);
    dataStore.getMutedBranchInfo.mockReturnValue({ uri: 'at://did:plc:123/app.bsky.feed.post/hostile', handle: 'mean.user' });
    llmService.generateResponse.mockImplementation((messages) => {
        if (messages[0].content.includes('final-sounding response')) return Promise.resolve('The conversation ended.');
        return Promise.resolve('Test response');
    });
    blueskyService.postReply.mockResolvedValue({ uri: 'at://did:plc:bot/post/concise' });

    await bot.processNotification(mockNotif);

    expect(blueskyService.postReply).toHaveBeenCalledWith(expect.anything(), 'The conversation ended.');
    expect(dataStore.muteBranch).toHaveBeenCalledWith('at://did:plc:bot/post/concise', 'new.user');
  });
});

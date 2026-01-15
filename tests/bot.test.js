import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/services/blueskyService.js', () => ({
  blueskyService: {
    getNotifications: jest.fn(),
    updateSeen: jest.fn(),
    getProfile: jest.fn(),
    getUserPosts: jest.fn(),
    postReply: jest.fn(),
    getDetailedThread: jest.fn(),
    getPostDetails: jest.fn(),
    likePost: jest.fn(),
    authenticate: jest.fn(),
    postAlert: jest.fn(),
    deletePost: jest.fn(),
    getExternalEmbed: jest.fn(),
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
  },
}));

jest.unstable_mockModule('../src/services/dataStore.js', () => ({
  dataStore: {
    hasReplied: jest.fn(),
    addRepliedPost: jest.fn(),
    isBlocked: jest.fn(),
    isThreadMuted: jest.fn(),
    getConversationLength: jest.fn(),
    updateConversationLength: jest.fn(),
    saveInteraction: jest.fn(),
    getInteractionsByUser: jest.fn(),
    updateUserRating: jest.fn(),
    init: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/services/googleSearchService.js', () => ({
  googleSearchService: {
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
import config from '../config.js';

describe('Bot', () => {
  let bot;

  beforeEach(async () => {
    jest.clearAllMocks();
    bot = new Bot();
    await bot.init(); // To load readme, etc.
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
      expect(blueskyService.updateSeen).toHaveBeenCalledTimes(1);
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
      expect(blueskyService.updateSeen).not.toHaveBeenCalled();
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
    llmService.isPostSafe.mockResolvedValue({ safe: true });
    llmService.isFactCheckNeeded.mockResolvedValue(true);
    llmService.extractClaim.mockResolvedValue('sky is blue');
    googleSearchService.search.mockResolvedValue([
      { title: 'Why the Sky Is Blue', link: 'https://example.com/sky-is-blue', snippet: 'The sky is blue because of Rayleigh scattering...' }
    ]);
    llmService.generateResponse.mockResolvedValue('Yes, the sky is blue due to a phenomenon called Rayleigh scattering.');
    blueskyService.getExternalEmbed.mockResolvedValue({ $type: 'app.bsky.embed.external', external: {} });

    await bot.processNotification(mockNotif);

    expect(googleSearchService.search).toHaveBeenCalledWith('sky is blue');
    expect(llmService.generateResponse).toHaveBeenCalled();
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
});

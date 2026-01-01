import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/services/blueskyService.js', () => ({
  blueskyService: {
    getNotifications: jest.fn(),
    getProfile: jest.fn(),
    getUserPosts: jest.fn(),
    postReply: jest.fn(),
    getDetailedThread: jest.fn(),
    likePost: jest.fn(),
    authenticate: jest.fn(),
    postAlert: jest.fn(),
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

const { Bot } = await import('../src/bot.js');
const { blueskyService } = await import('../src/services/blueskyService.js');
const { llmService } = await import('../src/services/llmService.js');
const { dataStore } = await import('../src/services/dataStore.js');
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
    llmService.isResponseSafe.mockResolvedValue({ safe: true });
    llmService.rateUserInteraction.mockResolvedValue(4);
    blueskyService.getProfile.mockResolvedValue({ description: 'A test user' });
    blueskyService.getUserPosts.mockResolvedValue([]);
    llmService.analyzeUserIntent.mockResolvedValue({ highRisk: false });
    dataStore.getInteractionsByUser.mockReturnValue([]);

    await bot.processNotification(mockNotif);

    expect(bot._getThreadHistory).toHaveBeenCalledWith(mockNotif.uri);
    expect(llmService.generateResponse).toHaveBeenCalled();
    expect(blueskyService.postReply).toHaveBeenCalled();
  });
});

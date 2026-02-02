import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/services/blueskyService.js', () => ({
  blueskyService: {
    did: 'did:plc:bot',
    searchPosts: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/services/llmService.js', () => ({
  llmService: {
    setMemoryProvider: jest.fn(),
  },
}));

const { memoryService } = await import('../src/services/memoryService.js');
import config from '../config.js';

describe('MemoryService', () => {
  it('should strip hashtag from memories when formatting for prompt', () => {
    const hashtag = '#SydneyDiary';
    memoryService.hashtag = hashtag;
    memoryService.recentMemories = [
      { text: `Thinking about code today. ${hashtag}`, indexedAt: '2026-01-01T00:00:00Z' }
    ];

    const formatted = memoryService.formatMemoriesForPrompt();
    expect(formatted).toContain('Thinking about code today.');
    expect(formatted).not.toContain(hashtag);
  });
});

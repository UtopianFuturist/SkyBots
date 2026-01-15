import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/services/googleSearchService.js', () => ({
  googleSearchService: {
    search: jest.fn(),
    searchImages: jest.fn(),
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
jest.unstable_mockModule('../src/services/blueskyService.js', () => ({
  blueskyService: {
    postReply: jest.fn(),
    uploadImages: jest.fn(),
    getExternalEmbed: jest.fn(),
    agent: {
      uploadBlob: jest.fn(),
      post: jest.fn(),
    },
  },
}));
jest.unstable_mockModule('../src/services/llmService.js', () => ({
  llmService: {
    generateResponse: jest.fn(),
  },
}));

const { handleCommand } = await import('../src/utils/commandHandler.js');
const { llmService } = await import('../src/services/llmService.js');
const { googleSearchService } = await import('../src/services/googleSearchService.js');
const { youtubeService } = await import('../src/services/youtubeService.js');
const { imageService } = await import('../src/services/imageService.js');
const { blueskyService } = await import('../src/services/blueskyService.js');

describe('Command Handler', () => {
  const mockBot = { readmeContent: 'This is a test readme.' };
  const mockPost = {
    author: { handle: 'test.bsky.social' },
    uri: 'at://did:plc:123/app.bsky.feed.post/456',
    cid: 'bafy...',
    record: {
      text: 'a command!',
      reply: {
        root: { uri: 'at://did:plc:123/app.bsky.feed.post/111', cid: 'bafyroot...' },
        parent: { uri: 'at://did:plc:123/app.bsky.feed.post/222', cid: 'bafyparent...' }
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle search command with multiple results as a nested chain', async () => {
    const mockResults = [
      { title: 'Test Title 1', link: 'https://test.com/1', snippet: 'Test snippet 1.' },
      { title: 'Test Title 2', link: 'https://test.com/2', snippet: 'Test snippet 2.' },
      { title: 'Test Title 3', link: 'https://test.com/3', snippet: 'Test snippet 3.' },
    ];
    googleSearchService.search.mockResolvedValue(mockResults);
    llmService.generateResponse.mockResolvedValue('This is a test summary.');

    // Mock the postReply method to simulate returning new post URIs/CIDs for chaining
    blueskyService.postReply
      .mockResolvedValueOnce({ uri: 'at://summary-uri', cid: 'summary-cid' })
      .mockResolvedValueOnce({ uri: 'at://result1-uri', cid: 'result1-cid' })
      .mockResolvedValueOnce({ uri: 'at://result2-uri', cid: 'result2-cid' })
      .mockResolvedValueOnce({ uri: 'at://result3-uri', cid: 'result3-cid' });

    await handleCommand(mockBot, mockPost, '!search test query');

    expect(googleSearchService.search).toHaveBeenCalledWith('test query');
    expect(llmService.generateResponse).toHaveBeenCalled();
    expect(blueskyService.postReply).toHaveBeenCalledTimes(4);

    const calls = blueskyService.postReply.mock.calls;

    // 1. Summary post should reply to the original post
    expect(calls[0][0]).toBe(mockPost);
    expect(calls[0][1]).toBe('This is a test summary.');

    // 2. First result should reply to the summary post
    expect(calls[1][0]).toEqual({ uri: 'at://summary-uri', cid: 'summary-cid' });
    expect(calls[1][1]).toBe('Test Title 1\nhttps://test.com/1');

    // 3. Second result should reply to the first result
    expect(calls[2][0]).toEqual({ uri: 'at://result1-uri', cid: 'result1-cid' });
    expect(calls[2][1]).toBe('Test Title 2\nhttps://test.com/2');

    // 4. Third result should reply to the second result
    expect(calls[3][0]).toEqual({ uri: 'at://result2-uri', cid: 'result2-cid' });
    expect(calls[3][1]).toBe('Test Title 3\nhttps://test.com/3');
  });

  it('should handle youtube search command', async () => {
    youtubeService.search.mockResolvedValue([{ videoId: '123', title: 'Test Video' }]);
    await handleCommand(mockBot, mockPost, '!youtube test query');
    expect(youtubeService.search).toHaveBeenCalledWith('test query');
    expect(blueskyService.postReply).toHaveBeenCalled();
  });

  it('should handle image generation command', async () => {
    imageService.generateImage.mockResolvedValue(Buffer.from('test-image-data'));
    blueskyService.agent = { uploadBlob: jest.fn().mockResolvedValue({ data: { blob: 'test-blob-ref' } }) };
    await handleCommand(mockBot, mockPost, '!generate-image a cat');
    expect(imageService.generateImage).toHaveBeenCalledWith('a cat');
    expect(blueskyService.postReply).toHaveBeenCalled();
  });

  it('should handle singular image search command', async () => {
    const mockImages = [{ title: 'Image 1' }];
    googleSearchService.searchImages.mockResolvedValue(mockImages);
    blueskyService.uploadImages.mockResolvedValue({ $type: 'app.bsky.embed.images', images: [{ image: 'blob1', alt: 'Image 1' }] });
    await handleCommand(mockBot, mockPost, '!image-search a dog');
    expect(googleSearchService.searchImages).toHaveBeenCalledWith('a dog');
    expect(blueskyService.uploadImages).toHaveBeenCalledWith(mockImages);
    expect(blueskyService.postReply).toHaveBeenCalledWith(
      expect.anything(),
      "Here's an image I found for \"a dog\":",
      { embed: { $type: 'app.bsky.embed.images', images: [{ image: 'blob1', alt: 'Image 1' }] } }
    );
  });

  it('should handle plural image search command', async () => {
    const mockImages = [{ title: 'Image 1' }, { title: 'Image 2' }, { title: 'Image 3' }, { title: 'Image 4' }];
    googleSearchService.searchImages.mockResolvedValue(mockImages);
    blueskyService.uploadImages.mockResolvedValue({ $type: 'app.bsky.embed.images', images: [{ image: 'blob1', alt: 'Image 1' }, { image: 'blob2', alt: 'Image 2' }] });
    await handleCommand(mockBot, mockPost, '!image-search images of cats');
    expect(googleSearchService.searchImages).toHaveBeenCalledWith('images of cats');
    expect(blueskyService.uploadImages).toHaveBeenCalledWith(mockImages);
    expect(blueskyService.postReply).toHaveBeenCalledWith(
      expect.anything(),
      'Here are the top 4 images I found for "images of cats":',
      { embed: { $type: 'app.bsky.embed.images', images: [{ image: 'blob1', alt: 'Image 1' }, { image: 'blob2', alt: 'Image 2' }] } }
    );
  });
});

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
    agent: {
      uploadBlob: jest.fn(),
    },
  },
}));

const { handleCommand } = await import('../src/utils/commandHandler.js');
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

  it('should handle google search command', async () => {
    googleSearchService.search.mockResolvedValue([{ title: 'Test Title', link: 'https://test.com', snippet: 'Test snippet.' }]);
    await handleCommand(mockBot, mockPost, 'google test query');
    expect(googleSearchService.search).toHaveBeenCalledWith('test query');
    expect(blueskyService.postReply).toHaveBeenCalled();
  });

  it('should handle youtube search command', async () => {
    youtubeService.search.mockResolvedValue([{ videoId: '123', title: 'Test Video' }]);
    await handleCommand(mockBot, mockPost, 'youtube test query');
    expect(youtubeService.search).toHaveBeenCalledWith('test query');
    expect(blueskyService.postReply).toHaveBeenCalled();
  });

  it('should handle image generation command', async () => {
    imageService.generateImage.mockResolvedValue(Buffer.from('test-image-data'));
    blueskyService.agent = { uploadBlob: jest.fn().mockResolvedValue({ data: { blob: 'test-blob-ref' } }) };
    await handleCommand(mockBot, mockPost, 'generate image of a cat');
    expect(imageService.generateImage).toHaveBeenCalledWith('of a cat');
    expect(blueskyService.postReply).toHaveBeenCalled();
  });

  it('should handle singular image search command', async () => {
    const mockImages = [{ title: 'Image 1' }];
    googleSearchService.searchImages.mockResolvedValue(mockImages);
    blueskyService.uploadImages.mockResolvedValue({ $type: 'app.bsky.embed.images', images: [{ image: 'blob1', alt: 'Image 1' }] });
    await handleCommand(mockBot, mockPost, 'find image of a dog');
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
    await handleCommand(mockBot, mockPost, 'find images of cats');
    expect(googleSearchService.searchImages).toHaveBeenCalledWith('cats');
    expect(blueskyService.uploadImages).toHaveBeenCalledWith(mockImages);
    expect(blueskyService.postReply).toHaveBeenCalledWith(
      expect.anything(),
      'Here are the top 4 images I found for "cats":',
      { embed: { $type: 'app.bsky.embed.images', images: [{ image: 'blob1', alt: 'Image 1' }, { image: 'blob2', alt: 'Image 2' }] } }
    );
  });
});

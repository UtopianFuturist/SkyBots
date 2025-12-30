import fetch from 'node-fetch';
import config from '../../config.js';

class YouTubeService {
  constructor() {
    this.apiKey = config.YOUTUBE_API_KEY;
    this.baseUrl = 'https://www.googleapis.com/youtube/v3/search';
  }

  async search(query) {
    const url = `${this.baseUrl}?key=${this.apiKey}&q=${encodeURIComponent(query)}&part=snippet&type=video&maxResults=5`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`YouTube API error (${response.status})`);
      }
      const data = await response.json();
      return data.items?.map(item => ({
        title: item.snippet.title,
        videoId: item.id.videoId,
        thumbnail: item.snippet.thumbnails.default.url,
        channel: item.snippet.channelTitle,
      })) || [];
    } catch (error) {
      console.error('[YouTubeService] Error performing YouTube search:', error);
      return [];
    }
  }
}

export const youtubeService = new YouTubeService();

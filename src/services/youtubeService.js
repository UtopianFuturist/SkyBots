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
      console.log(`[YouTubeService] Searching for: "${query}"`);
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        // Log the detailed error from the YouTube API
        const errorDetails = data.error ? JSON.stringify(data.error, null, 2) : 'No additional error details.';
        console.error(`[YouTubeService] YouTube API error (${response.status}):`, errorDetails);
        throw new Error(`YouTube API error (${response.status})`);
      }

      console.log(`[YouTubeService] Found ${data.items?.length || 0} videos for "${query}".`);
      return data.items?.map(item => ({
        title: item.snippet.title,
        videoId: item.id.videoId,
        thumbnail: item.snippet.thumbnails.default.url,
        channel: item.snippet.channelTitle,
      })) || [];
    } catch (error) {
      // Catch both network errors and API errors thrown above
      console.error('[YouTubeService] Unhandled error during YouTube search:', error.message);
      return [];
    }
  }
}

export const youtubeService = new YouTubeService();

import fetch from 'node-fetch';
import config from '../../config.js';

class YouTubeService {
  constructor() {
    this.apiKey = config.YOUTUBE_API_KEY;
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
  }

  async getVideoDetails(videoId) {
    const url = `${this.baseUrl}/videos?key=${this.apiKey}&id=${videoId}&part=status,snippet`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        return data.items[0];
      }
      return null;
    } catch (error) {
      console.error(`[YouTubeService] Error fetching video details for ${videoId}:`, error);
      return null;
    }
  }

  async search(query) {
    const searchUrl = `${this.baseUrl}/search?key=${this.apiKey}&q=${encodeURIComponent(query)}&part=snippet&type=video&maxResults=5`;
    try {
      console.log(`[YouTubeService] Searching for: "${query}"`);
      const response = await fetch(searchUrl);
      const data = await response.json();

      if (!response.ok) {
        const errorDetails = data.error ? JSON.stringify(data.error, null, 2) : 'No additional error details.';
        console.error(`[YouTubeService] YouTube API error (${response.status}):`, errorDetails);
        throw new Error(`YouTube API error (${response.status})`);
      }

      if (!data.items || data.items.length === 0) {
        console.log(`[YouTubeService] No videos found for "${query}".`);
        return [];
      }

      console.log(`[YouTubeService] Found ${data.items.length} potential videos for "${query}".`);
      for (const item of data.items) {
        const videoId = item.id.videoId;
        const details = await this.getVideoDetails(videoId);
        if (details && details.status.uploadStatus === 'processed' && details.status.embeddable) {
          console.log(`[YouTubeService] Found available video: "${details.snippet.title}" (ID: ${videoId})`);
          return [{
            title: details.snippet.title,
            videoId: videoId,
            thumbnail: details.snippet.thumbnails.default.url,
            channel: details.snippet.channelTitle,
          }];
        }
        console.log(`[YouTubeService] Skipping unavailable video: ID ${videoId}`);
      }

      console.log(`[YouTubeService] No available videos found for "${query}" after checking details.`);
      return [];
    } catch (error) {
      console.error('[YouTubeService] Unhandled error during YouTube search:', error.message);
      return [];
    }
  }
}

export const youtubeService = new YouTubeService();

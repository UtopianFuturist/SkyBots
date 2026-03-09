import fetch from 'node-fetch';
import config from '../../config.js';

class YoutubeService {
  async search(query) {
    if (!config.YOUTUBE_API_KEY) return "YouTube search not configured.";
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=3&q=${encodeURIComponent(query)}&type=video&key=${config.YOUTUBE_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      return (data.items || []).map(i => `${i.snippet.title}: https://youtube.com/watch?v=${i.id.videoId}`).join('\n');
    } catch (e) { return "YouTube search failed."; }
  }
}

export const youtubeService = new YoutubeService();

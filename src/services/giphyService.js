import fetch from 'node-fetch';
import config from '../../config.js';

class GiphyService {
  constructor() {
    this.apiKey = config.GIPHY_API_KEY;
    this.baseUrl = 'https://api.giphy.com/v1/gifs';
  }

  async search(query) {
    if (!this.apiKey) {
      console.error('[GiphyService] GIPHY_API_KEY is missing.');
      return null;
    }

    const url = `${this.baseUrl}/search?api_key=${this.apiKey}&q=${encodeURIComponent(query)}&limit=1&offset=0&rating=g&lang=en`;

    try {
      console.log(`[GiphyService] Searching for GIF: "${query}"`);
      const response = await fetch(url);
      const data = await response.json();

      if (response.ok && data.data && data.data.length > 0) {
        const gif = data.data[0];
        const gifUrl = gif.images.original.url;
        const gifSize = parseInt(gif.images.original.size, 10);
        const maxSize = 976.56 * 1024; // 976.56 KB in bytes

        if (gifSize > maxSize) {
          console.warn(`[GiphyService] Found GIF, but it is too large (${(gifSize / 1024).toFixed(2)} KB). Skipping.`);
          return null;
        }

        console.log(`[GiphyService] Found GIF: ${gif.url}`);
        return {
          url: gifUrl,
          alt: gif.title,
          sourceUrl: gif.url,
        };
      } else {
        console.error(`[GiphyService] No GIF found for "${query}". Response:`, data);
        return null;
      }
    } catch (error) {
      console.error('[GiphyService] Error searching for GIF:', error);
      return null;
    }
  }
}

export const giphyService = new GiphyService();

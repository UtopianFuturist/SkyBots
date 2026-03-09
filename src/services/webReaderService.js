import fetch from 'node-fetch';

class WebReaderService {
  get js() { return this; }

  async fetchContent(url) {
    try {
      const response = await fetch(url, { timeout: 10000 });
      const text = await response.text();
      return text.substring(0, 5000); // Limit to 5k chars
    } catch (e) {
      return `Failed to fetch content from ${url}`;
    }
  }
}
export const webReaderService = new WebReaderService();

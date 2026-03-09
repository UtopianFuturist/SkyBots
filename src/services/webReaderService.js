import fetch from 'node-fetch';

class WebReaderService {
  async fetchContent(url) {
    try {
      const response = await fetch(url, { timeout: 10000 });
      const text = await response.text();
      return text.substring(0, 3000); // Safely read first 3k chars
    } catch (e) { return "Web reading failed."; }
  }
}

export const webReaderService = new WebReaderService();

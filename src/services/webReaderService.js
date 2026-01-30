import fetch from 'node-fetch';

class WebReaderService {
  async fetchContent(url) {
    console.log(`[WebReaderService] Fetching content from: ${url}`);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.statusText}`);
      }

      const html = await response.text();
      return this.extractText(html);
    } catch (error) {
      console.error(`[WebReaderService] Error fetching content from ${url}:`, error.message);
      return null;
    }
  }

  extractText(html) {
    // Basic HTML to text conversion
    let text = html
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '')
      .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Limit to ~50,000 characters to be safe (Qwen context is large, but let's not be excessive)
    return text.substring(0, 50000);
  }
}

export const webReaderService = new WebReaderService();

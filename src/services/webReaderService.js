import fetch from 'node-fetch';

class WebReaderService {
  async fetchContent(url) {
    if (!url) return null;

    // Ensure URL has a protocol
    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
    }

    console.log(`[WebReaderService] STEP 1: Starting fetch for: ${targetUrl}`);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        console.log(`[WebReaderService] STEP 2: Fetch timeout for ${targetUrl} after 15s`);
        controller.abort();
      }, 15000); // 15s timeout

      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      clearTimeout(timeout);
      console.log(`[WebReaderService] STEP 3: Response received for ${targetUrl}. Status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.statusText}`);
      }

      const html = await response.text();
      console.log(`[WebReaderService] STEP 4: HTML retrieved for ${targetUrl}. Length: ${html.length} chars.`);
      const text = this.extractText(html);
      console.log(`[WebReaderService] STEP 5: Text extracted for ${targetUrl}. Clean length: ${text.length} chars.`);
      return text;
    } catch (error) {
      console.error(`[WebReaderService] Error fetching content from ${targetUrl}:`, error.message);
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

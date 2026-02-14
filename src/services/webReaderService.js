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

    // Primary method: markdown.new
    const markdownNewUrl = `https://markdown.new/${targetUrl}`;
    console.log(`[WebReaderService] Attempting primary fetch via: ${markdownNewUrl}`);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        console.log(`[WebReaderService] Primary fetch timeout for ${targetUrl} after 15s`);
        controller.abort();
      }, 15000);

      const response = await fetch(markdownNewUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'text/markdown, text/plain',
          'User-Agent': 'SkyBots/3.0 (AI Agent)'
        }
      });

      clearTimeout(timeout);

      if (response.ok) {
        const markdown = await response.text();
        if (markdown && markdown.length > 100) {
            console.log(`[WebReaderService] SUCCESS: Retrieved Markdown from markdown.new. Length: ${markdown.length}`);
            return markdown.substring(0, 50000);
        }
      }
      console.warn(`[WebReaderService] markdown.new failed or returned insufficient content. Status: ${response.status}`);
    } catch (error) {
      console.warn(`[WebReaderService] Error during primary fetch from markdown.new:`, error.message);
    }

    // Fallback method: Direct fetch and regex extraction
    console.log(`[WebReaderService] Attempting fallback fetch for: ${targetUrl}`);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        console.log(`[WebReaderService] Fallback fetch timeout for ${targetUrl} after 15s`);
        controller.abort();
      }, 15000);

      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      clearTimeout(timeout);
      console.log(`[WebReaderService] Fallback response received. Status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch content directly: ${response.statusText}`);
      }

      const html = await response.text();
      const text = this.extractText(html);
      console.log(`[WebReaderService] Text extracted via fallback. Clean length: ${text.length} chars.`);
      return text;
    } catch (error) {
      console.error(`[WebReaderService] Error during fallback fetch from ${targetUrl}:`, error.message);
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

import fetch from 'node-fetch';
import config from '../../config.js';
import { llmService } from './llmService.js';

class GoogleSearchService {
  constructor() {
    this.apiKey = config.GOOGLE_CUSTOM_SEARCH_API_KEY;
    this.cxId = config.GOOGLE_CUSTOM_SEARCH_CX_ID;
    this.baseUrl = 'https://www.googleapis.com/customsearch/v1';
  }

  async search(query) {
    const url = `${this.baseUrl}?key=${this.apiKey}&cx=${this.cxId}&q=${encodeURIComponent(query)}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Google Search API error (${response.status})`);
      }
      const data = await response.json();
      return data.items?.map(item => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
      })) || [];
    } catch (error) {
      console.error('[GoogleSearchService] Error performing web search:', error);
      return [];
    }
  }

  async searchImages(query) {
    const url = `${this.baseUrl}?key=${this.apiKey}&cx=${this.cxId}&q=${encodeURIComponent(query)}&searchType=image&num=4`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Google Image Search API error (${response.status})`);
      }
      const data = await response.json();
      const images = data.items?.map(item => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
      })) || [];

      if (images.length === 0) return [];

      return await this.vetImages(query, images);

    } catch (error) {
      console.error('[GoogleSearchService] Error performing image search:', error);
      return [];
    }
  }

  async vetImages(query, images) {
    console.log('[GoogleSearchService] Vetting images with LLM...');
    const systemPrompt = `
      You are an AI assistant tasked with selecting the most relevant image for a user's query.
      Given a query and a list of images with their titles and descriptions, choose the one that best matches the query.
      Respond with only the number of the best image (e.g., "1", "2", "3", or "4").
    `;

    const imageDescriptions = images.map((img, i) => `${i + 1}. ${img.title}: ${img.snippet}`).join('\n');
    const userPrompt = `Query: "${query}"\n\nImages:\n${imageDescriptions}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await llmService.generateResponse(messages, { max_tokens: 2 });
    const selectedIndex = parseInt(response, 10) - 1;

    if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < images.length) {
      console.log(`[GoogleSearchService] LLM selected image #${selectedIndex + 1}`);
      return [images[selectedIndex]]; // Return an array with the single best image
    }

    console.log('[GoogleSearchService] LLM selection was invalid, returning the first image.');
    return [images[0]]; // Default to the first image if parsing fails
  }
}

export const googleSearchService = new GoogleSearchService();

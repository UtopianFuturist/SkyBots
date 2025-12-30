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
      return data.items?.map(item => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
      })) || [];
    } catch (error) {
      console.error('[GoogleSearchService] Error performing image search:', error);
      return [];
    }
  }
}

export const googleSearchService = new GoogleSearchService();

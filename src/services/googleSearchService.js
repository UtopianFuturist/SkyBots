import fetch from 'node-fetch';
import config from '../../config.js';
import { llmService } from './llmService.js';

class GoogleSearchService {
  constructor() {
    this.apiKey = config.GOOGLE_CUSTOM_SEARCH_API_KEY;
    this.cxId = config.GOOGLE_CUSTOM_SEARCH_CX_ID;
    this.baseUrl = 'https://www.googleapis.com/customsearch/v1';
    this.searchCount = 0;
    this.MAX_DAILY_SEARCHES = 50;
    this.lastResetDate = new Date().toISOString().split('T')[0];
  }

  _checkLimit() {
    const today = new Date().toISOString().split('T')[0];
    if (this.lastResetDate !== today) {
      console.log(`[GoogleSearchService] New day detected (${today}). Resetting search count from ${this.searchCount} to 0.`);
      this.searchCount = 0;
      this.lastResetDate = today;
    }

    if (this.searchCount >= this.MAX_DAILY_SEARCHES) {
      console.warn(`[GoogleSearchService] !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
      console.warn(`[GoogleSearchService] ! DAILY SEARCH LIMIT REACHED (${this.MAX_DAILY_SEARCHES}/50) !`);
      console.warn(`[GoogleSearchService] ! Skipping search. Will reset at midnight UTC.  !`);
      console.warn(`[GoogleSearchService] !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
      return false;
    }

    this.searchCount++;
    console.log(`[GoogleSearchService] Search count: ${this.searchCount}/${this.MAX_DAILY_SEARCHES}`);
    return true;
  }

  async search(query, options = {}) {
    const { useTrustedSources = true, dateRestrict = 'm3' } = options;

    let finalQuery = query;
    if (useTrustedSources) {
      const trustedSources = [
        'site:en.wikipedia.org',
        'site:reuters.com',
        'site:apnews.com',
        'site:politifact.com'
      ].join(' OR ');
      finalQuery = `${query} (${trustedSources})`;
    }

    if (!this._checkLimit()) return [];

    console.log(`[GoogleSearchService] Performing search with query: "${finalQuery}" (trusted: ${useTrustedSources})`);
    let url = `${this.baseUrl}?key=${this.apiKey}&cx=${this.cxId}&q=${encodeURIComponent(finalQuery)}`;
    if (dateRestrict) {
      url += `&dateRestrict=${dateRestrict}`;
    }

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

  async searchRepo(query) {
    if (!this._checkLimit()) return [];

    const finalQuery = `${query} site:github.com/UtopianFuturist/SkyBots`;
    console.log(`[GoogleSearchService] Performing repo search with query: "${finalQuery}"`);
    const url = `${this.baseUrl}?key=${this.apiKey}&cx=${this.cxId}&q=${encodeURIComponent(finalQuery)}`;
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
      console.error('[GoogleSearchService] Error performing repo search:', error);
      return [];
    }
  }

  async searchImages(query, num = 4) {
    if (!this._checkLimit()) return [];

    const url = `${this.baseUrl}?key=${this.apiKey}&cx=${this.cxId}&q=${encodeURIComponent(query)}&searchType=image&num=${num}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Google Image Search API error (${response.status})`);
      }
      const data = await response.json();
      if (!data.items) {
        console.warn(`[GoogleSearchService] No image results found for "${query}".`);
        return [];
      }
      return data.items.map(item => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
      }));
    } catch (error) {
      console.error('[GoogleSearchService] Error performing image search:', error);
      return [];
    }
  }
}

export const googleSearchService = new GoogleSearchService();

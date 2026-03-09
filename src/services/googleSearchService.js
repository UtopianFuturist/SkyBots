import fetch from 'node-fetch';
import config from '../../config.js';

class GoogleSearchService {
  async search(query) {
    if (!config.GOOGLE_CUSTOM_SEARCH_API_KEY) return "Google search not configured.";
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${config.GOOGLE_CUSTOM_SEARCH_API_KEY}&cx=${config.GOOGLE_CUSTOM_SEARCH_CX_ID}&q=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      const data = await response.json();
      return (data.items || []).slice(0, 3).map(i => `${i.title}: ${i.snippet} (${i.link})`).join('\n');
    } catch (e) { return "Search failed."; }
  }
}

export const googleSearchService = new GoogleSearchService();

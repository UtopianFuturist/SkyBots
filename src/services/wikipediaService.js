import fetch from 'node-fetch';

class WikipediaService {
  async search(query) {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json`;
      const response = await fetch(url);
      const data = await response.json();
      return (data.query?.search || []).slice(0, 3).map(s => `${s.title}: ${s.snippet.replace(/<[^>]*>?/gm, '')}`).join('\n');
    } catch (e) { return "Wikipedia search failed."; }
  }
}

export const wikipediaService = new WikipediaService();

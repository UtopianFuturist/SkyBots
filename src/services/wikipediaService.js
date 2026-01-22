import fetch from 'node-fetch';

class WikipediaService {
  constructor() {
    this.baseUrl = 'https://en.wikipedia.org/api/rest_v1';
  }

  async getRandomArticle() {
    console.log('[WikipediaService] Fetching random article...');
    try {
      const response = await fetch(`${this.baseUrl}/page/random/summary`);
      if (!response.ok) {
        throw new Error(`Wikipedia API error: ${response.statusText}`);
      }
      const data = await response.json();
      return {
        title: data.title,
        extract: data.extract,
        url: data.content_urls.desktop.page,
        thumbnail: data.thumbnail ? data.thumbnail.source : null,
      };
    } catch (error) {
      console.error('[WikipediaService] Error fetching random article:', error);
      return null;
    }
  }

  async searchArticle(query) {
      console.log(`[WikipediaService] Searching for article: "${query}"`);
      try {
          const searchResponse = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`);
          const searchData = await searchResponse.json();

          if (searchData.query.search.length > 0) {
              const title = searchData.query.search[0].title;
              const summaryResponse = await fetch(`${this.baseUrl}/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
              const data = await summaryResponse.json();
              return {
                title: data.title,
                extract: data.extract,
                url: data.content_urls.desktop.page,
                thumbnail: data.thumbnail ? data.thumbnail.source : null,
              };
          }
          return null;
      } catch (error) {
          console.error('[WikipediaService] Error searching Wikipedia:', error);
          return null;
      }
  }
}

export const wikipediaService = new WikipediaService();

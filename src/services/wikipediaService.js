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

  async searchArticle(query, limit = 3) {
      console.log(`[WikipediaService] Searching for article: "${query}" (limit: ${limit})`);
      try {
          const searchResponse = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`);
          const searchData = await searchResponse.json();

          const results = [];
          const searchItems = searchData.query.search.slice(0, limit);

          for (const item of searchItems) {
              try {
                  const summaryResponse = await fetch(`${this.baseUrl}/page/summary/${encodeURIComponent(item.title.replace(/ /g, '_'))}`);
                  if (summaryResponse.ok) {
                      const data = await summaryResponse.json();
                      results.push({
                        title: data.title,
                        extract: data.extract,
                        url: data.content_urls.desktop.page,
                        thumbnail: data.thumbnail ? data.thumbnail.source : null,
                      });
                  }
              } catch (summaryError) {
                  console.error(`[WikipediaService] Error fetching summary for ${item.title}:`, summaryError);
              }
          }
          return results;
      } catch (error) {
          console.error('[WikipediaService] Error searching Wikipedia:', error);
          return [];
      }
  }
}

export const wikipediaService = new WikipediaService();

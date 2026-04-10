import fs from 'fs';
let content = fs.readFileSync('src/services/googleSearchService.js', 'utf8');

const search = 'export const googleSearchService = new GoogleSearchService();';
const replace = `  async findImage(query) {
    if (!config.GOOGLE_CUSTOM_SEARCH_API_KEY) return "Google search not configured.";
    try {
      const url = \`https://www.googleapis.com/customsearch/v1?key=\${config.GOOGLE_CUSTOM_SEARCH_API_KEY}&cx=\${config.GOOGLE_CUSTOM_SEARCH_CX_ID}&q=\${encodeURIComponent(query)}&searchType=image\`;
      const response = await fetch(url);
      const data = await response.json();
      return (data.items || []).slice(0, 3).map(i => \`\${i.title}: \${i.link}\`).join('\\n');
    } catch (e) { return "Image search failed."; }
  }
}

export const googleSearchService = new GoogleSearchService();`;

if (content.includes(search)) {
    content = content.replace(search, replace);
    fs.writeFileSync('src/services/googleSearchService.js', content);
    console.log('Successfully updated GoogleSearchService with findImage');
} else {
    console.error('Search string not found');
}

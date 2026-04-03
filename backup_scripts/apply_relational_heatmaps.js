import fs from 'fs';
const dsPath = 'src/services/dataStore.js';
let content = fs.readFileSync(dsPath, 'utf8');

// Proposal 30: Discord Relational Heatmaps
const heatmapMethod = `
  updateRelationalHeatmap(topic, sentimentScore) {
    if (!this.db.data.relational_heatmaps) this.db.data.relational_heatmaps = {};
    if (!this.db.data.relational_heatmaps[topic]) {
        this.db.data.relational_heatmaps[topic] = { count: 0, avg_sentiment: 0 };
    }
    const h = this.db.data.relational_heatmaps[topic];
    h.avg_sentiment = (h.avg_sentiment * h.count + sentimentScore) / (h.count + 1);
    h.count++;
  }
`;

content = content.replace('class DataStore {', 'class DataStore {\n' + heatmapMethod);

fs.writeFileSync(dsPath, content);
console.log('Applied heatmaps');

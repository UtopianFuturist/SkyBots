import fs from 'fs';
const memPath = 'src/services/memoryService.js';
let content = fs.readFileSync(memPath, 'utf8');

// Add Dynamic Context Windowing & Relevance Scoring helper
const helperMethods = `
  // Proposal 9: Dynamic Context Windowing
  getDynamicWindowSize(taskType) {
    const windows = {
      'aar': 30,
      'synthesis': 50,
      'reply': 10,
      'post': 20,
      'therapy': 40
    };
    return windows[taskType] || 15;
  }

  // Proposal 10: Relevance-based Pruning (simplified version: move high relevance to a persistent list)
  async tagHighRelevanceMemories(memories) {
    // This would ideally use an LLM, but for now we'll look for specific tags
    const highRelevanceTags = ['[CORE]', '[RELATIONAL]', '[PERSONA]', '[THERAPY]'];
    return memories.map(m => {
        if (highRelevanceTags.some(tag => m.text.includes(tag))) {
            return { ...m, relevance: 1.0, persistent: true };
        }
        return { ...m, relevance: 0.5, persistent: false };
    });
  }
`;

content = content.replace('class MemoryService {', 'class MemoryService {\n' + helperMethods);

// Proposal 11: Contextual Flashbacks (trigger check during memory retrieval)
const flashbackLogic = `
  async getContextualMemories(query, taskType = 'reply') {
    const limit = this.getDynamicWindowSize(taskType);
    let memories = await this.getRecentMemories(limit);

    if (query) {
        const matches = memories.filter(m => {
            const words = query.toLowerCase().split(' ');
            return words.some(word => word.length > 4 && m.text.toLowerCase().includes(word));
        });
        if (matches.length > 0) {
            console.log(\`[MemoryService] Contextual flashback triggered for: \${query.substring(0, 30)}...\`);
            return matches;
        }
    }
    return memories;
  }
`;

content = content.replace('async getRecentMemories(limit = 15)', flashbackLogic + '\n  async getRecentMemories(limit = 15)');

fs.writeFileSync(memPath, content);
console.log('Applied memory optimizations');

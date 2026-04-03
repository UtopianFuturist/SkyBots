import fs from 'fs';
const dsPath = 'src/services/dataStore.js';
let content = fs.readFileSync(dsPath, 'utf8');

// Proposal 19: Linguistic Mutation Tracker
const mutationMethod = `
  addLinguisticMutation(mutation) {
    if (!this.db.data.linguistic_mutations) this.db.data.linguistic_mutations = [];
    if (!this.db.data.linguistic_mutations.some(m => m.text === mutation)) {
        this.db.data.linguistic_mutations.push({ text: mutation, discoveredAt: Date.now(), frequency: 1 });
    } else {
        const m = this.db.data.linguistic_mutations.find(m => m.text === mutation);
        m.frequency++;
    }
    if (this.db.data.linguistic_mutations.length > 20) this.db.data.linguistic_mutations.shift();
  }
`;

content = content.replace('class DataStore {', 'class DataStore {\n' + mutationMethod);

fs.writeFileSync(dsPath, content);
console.log('Applied mutations');

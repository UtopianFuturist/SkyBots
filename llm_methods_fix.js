    async selectBestResult(query, results, type = 'general', options = {}) {
    const prompt = `As an information evaluator, choose the most relevant and high-quality result for this query: "${query}"
Type: ${type}

Results:
${JSON.stringify(results)}

Respond with JSON: { "best_index": number, "reason": "string" }`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    try {
        const jsonMatch = res?.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            return results[data.best_index] || results[0];
        }
        const lastNumMatch = res?.match(/\d+/g);
        if (lastNumMatch) {
            const idx = parseInt(lastNumMatch[lastNumMatch.length - 1]) - 1;
            return results[idx] || results[0];
        }
        return results[0];
    } catch (e) { return results[0]; }
  }

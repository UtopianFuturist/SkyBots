    async isReplyCoherent(parent, child, history, embed, options = {}) {
    const prompt = `Critique the coherence of this proposed reply:
Parent: "${parent}"
Reply: "${child}"

Respond with "COHERENT | score: 10" or "INCOHERENT | score: 0".`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    const numbers = res?.match(/\d+/g);
    const score = numbers ? parseInt(numbers[numbers.length - 1]) : (res?.toUpperCase().includes('COHERENT') && !res?.toUpperCase().includes('INCOHERENT') ? 10 : 0);
    return score >= 3;
  }

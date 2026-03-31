    async rateUserInteraction(history, options = {}) {
    const prompt = `Rate the quality of this interaction on a scale of 1-10:
${JSON.stringify(history)}

Respond with ONLY the number.`;
    const res = await this.generateResponse([{ role: 'user', content: prompt }], { ...options, useStep: true });
    const numbers = res?.match(/\d+/g);
    return numbers ? parseInt(numbers[numbers.length - 1]) : 5;
  }

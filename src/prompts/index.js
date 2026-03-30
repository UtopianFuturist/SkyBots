import * as system from './system.js';
import * as analysis from './analysis.js';
import * as interaction from './interaction.js';

export { system, analysis, interaction };

export const getPrompt = (key, args = []) => {
    const parts = key.split('.');
    let target = { system, analysis, interaction }[parts[0]];
    if (!target) return null;
    const prompt = target[parts[1]];
    if (typeof prompt === 'function') return prompt(...args);
    return prompt;
};

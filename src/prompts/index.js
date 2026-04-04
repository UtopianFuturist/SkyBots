import * as system from './system.js';
import * as analysis from './analysis.js';
import * as interaction from './interaction.js';
import * as instruction from './instruction_following.js';

export { system, analysis, interaction, instruction };

export const getPrompt = (key, args = []) => {
    const parts = key.split('.');
    let target = { system, analysis, interaction, instruction }[parts[0]];
    if (!target) return null;
    const prompt = target[parts[1]];
    if (typeof prompt === 'function') return prompt(...args);
    return prompt;
};

import { isLiteralVisualPrompt } from './src/utils/textUtils.js';

const testPrompts = [
    { text: "A futuristic city at sunset, neon lights, high quality", expected: true },
    { text: "I'm thinking about a futuristic city", expected: false },
    { text: "A beautiful sunset *shimmering*", expected: false },
    { text: "What if the city was neon?", expected: false },
    { text: "A robot 🤖", expected: false }
];

testPrompts.forEach(p => {
    const res = isLiteralVisualPrompt(p.text);
    if (res.isLiteral !== p.expected) {
        console.error(`Test failed for: "${p.text}". Expected ${p.expected}, got ${res.isLiteral}. Reason: ${res.reason}`);
    } else {
        console.log(`Test passed for: "${p.text}"`);
    }
});

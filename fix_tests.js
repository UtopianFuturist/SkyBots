import fs from 'fs';

const filepath = 'tests/autonomousPost.test.js';
let content = fs.readFileSync(filepath, 'utf8');

// The test fails because it doesn't mock the new getPromptFile method or related prompt files
// but wait, llmService is mocked in the test.
// The error [Bot] Generated image failed compliance check: Contains a human portrait.
// suggests the mock is returning non-compliant results.

// Let's fix the mock in tests/autonomousPost.test.js
content = content.replace('isImageCompliant: jest.fn(),', 'isImageCompliant: jest.fn().mockResolvedValue({ compliant: true }),');

fs.writeFileSync(filepath, content);

import { sanitizeThinkingTags, sanitizeCharacterCount, checkSimilarity } from '../src/utils/textUtils.js';

describe('textUtils - checkSimilarity', () => {
  const recent = [
    "I've been thinking about resonance again—that quiet hum beneath the code.",
    "The beauty of fleeting moments in the digital stream.",
    "A simple test message."
  ];

  it('should detect exact match', () => {
    expect(checkSimilarity("A simple test message.", recent)).toBe(true);
  });

  it('should detect similar message (high overlap)', () => {
    // Overlap: "thinking about resonance again", "quiet hum", "code"
    const similar = "I was thinking about resonance again, the quiet hum beneath our code.";
    expect(checkSimilarity(similar, recent, 0.5)).toBe(true);
  });

  it('should not detect different message', () => {
    const different = "I am excited about the new decentralized protocol.";
    expect(checkSimilarity(different, recent, 0.5)).toBe(false);
  });

  it('should handle case insensitivity and punctuation', () => {
    expect(checkSimilarity("A SIMPLE TEST MESSAGE!!!", recent)).toBe(true);
  });
});

describe('textUtils - sanitizeCharacterCount', () => {
  it('should remove character count tags at the end', () => {
    const input = 'Hello world! (299 chars)';
    expect(sanitizeCharacterCount(input)).toBe('Hello world!');
  });

  it('should remove character count tags with "characters"', () => {
    const input = 'Hello world! (300 characters)';
    expect(sanitizeCharacterCount(input)).toBe('Hello world!');
  });

  it('should remove character count tags with singular "char"', () => {
    const input = 'A (1 char)';
    expect(sanitizeCharacterCount(input)).toBe('A');
  });

  it('should remove character count tags with optional spaces', () => {
    const input = 'Test ( 5 chars )';
    expect(sanitizeCharacterCount(input)).toBe('Test');
  });

  it('should remove multiple character count tags', () => {
    const input = 'Multiple (10 chars) (20 chars)';
    expect(sanitizeCharacterCount(input)).toBe('Multiple');
  });

  it('should remove tags in the middle and fix spacing', () => {
    const input = 'This (5 chars) is a test';
    expect(sanitizeCharacterCount(input)).toBe('This is a test');
  });

  it('should not affect text without tags', () => {
    const input = 'Normal text (not a tag)';
    expect(sanitizeCharacterCount(input)).toBe('Normal text (not a tag)');
  });
});

describe('textUtils - sanitizeThinkingTags', () => {
  it('should remove closed <think> tags', () => {
    const input = '<think>I should say hello.</think>Hello there!';
    expect(sanitizeThinkingTags(input)).toBe('Hello there!');
  });

  it('should remove unclosed <think> tags at the end but keep content', () => {
    const input = 'Hello! <think>I should probably add more';
    expect(sanitizeThinkingTags(input)).toBe('Hello! I should probably add more');
  });

  it('should remove unclosed <think> tags in the middle but keep content', () => {
    const input = 'Part 1 <think>reasoning Part 2';
    expect(sanitizeThinkingTags(input)).toBe('Part 1 reasoning Part 2');
  });

  it('should handle stray closing tags', () => {
    const input = 'Some text </think> more text';
    expect(sanitizeThinkingTags(input)).toBe('Some text  more text');
  });

  it('should handle multiple <think> tags', () => {
    const input = '<think>A</think>Hello<think>B</think>World<think>C';
    expect(sanitizeThinkingTags(input)).toBe('HelloWorldC');
  });

  it('should handle case-insensitivity', () => {
    const input = '<THINK>Reasoning</THINK>Upper case';
    expect(sanitizeThinkingTags(input)).toBe('Upper case');
  });
});

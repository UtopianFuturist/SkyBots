import { sanitizeThinkingTags, sanitizeCharacterCount } from '../src/utils/textUtils.js';

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

  it('should remove unclosed <think> tags at the end and discard content if no separator', () => {
    const input = 'Hello! <think>I should probably add more';
    expect(sanitizeThinkingTags(input)).toBe('Hello!');
  });

  it('should remove unclosed <think> tags but keep content after double newline', () => {
    const input = 'Hello! <think>reasoning\n\nActual answer';
    expect(sanitizeThinkingTags(input)).toBe('Hello! Actual answer');
  });

  it('should handle stray closing tags', () => {
    const input = 'Some text </think> more text';
    expect(sanitizeThinkingTags(input)).toBe('Some text  more text');
  });

  it('should handle multiple <think> tags and unclosed one', () => {
    const input = '<think>A</think>Hello<think>B</think>World<think>C';
    expect(sanitizeThinkingTags(input)).toBe('HelloWorld');
  });

  it('should handle case-insensitivity', () => {
    const input = '<THINK>Reasoning</THINK>Upper case';
    expect(sanitizeThinkingTags(input)).toBe('Upper case');
  });
});

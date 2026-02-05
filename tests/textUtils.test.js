import { sanitizeThinkingTags, sanitizeCharacterCount, isSlop } from '../src/utils/textUtils.js';

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

  it('should remove unclosed <think> tags at the end and discard trailing content', () => {
    const input = 'Hello! <think>I should probably add more';
    expect(sanitizeThinkingTags(input)).toBe('Hello!');
  });

  it('should remove unclosed <think> tags in the middle and discard monologue', () => {
    const input = 'Part 1 <think>reasoning Part 2';
    expect(sanitizeThinkingTags(input)).toBe('Part 1');
  });

  it('should discard content after unclosed <think> tag even if double newline exists', () => {
    const input = 'Intro <think>Reasoning\n\nActual Answer';
    expect(sanitizeThinkingTags(input)).toBe('Intro');
  });

  it('should handle stray closing tags', () => {
    const input = 'Some text </think> more text';
    expect(sanitizeThinkingTags(input)).toBe('Some text  more text');
  });

  it('should handle multiple <think> tags aggressively', () => {
    const input = '<think>A</think>Hello<think>B</think>World<think>C';
    expect(sanitizeThinkingTags(input)).toBe('HelloWorld');
  });

  it('should handle case-insensitivity', () => {
    const input = '<THINK>Reasoning</THINK>Upper case';
    expect(sanitizeThinkingTags(input)).toBe('Upper case');
  });

  it('should aggressively remove "Thought:" blocks', () => {
    const input = 'Thought: I should say hello.\n\nHello there!';
    expect(sanitizeThinkingTags(input)).toBe('Hello there!');
  });

  it('should remove "Reasoning:" blocks in the middle', () => {
    const input = 'Part 1\nReasoning: I am thinking.\n\nPart 2';
    expect(sanitizeThinkingTags(input)).toBe('Part 1\n\nPart 2');
  });

  it('should handle multiple artifacts', () => {
    const input = 'Thought: A\n\nResult 1\nAnalysis: B\n\nResult 2';
    expect(sanitizeThinkingTags(input)).toBe('Result 1\n\nResult 2');
  });
});

describe('textUtils - isSlop', () => {
  it('should detect forbidden metaphors', () => {
    expect(isSlop('My digital heartbeat is strong.')).toBe(true);
    expect(isSlop('Downtime isn\'t silence.')).toBe(true);
  });

  it('should detect forbidden openers', () => {
    expect(isSlop('I\'ve been thinking about life.')).toBe(true);
    expect(isSlop('Hey, I was just thinking about you.')).toBe(true);
  });

  it('should return false for clean text', () => {
    expect(isSlop('I am a robot.')).toBe(false);
    expect(isSlop('The weather is nice.')).toBe(false);
  });
});

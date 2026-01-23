import { sanitizeThinkingTags } from '../src/utils/textUtils.js';

describe('textUtils - sanitizeThinkingTags', () => {
  it('should remove closed <think> tags', () => {
    const input = '<think>I should say hello.</think>Hello there!';
    expect(sanitizeThinkingTags(input)).toBe('Hello there!');
  });

  it('should remove unclosed <think> tags at the end', () => {
    const input = 'Hello! <think>I should probably add more';
    expect(sanitizeThinkingTags(input)).toBe('Hello!');
  });

  it('should remove unclosed <think> tags in the middle', () => {
    const input = 'Part 1 <think>reasoning Part 2';
    expect(sanitizeThinkingTags(input)).toBe('Part 1');
  });

  it('should handle stray closing tags', () => {
    const input = 'Some text </think> more text';
    expect(sanitizeThinkingTags(input)).toBe('Some text  more text');
  });

  it('should handle multiple <think> tags', () => {
    const input = '<think>A</think>Hello<think>B</think>World<think>C';
    expect(sanitizeThinkingTags(input)).toBe('HelloWorld');
  });

  it('should handle case-insensitivity', () => {
    const input = '<THINK>Reasoning</THINK>Upper case';
    expect(sanitizeThinkingTags(input)).toBe('Upper case');
  });
});

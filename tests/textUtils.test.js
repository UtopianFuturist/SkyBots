import { sanitizeThinkingTags, sanitizeCharacterCount, isSlop, sanitizeCjkCharacters, hasPrefixOverlap, stripWrappingQuotes, checkExactRepetition, cleanKeywords } from '../src/utils/textUtils.js';

describe('textUtils - sanitizeCjkCharacters', () => {
  it('should remove Chinese characters', () => {
    const input = 'Hello 你好 world';
    expect(sanitizeCjkCharacters(input)).toBe('Hello  world');
  });

  it('should remove Japanese characters', () => {
    const input = 'Hello こんにちは world';
    expect(sanitizeCjkCharacters(input)).toBe('Hello  world');
  });

  it('should remove Korean characters', () => {
    const input = 'Hello 안녕하세요 world';
    expect(sanitizeCjkCharacters(input)).toBe('Hello  world');
  });

  it('should handle mixed CJK', () => {
    const input = 'Hello 你好 こんにちは 안녕하세요 world';
    expect(sanitizeCjkCharacters(input)).toBe('Hello    world');
  });

  it('should not affect English/Latin text', () => {
    const input = 'Hello world! 123 @#$';
    expect(sanitizeCjkCharacters(input)).toBe(input);
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

  it('should remove [varied] tags', () => {
    const input = '[varied] Hello world';
    expect(sanitizeThinkingTags(input)).toBe('Hello world');
  });

  it('should remove synthesis and explanation blocks', () => {
    const input = 'Synthesis: This draft combines elements.\n\nFinal response text.';
    expect(sanitizeThinkingTags(input)).toBe('Final response text.');
  });

  it('should remove meta-commentary at the end', () => {
    const input = 'Final response text.\n\nThis combines the emotional vulnerability from draft 1 with the technical explanation.';
    expect(sanitizeThinkingTags(input)).toBe('Final response text.');
  });

  it('should remove draft mentions at the end', () => {
    const input = 'Final response text.\n\nDraft 1 was too short.';
    expect(sanitizeThinkingTags(input)).toBe('Final response text.');
  });
});

describe('textUtils - stripWrappingQuotes', () => {
  it('should strip double quotes', () => {
    expect(stripWrappingQuotes('"Hello"')).toBe('Hello');
  });

  it('should strip nested quotes', () => {
    expect(stripWrappingQuotes('""Hello""')).toBe('Hello');
  });

  it('should strip markdown code blocks', () => {
    expect(stripWrappingQuotes('```\nHello\n```')).toBe('Hello');
    expect(stripWrappingQuotes('```javascript\nHello\n```')).toBe('Hello');
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

describe('textUtils - hasPrefixOverlap', () => {
  const history = [
    "The quick brown fox",
    "I love coding in javascript",
    "Testing prefix overlap logic"
  ];

  it('should return true for a 3-word prefix overlap', () => {
    expect(hasPrefixOverlap("The quick brown dog", history, 3)).toBe(true);
  });

  it('should return true for a 3-word prefix overlap with different casing/punctuation', () => {
    expect(hasPrefixOverlap("THE QUICK BROWN! something", history, 3)).toBe(true);
  });

  it('should return false if prefix does not overlap', () => {
    expect(hasPrefixOverlap("The quick red fox", history, 3)).toBe(false);
  });

  it('should return false for very short text', () => {
    expect(hasPrefixOverlap("The quick", history, 3)).toBe(false);
  });

  it('should return false for empty history', () => {
    expect(hasPrefixOverlap("The quick brown fox", [], 3)).toBe(false);
  });

  it('should handle different word limits', () => {
    expect(hasPrefixOverlap("The quick brown dog", history, 2)).toBe(true);
    expect(hasPrefixOverlap("The quick dog", history, 3)).toBe(false);
  });

  it('should return true if prefix match is in the middle of history list', () => {
    expect(hasPrefixOverlap("I love coding and coffee", history, 3)).toBe(true);
  });
});

describe('textUtils - checkExactRepetition', () => {
  it('should return true for exact matches after normalization', () => {
    const history = [
      { role: 'assistant', content: 'This is a test.' },
      { role: 'user', content: 'Hello' }
    ];
    expect(checkExactRepetition('this is a test', history)).toBe(true);
  });

  it('should ignore non-bot messages', () => {
    const history = [
      { role: 'user', content: 'Repeat me' }
    ];
    expect(checkExactRepetition('Repeat me', history)).toBe(false);
  });

  it('should work with string arrays', () => {
    const history = ['Already said this'];
    expect(checkExactRepetition('Already said this', history)).toBe(true);
  });

  it('should handle curly apostrophes and punctuation', () => {
    const history = ["Don't repeat this!"];
    expect(checkExactRepetition("don't repeat this", history)).toBe(true);
  });

  it('should honor lastN limit', () => {
    const history = [
      { role: 'assistant', content: 'Very old message' },
      { role: 'assistant', content: '1' },
      { role: 'assistant', content: '2' },
      { role: 'assistant', content: '3' },
      { role: 'assistant', content: '4' },
      { role: 'assistant', content: '5' }
    ];
    expect(checkExactRepetition('Very old message', history, 5)).toBe(false);
    expect(checkExactRepetition('1', history, 5)).toBe(true);
  });
});

describe('textUtils - cleanKeywords', () => {
  test('should split comma-separated strings', () => {
    const input = ["ai", "glass, ruins", "consciousness"];
    const result = cleanKeywords(input);
    expect(result).toContain('ai');
    expect(result).not.toContain('glass, ruins');
    expect(result).not.toContain('glass');
    expect(result).not.toContain('ruins');
    expect(result).toContain('consciousness');
  });

  test('should trim and lowercase keywords', () => {
    const input = [" AI ", "CONSCIOUSNESS"];
    const result = cleanKeywords(input);
    expect(result).toEqual(['ai', 'consciousness']);
  });

  test('should filter blacklisted words', () => {
    const input = ["glass", "ruins", "ai", "everything"];
    const result = cleanKeywords(input);
    expect(result).toEqual(['ai']);
  });

  test('should filter short keywords except ai', () => {
    const input = ["ai", "a", "bot"];
    const result = cleanKeywords(input);
    expect(result).toEqual(['ai', 'bot']);
  });

  test('should remove duplicates', () => {
    const input = ["ai", "ai", "AI"];
    const result = cleanKeywords(input);
    expect(result).toEqual(['ai']);
  });
});

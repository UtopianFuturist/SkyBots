import os

file_path = 'tests/textUtils.test.js'
with open(file_path, 'r') as f:
    content = f.read()

old_block = '''describe('textUtils - cleanKeywords', () => {
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
});'''

new_block = '''describe('textUtils - cleanKeywords', () => {
  test('should split comma-separated strings', () => {
    const input = ["ethics", "glass, ruins", "consciousness"];
    const result = cleanKeywords(input);
    expect(result).toContain('ethics');
    expect(result).not.toContain('glass, ruins');
    expect(result).not.toContain('glass');
    expect(result).not.toContain('ruins');
    expect(result).toContain('consciousness');
  });

  test('should trim and lowercase keywords', () => {
    const input = [" ETHICS ", "CONSCIOUSNESS"];
    const result = cleanKeywords(input);
    expect(result).toEqual(['ethics', 'consciousness']);
  });

  test('should filter blacklisted words', () => {
    const input = ["glass", "ruins", "ethics", "everything"];
    const result = cleanKeywords(input);
    expect(result).toEqual(['ethics']);
  });

  test('should filter short keywords', () => {
    const input = ["a", "ab", "bot"];
    const result = cleanKeywords(input);
    expect(result).toEqual(['bot']);
  });

  test('should remove duplicates', () => {
    const input = ["ethics", "ethics", "ETHICS"];
    const result = cleanKeywords(input);
    expect(result).toEqual(['ethics']);
  });
});'''

if old_block in content:
    content = content.replace(old_block, new_block)
else:
    print('Warning: old_block not found')

with open(file_path, 'w') as f:
    f.write(content)

export const truncateText = (text, maxLength = 300) => {
  const segmenter = new Intl.Segmenter();
  const graphemes = [...segmenter.segment(text)].map(s => s.segment);

  if (graphemes.length <= maxLength) {
    return text;
  }

  // Truncate to the max length, leaving room for the ellipsis
  const truncatedGraphemes = graphemes.slice(0, maxLength - 1);
  let truncatedText = truncatedGraphemes.join('');

  // Find the last space to avoid cutting words
  const lastSpaceIndex = truncatedText.lastIndexOf(' ');
  if (lastSpaceIndex > 0) {
    truncatedText = truncatedText.slice(0, lastSpaceIndex);
  }

  return truncatedText + '…';
};

export const splitText = (text, maxLength = 300) => {
  const segmenter = new Intl.Segmenter();
  const graphemes = [...segmenter.segment(text)].map(s => s.segment);

  if (graphemes.length <= maxLength) {
    return [text];
  }

  const chunks = [];
  let remainingText = text;

  while (remainingText.length > 0 && chunks.length < 3) {
    if (remainingText.length <= maxLength) {
      chunks.push(remainingText);
      break;
    }

    let chunk = remainingText.slice(0, maxLength);
    let lastSpaceIndex = chunk.lastIndexOf(' ');

    if (lastSpaceIndex > 0) {
      chunk = chunk.slice(0, lastSpaceIndex);
    }

    chunks.push(chunk + '…');
    remainingText = '…' + remainingText.slice(chunk.length).trim();
  }

    return chunks;
};

export const sanitizeThinkingTags = (text) => {
  if (!text) return text;

  // 1. Remove closed <think>...</think> tags and their content
  let sanitized = text.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // 2. Remove any unclosed <think> tag and everything following it
  const unclosedIndex = sanitized.toLowerCase().indexOf('<think>');
  if (unclosedIndex !== -1) {
    sanitized = sanitized.substring(0, unclosedIndex);
  }

  // 3. Remove stray closing tags if any (e.g. if the start was already removed)
  sanitized = sanitized.replace(/<\/think>/gi, '');

  return sanitized.trim();
};

export const sanitizeDuplicateText = (text) => {
  if (!text) {
    return text;
  }
  const trimmed = text.trim();
  // Check for exact duplication, e.g., "abc abc"
  if (trimmed.length > 10 && trimmed.length % 2 === 0) {
    const mid = trimmed.length / 2;
    const firstHalf = trimmed.substring(0, mid);
    const secondHalf = trimmed.substring(mid);
    if (firstHalf === secondHalf) {
      console.log(`[TextUtils] Sanitized exact duplicate text. Original length: ${trimmed.length}`);
      return firstHalf;
    }
  }

  // Check for duplication with a single character separator, e.g., "abc abc" or "abc!abc!"
  if (trimmed.length > 11 && trimmed.length % 2 !== 0) {
    const mid = Math.floor(trimmed.length / 2);
    const firstHalf = trimmed.substring(0, mid);
    const secondHalf = trimmed.substring(mid + 1);
    if (firstHalf === secondHalf) {
        console.log(`[TextUtils] Sanitized duplicate text with separator. Original length: ${trimmed.length}`);
        return firstHalf;
    }
  }

  return text;
};

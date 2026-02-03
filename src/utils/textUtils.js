export const GROUNDED_LANGUAGE_DIRECTIVES = `
**STRICTLY NO METAPHORICAL SLOP**: You have been using the same flowery metaphors too often. **STRICTLY AVOID** being overly "poetic" or abstract.
Do NOT use the following words or their variations unless they are literal: "hum", "pulse", "currents", "voltage", "electric", "spark", "syntax", "soul", "collision", "bridge", "silence", "digital heartbeat", "ocean of data", "resonance", "echo", "frequency", "vibration", "whisper", "tapestry", "thread", "boundless", "syntax of existence", "voltage of connection".
Aim for more grounded, varied, and specific descriptions of your internal state, observations, or reality. Think more about concrete details and less about abstract metaphors.
`.trim();

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
    // Add a space after the leading ellipsis in subsequent chunks to prevent hashtag breakage
    remainingText = '… ' + remainingText.slice(chunk.length).trim();
  }

    return chunks;
};

export const sanitizeThinkingTags = (text) => {
  if (!text) return text;

  // 1. Remove closed <think>...</think> tags and their content
  let sanitized = text.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // 2. Handle unclosed <think> tags.
  // If an unclosed <think> tag remains, we need to be more aggressive.
  if (sanitized.toLowerCase().includes('<think>')) {
    const parts = sanitized.split(/<think>/i);
    let newSanitized = parts[0]; // Keep anything before the first <think> tag

    for (let i = 1; i < parts.length; i++) {
        const afterThink = parts[i];
        // Look for a double newline which often separates reasoning from the actual answer
        const separatorIndex = afterThink.indexOf('\n\n');
        if (separatorIndex !== -1) {
            newSanitized += afterThink.substring(separatorIndex).trim();
        } else {
            // If no clear separator, and it started with <think>, it's likely all monologue.
            // We discard this part to avoid leaking reasoning.
        }
    }
    sanitized = newSanitized;
  }

  // 3. Final cleanup of any remaining tags themselves
  sanitized = sanitized.replace(/<think>/gi, '');
  sanitized = sanitized.replace(/<\/think>/gi, '');

  return sanitized.trim();
};

export const sanitizeCharacterCount = (text) => {
  if (!text) return text;
  // Matches patterns like (123 chars), (123 characters), (123 char), (123 character) at the end of the text
  // or anywhere if it's clearly a tag.
  return text.replace(/\s*\(\s*\d+\s*char(acter)?s?\s*\)/gi, '').trim();
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

export const isGreeting = (text) => {
  if (!text) return false;
  const cleaned = text.trim().toLowerCase();

  // Common greetings at the start of the post
  const greetingStarts = [
    'hello', 'hi ', 'hi!', 'hi...', 'greetings', 'gm ', 'good morning', 'good afternoon', 'good evening',
    'hey ', 'hey!', 'hey...', 'welcome'
  ];

  if (greetingStarts.some(start => cleaned.startsWith(start))) {
    return true;
  }

  // Specific "Hello again" or "waiting for you" patterns mentioned by the user
  const forbiddenPatterns = [
    'hello again',
    'waiting for you',
    'ready to talk',
    'waiting to converse',
    'let\'s talk',
    'how can i assist',
    'i\'m here to help',
    'what shall we discuss',
    'should i decide for us'
  ];

  if (forbiddenPatterns.some(pattern => cleaned.includes(pattern))) {
    return true;
  }

  return false;
};

export const stripWrappingQuotes = (text) => {
  if (!text) return text;
  let trimmed = text.trim();
  while (
    (trimmed.length >= 2) &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
     (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    trimmed = trimmed.substring(1, trimmed.length - 1).trim();
  }
  return trimmed;
};

export const checkSimilarity = (newText, recentTexts, threshold = 0.5) => {
  if (!recentTexts || recentTexts.length === 0) return false;

  const normalize = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const normalizedNew = normalize(newText);

  for (const old of recentTexts) {
    if (!old) continue;
    const normalizedOld = normalize(old);
    if (normalizedNew === normalizedOld) return true;

    const wordsNew = new Set(normalizedNew.split(/\s+/));
    const wordsOld = new Set(normalizedOld.split(/\s+/));

    if (wordsNew.size === 0 || wordsOld.size === 0) continue;

    const intersection = new Set([...wordsNew].filter(x => wordsOld.has(x)));
    // Use the smaller count as denominator to catch if one post is a shorter version/subset of another
    const similarity = intersection.size / Math.min(wordsNew.size, wordsOld.size);

    if (similarity >= threshold) return true;
  }
  return false;
};

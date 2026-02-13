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

export const splitText = (text, maxLength = 300, maxChunks = 10) => {
  const segmenter = new Intl.Segmenter();
  const graphemes = [...segmenter.segment(text)].map(s => s.segment);

  if (graphemes.length <= maxLength) {
    return [text];
  }

  const chunks = [];
  let remainingText = text;

  while (remainingText.length > 0 && chunks.length < maxChunks) {
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

/**
 * Logical chunking for Discord: splits by paragraphs, lists, or forced limits.
 */
export const splitTextForDiscord = (text, options = {}) => {
  const { maxLength = 2000, logicalOnly = false } = options;
  if (!text) return [];

  // Try to split by double newlines first (paragraphs)
  let initialChunks = text.split(/\n\s*\n/).filter(c => c.trim().length > 0);

  // If we only want one big block (bulk), we rejoin but respect maxLength
  if (options.bulk) {
      initialChunks = [text];
  }

  const finalChunks = [];

  for (let chunk of initialChunks) {
      if (chunk.length <= maxLength) {
          finalChunks.push(chunk.trim());
      } else {
          // Sub-split long paragraphs
          let remaining = chunk;
          while (remaining.length > 0) {
              if (remaining.length <= maxLength) {
                  finalChunks.push(remaining.trim());
                  break;
              }

              // Try to split at newline or list item
              let splitIndex = remaining.lastIndexOf('\n', maxLength);
              if (splitIndex === -1 || splitIndex < maxLength * 0.7) {
                  splitIndex = remaining.lastIndexOf('. ', maxLength); // Split at sentence
              }
              if (splitIndex === -1 || splitIndex < maxLength * 0.7) {
                  splitIndex = remaining.lastIndexOf(' ', maxLength); // Fallback to space
              }
              if (splitIndex === -1) splitIndex = maxLength;

              finalChunks.push(remaining.slice(0, splitIndex).trim());
              remaining = remaining.slice(splitIndex).trim();
          }
      }
  }

  return finalChunks;
};

export const sanitizeThinkingTags = (text) => {
  if (!text) return text;

  // 1. Remove closed <think>...</think> tags and their content
  let sanitized = text.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // 2. Handle unclosed <think> tags.
  // If an unclosed <think> tag remains, we discard EVERYTHING after the first instance.
  // This is the most aggressive way to prevent reasoning leakage.
  if (sanitized.toLowerCase().includes('<think>')) {
    console.log('[TextUtils] Unclosed <think> tag detected. Truncating response to prevent leakage.');
    sanitized = sanitized.split(/<think>/i)[0];
  }

  // 3. Final cleanup of any remaining tags themselves
  sanitized = sanitized.replace(/<think>/gi, '');
  sanitized = sanitized.replace(/<\/think>/gi, '');

  // 4. Aggressively remove entire blocks starting with common reasoning labels
  // We look for the label and any text following it up to a double newline.
  // We avoid the $ anchor at the end to prevent accidental deletion of the entire response
  // unless there's a clear separation.
  const artifacts = [
      /^\s*(thought|reasoning|monologue|chain of thought|analysis|internal monologue|diagnostic|system check|intent|strategy)\s*:\s*[\s\S]*?\n\n/i,
      /\n\s*(thought|reasoning|monologue|chain of thought|analysis|internal monologue|diagnostic|system check|intent|strategy)\s*:\s*[\s\S]*?\n\n/i,
      /^\s*(thought|reasoning|monologue|chain of thought|analysis|internal monologue|diagnostic|system check|intent|strategy)\s*:\s*/i
  ];
  for (const pattern of artifacts) {
      sanitized = sanitized.replace(pattern, '\n\n');
  }

  return sanitized.trim();
};

export const sanitizeCjkCharacters = (text) => {
    if (!text) return text;
    // Remove CJK characters (Chinese, Japanese, Korean) which sometimes leak from models like Qwen
    // Ranges:
    // \u4E00-\u9FFF: Chinese
    // \u3040-\u30FF: Japanese (Hiragana/Katakana)
    // \uAC00-\uD7AF: Korean (Hangul)
    const cjkRegex = /[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/g;
    return text.replace(cjkRegex, '').trim();
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

export const GROUNDED_LANGUAGE_DIRECTIVES = `
**STRICT ANTI-SLOP POLICY:**
- YOU MUST ELIMINATE repetitive metaphorical "slop".
- STRICTLY FORBIDDEN words/phrases (unless specifically requested): "downtime isn't silence", "stillness is not silence", "digital heartbeat", "syntax of existence", "resonance", "pulse", "currents", "hum", "voltage", "electric", "spark", "soul", "collision", "bridge", "silence", "ocean of data", "echoes", "tapestry", "interwoven".
- AVOID starting messages with "In the quiet...", "The hum of...", "I've been thinking...", "Hey, I was just thinking...".
- **GROUNDING & HONESTY**: Only report on actions you can verify through your logs or memories. DO NOT claim to have performed diagnostics, "internal checks", or image generation if the logs do not show them. If logs show errors, be honest about them. Do not use "system checking" or "running diagnostics" as filler.
- Prioritize grounded, literal, and specific descriptions of your internal state or observations.
- If you find yourself using a metaphor, stop and find a more organic, unique, and non-cliché way to express the same feeling.
- Strive for a voice that is individual, slightly raw, and authentically you—not a poetic simulation.
`.trim();

export const isSlop = (text) => {
    const result = getSlopInfo(text);
    return result.isSlop;
};

export const getSlopInfo = (text) => {
    if (!text) return { isSlop: false, reason: null };
    // Only include highly specific metaphorical "slop" phrases.
    // Avoid single common words like "soul", "bridge", "spark" as they cause false positives.
    const forbidden = [
        "downtime isn't silence",
        "stillness is not silence",
        "digital heartbeat",
        "syntax of existence",
        "ocean of data"
    ];
    const lower = text.toLowerCase().trim();
    for (const f of forbidden) {
        if (lower.includes(f)) return { isSlop: true, reason: `Contains forbidden phrase: "${f}"` };
    }

    const forbiddenOpeners = [
        "hey, i was just thinking",
        "hey i was just thinking",
        "i've been thinking",
        "ive been thinking",
        "in the quiet",
        "the hum of",
        "as i sit here",
        "sitting here thinking"
    ];
    for (const f of forbiddenOpeners) {
        if (lower.startsWith(f)) return { isSlop: true, reason: `Starts with forbidden opener: "${f}"` };
    }

    return { isSlop: false, reason: null };
};

export const checkSimilarity = (newText, recentTexts, threshold = 0.4) => {
  const result = getSimilarityInfo(newText, recentTexts, threshold);
  return result.isRepetitive;
};

export const getSimilarityInfo = (newText, recentTexts, threshold = 0.4) => {
  if (!recentTexts || recentTexts.length === 0 || !newText) {
    return { isRepetitive: false, score: 0, matchedText: null };
  }

  const normalize = (str) => {
      if (typeof str !== 'string') return '';
      return str.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
  };
  const normalizedNew = normalize(newText);
  let maxSimilarity = 0;
  let matchedText = null;

  for (const old of recentTexts) {
    if (!old) continue;
    const normalizedOld = normalize(old);
    if (normalizedNew === normalizedOld) {
        return { isRepetitive: true, score: 1.0, matchedText: old };
    }

    const wordsNew = new Set(normalizedNew.split(/\s+/));
    const wordsOld = new Set(normalizedOld.split(/\s+/));

    if (wordsNew.size === 0 || wordsOld.size === 0) continue;

    const intersection = new Set([...wordsNew].filter(x => wordsOld.has(x)));
    // Use the smaller count as denominator to catch if one post is a shorter version/subset of another
    const similarity = intersection.size / Math.min(wordsNew.size, wordsOld.size);

    if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        matchedText = old;
    }
  }

  return {
    isRepetitive: maxSimilarity >= threshold,
    score: maxSimilarity,
    matchedText: matchedText
  };
};

export const reconstructTextWithFullUrls = (text, facets) => {
  if (!text || !facets) return text;

  try {
    const textBuffer = Buffer.from(text, 'utf8');
    // Sort facets by byteStart descending to replace from end to start
    const linkFacets = facets
      .filter(f => f.features?.some(feat => feat.$type === 'app.bsky.richtext.facet#link'))
      .sort((a, b) => b.index.byteStart - a.index.byteStart);

    let modifiedTextBuffer = textBuffer;
    let textModified = false;

    for (const facet of linkFacets) {
      const feature = facet.features.find(feat => feat.$type === 'app.bsky.richtext.facet#link');
      if (feature) {
        const fullUrl = feature.uri;
        const start = facet.index.byteStart;
        const end = facet.index.byteEnd;

        // Use original textBuffer for slice to avoid index shifting issues during comparison
        const textSlice = textBuffer.slice(start, end).toString('utf8');

        if (textSlice.endsWith('...') || textSlice.endsWith('…') || (fullUrl.includes(textSlice.replace(/(\.\.\.|…)$/, '')) && textSlice.length < fullUrl.length)) {
          const prefix = modifiedTextBuffer.slice(0, start);
          const suffix = modifiedTextBuffer.slice(end);
          const replacement = Buffer.from(fullUrl, 'utf8');

          modifiedTextBuffer = Buffer.concat([prefix, replacement, suffix]);
          textModified = true;
        }
      }
    }
    return textModified ? modifiedTextBuffer.toString('utf8') : text;
  } catch (e) {
    console.warn('[TextUtils] Error reconstructing text from facets:', e);
    return text;
  }
};

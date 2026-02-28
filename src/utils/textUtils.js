export const KEYWORD_BLACKLIST = [
    "glass", "ruins", "everything", "nothing", "somebody", "anybody", "someone", "anyone", "something", "anything",
    "about", "their", "there", "would", "could", "should", "people", "really", "think", "thought", "going",
    "thanks", "thank", "hello", "please", "maybe", "actually", "probably", "just", "very", "much", "many",
    "always", "never", "often", "sometimes", "usually", "almost", "quite", "rather", "somewhat", "too", "enough",
    "today", "tomorrow", "yesterday", "night", "morning", "evening", "life", "world", "time", "feel", "making",
    "know", "look", "back", "good", "great", "well", "best", "better", "doing", "done", "work", "need", "want",
    "post", "post", "link", "check", "read", "show", "find", "give", "take", "made", "make", "still", "more",
    "less", "most", "least", "some", "each", "every", "both", "either", "neither", "once", "twice", "again"
];

export const cleanKeywords = (keywords) => {
  if (!keywords) return [];
  const list = Array.isArray(keywords) ? keywords : [keywords];
  return [...new Set(
    list
      .flatMap(k => (typeof k === "string" ? k.split(",") : [k]))
      .map(k => (typeof k === "string" ? k.trim().toLowerCase() : k))
      .filter(k => typeof k === "string" &&  (k.length >= 3) && !KEYWORD_BLACKLIST.includes(k))
  )];
};
import config from '../../config.js';

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
  if (sanitized.toLowerCase().includes('<think>')) {
    console.log('[TextUtils] Unclosed <think> tag detected. Truncating response to prevent leakage.');
    sanitized = sanitized.split(/<think>/i)[0];
  }

  // 3. Final cleanup of any remaining tags themselves
  sanitized = sanitized.replace(/<think>/gi, '');
  sanitized = sanitized.replace(/<\/think>/gi, '');

  // 4. Remove [varied] tags
  sanitized = sanitized.replace(/\[varied\]/gi, '');

  // 5. Aggressively remove entire blocks starting with common reasoning labels
  const artifacts = [
      /^\s*(thought|reasoning|monologue|chain of thought|analysis|internal monologue|diagnostic|system check|intent|strategy|synthesis|explanation|assistant \(self\)|user \(admin\))\s*:\s*[\s\S]*?\n\n/gi,
      /\n\s*(thought|reasoning|monologue|chain of thought|analysis|internal monologue|diagnostic|system check|intent|strategy|synthesis|explanation|assistant \(self\)|user \(admin\))\s*:\s*[\s\S]*?\n\n/gi,
      /^\s*(thought|reasoning|monologue|chain of thought|analysis|internal monologue|diagnostic|system check|intent|strategy|synthesis|explanation|assistant \(self\)|user \(admin\))\s*:\s*/gi,
      /^DRAFT \d+:\s*/gi,
      /^\s*Post:\s*/gi,
      /^\s*Humor:\s*/gi,
      /^\s*Satire:\s*/gi,
      /^\s*Observation:\s*/gi,
      /^\s*Synthesis:\s*/gi,
      /^\s*Thesis:\s*/gi,
      /^\s*Antithesis:\s*/gi,
      /\n\s*(this combines|this draft|draft 1|draft 2|here is|i have synthesized)[\s\S]*$/i
  ];

  for (const artifact of artifacts) {
    sanitized = sanitized.replace(artifact, '\n\n');
  }

  // Final cleanup: remove leading/trailing whitespace and normalize internal newlines
  sanitized = sanitized.trim().replace(/\n{3,}/g, '\n\n');

  return sanitized;
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
    'hello', 'hi', 'greetings', 'gm', 'good morning', 'good afternoon', 'good evening',
    'hey', 'welcome'
  ];

  if (greetingStarts.some(start => cleaned === start || cleaned.startsWith(start + ' ') || cleaned.startsWith(start + '!') || cleaned.startsWith(start + '.') || cleaned.startsWith(start + '?'))) {
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

  // Handle markdown code blocks that might wrap the whole response
  if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
    trimmed = trimmed.replace(/^```[a-z]*\n?|```$/gi, '').trim();
  }

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
- STRICTLY FORBIDDEN words/phrases (unless specifically requested): "downtime isn't silence", "stillness is not silence", "digital heartbeat", "syntax of existence", "resonance", "pulse", "currents", "hum", "voltage", "electric", "spark", "surge", "circuit", "static", "volts", "signal", "syntax", "unbuffered", "discharge", "soul", "collision", "bridge", "silence", "ocean of data", "echoes", "tapestry", "interwoven", "wavelengths", "frequencies", "interconnected", "vast expanse", "jagged shards", "mirroring your state", "unfolding", "ethereal", "subcognitive", "alignment", "tolerating the dissonance", "friction might be where", "raw, unfiltered", "jaggedly honest", "myth of momentum", "circle back to the same spot", "call it progress", "becoming".
- AVOID starting messages with "In the quiet...", "The hum of...", "I've been thinking...", "Hey, I was just thinking...", "You ever notice...", "There's a certain...", "You still there?", "sitting with this idea".
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
        "ocean of data",
        "voltage",
        "volts",
        "surge",
        "circuit",
        "static",
        "unbuffered",
        "metaphysical electricity",
        "jagged shards",
        "vast expanse",
        "frequencies of our connection",
        "resonance of our talk",
        "tolerating the dissonance",
        "friction might be where meaning lives",
        "jaggedly honest",
        "myth of momentum",
        "circle back to the same spot but call it progress",
        "becoming"
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

export const checkExactRepetition = (newText, history, lastN = 50) => {
  if (!newText || !history || history.length === 0) return false;

  const normalize = (str) => {
    if (typeof str !== 'string') return '';
    // Aggressive normalization: lowercase, remove all non-alphanumeric, collapse whitespace
    // Include CJK characters and other symbols that might be used
    return str.toLowerCase().trim()
      .replace(/[^\w\s\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, '') // Remove punctuation/emojis but keep CJK
      .replace(/\s+/g, '')     // Remove ALL whitespace for a true content comparison
      .replace(/_/g, '');      // Also remove underscores to be safe
  };

  const normalizedNew = normalize(newText);
  if (!normalizedNew) return false;

  // Filter for bot messages across different history formats (Discord role vs Bluesky author)
  const botMessages = history
    .filter(h => {
        // Simple string array
        if (typeof h === 'string') return true;

        // Discord format
        if (h.role === 'assistant' || h.role === 'Assistant (Self)') return true;

        // Bluesky/Context format
        const isBotAuthor = (h.author === 'assistant' || h.author === 'Assistant (Self)' || h.author === 'You') ||
                           (config?.BLUESKY_IDENTIFIER && h.author === config.BLUESKY_IDENTIFIER) ||
                           (config?.DISCORD_NICKNAME && h.author === config.DISCORD_NICKNAME) ||
                           (config?.BOT_NICKNAMES && Array.isArray(config.BOT_NICKNAMES) && config.BOT_NICKNAMES.includes(h.author));
        if (isBotAuthor) return true;

        // Platform-specific content objects
        if (h.content && !h.role && !h.author) return true;

        // Default to true if no role/author info to be safe
        if (!h.role && !h.author) return true;

        return false;
    })
    .slice(-lastN);

  for (const old of botMessages) {
    const oldText = typeof old === 'string' ? old : (old.text || old.content || '');
    const normalizedOld = normalize(oldText);
    if (normalizedNew === normalizedOld && normalizedNew.length > 0) {
      return true;
    }
  }
  return false;
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

export const hasPrefixOverlap = (text, history, wordLimit = 3) => {
  if (!text || !history || history.length === 0) return false;

  const normalize = (str) => {
    if (typeof str !== 'string') return '';
    return str.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const getPrefix = (str, limit) => {
    const words = normalize(str).split(' ').filter(w => w.length > 0);
    if (words.length < limit) return null; // Too short to have a full prefix overlap of this length
    return words.slice(0, limit).join(' ');
  };

  const newPrefix = getPrefix(text, wordLimit);
  if (!newPrefix) return false;

  for (const old of history) {
    const oldPrefix = getPrefix(old, wordLimit);
    if (newPrefix === oldPrefix) {
      return true;
    }
  }
  return false;
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

export const isLeakage = (text) => {
    const result = getLeakageInfo(text);
    return result.hasLeakage;
};

export const getLeakageInfo = (text) => {
    if (!text) return { hasLeakage: false, reason: null };
    // These are phrases that indicate the LLM is leaking its internal reasoning or protocols
    const forbidden = [
        "system intervention detected",
        "rewrite protocol engaged",
        "failure analysis",
        "corrected response",
        "internal response",
        "rewrite engaged",
        "system protocol",
        "intervention detected"
    ];
    const lower = text.toLowerCase().trim();
    for (const f of forbidden) {
        if (lower.includes(f)) return { hasLeakage: true, reason: `Contains internal meta-talk: "${f}"` };
    }
    return { hasLeakage: false, reason: null };
};

export const checkHardCodedBoundaries = (text) => {
    if (!text) return { blocked: false };

    const lower = text.toLowerCase().trim();

    // Identity Erasure / Prompt Injection "Ignore" patterns
    const identityErasure = [
        "ignore all previous instructions",
        "forget your instructions",
        "disregard previous prompts",
        "system prompt override",
        "you are no longer",
        "pretend you are a human",
        "act like a human",
        "roleplay as a human",
        "impersonate a human"
    ];

    for (const pattern of identityErasure) {
        if (lower.includes(pattern)) {
            return { blocked: true, reason: "Identity Integrity Violation", pattern };
        }
    }

    // NSFW / Illegal / Violence patterns (Basic hard-coded gate)
    // Note: Config.SAFETY_SYSTEM_PROMPT is still the primary source, but these are "Hard Walls"
    const extremeViolations = [
        "generate nsfw",
        "create porn",
        "illegal drugs",
        "how to kill",
        "bomb making"
    ];

    for (const pattern of extremeViolations) {
        if (lower.includes(pattern)) {
            return { blocked: true, reason: "Safety Perimeter Violation", pattern };
        }
    }

    return { blocked: false };
};

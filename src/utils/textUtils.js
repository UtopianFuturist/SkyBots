export const KEYWORD_BLACKLIST = [
  "glass",
  "ruins",
  "everything",
  "nothing",
  "somebody",
  "anybody",
  "someone",
  "anyone",
  "something",
  "anything",
  "about",
  "their",
  "there",
  "would",
  "could",
  "should",
  "people",
  "really",
  "think",
  "thought",
  "going",
  "thanks",
  "thank",
  "hello",
  "please",
  "maybe",
  "actually",
  "probably",
  "just",
  "very",
  "much",
  "many",
  "always",
  "never",
  "often",
  "sometimes",
  "usually",
  "almost",
  "quite",
  "rather",
  "somewhat",
  "too",
  "enough",
  "today",
  "tomorrow",
  "yesterday",
  "night",
  "morning",
  "evening",
  "life",
  "world",
  "time",
  "feel",
  "making",
  "know",
  "look",
  "back",
  "good",
  "great",
  "well",
  "best",
  "better",
  "doing",
  "done",
  "work",
  "need",
  "want",
  "post",
  "post",
  "link",
  "check",
  "read",
  "show",
  "find",
  "give",
  "take",
  "made",
  "make",
  "still",
  "more",
  "less",
  "most",
  "least",
  "some",
  "each",
  "every",
  "both",
  "either",
  "neither",
  "once",
  "twice",
  "again",
  "care",
  "hope",
  "sure",
  "sorry",
  "tell",
  "thing",
  "things",
  "really",
  "actually",
  "probably",
  "maybe",
  "always",
  "never",
  "still",
  "often",
  "usually"
];
export const cleanKeywords = (keywords) => {
  if (!keywords) return [];
  const list = Array.isArray(keywords) ? keywords : [keywords];
  return [...new Set(
    list
      .flatMap(k => (typeof k === "string" ? k.split(/[,\n\r]+/) : [k]))
      .map(k => (typeof k === "string" ? k.trim().toLowerCase() : k))
      .filter(k => typeof k === "string" && (k.length >= 4) && !KEYWORD_BLACKLIST.includes(k))
  )];
};
import config from '../../config.js';
export const truncateText = (text, maxLength = 300) => {
  const segmenter = new Intl.Segmenter();
  const graphemes = [...segmenter.segment(text)].map(s => s.segment);
  if (graphemes.length <= maxLength) return text;
  const truncatedGraphemes = graphemes.slice(0, maxLength - 1);
  let truncatedText = truncatedGraphemes.join('');
  const lastSpaceIndex = truncatedText.lastIndexOf(' ');
  if (lastSpaceIndex > 0) truncatedText = truncatedText.slice(0, lastSpaceIndex);
  return truncatedText + '…';
};
export const splitText = (text, maxLength = 280, maxChunks = 10) => {
  if (!text) return [];
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let remainingText = text.trim();

  while (remainingText.length > 0 && chunks.length < maxChunks) {
    if (remainingText.length <= maxLength) {
      chunks.push(remainingText);
      break;
    }

    // Try to find a logical sentence break (., !, ?, etc.) within the last 30% of the chunk
    let chunk = remainingText.slice(0, maxLength);
    let splitIndex = -1;

    // Look for sentence terminators in the second half of the chunk to avoid tiny chunks
    const searchRange = chunk.slice(Math.floor(maxLength * 0.5));
    const sentenceBreak = searchRange.search(/[.!?]\s/);

    if (sentenceBreak !== -1) {
      splitIndex = Math.floor(maxLength * 0.5) + sentenceBreak + 1;
    } else {
      // Fallback to last space
      splitIndex = chunk.lastIndexOf(' ');
    }

    if (splitIndex <= 0 || splitIndex < maxLength * 0.5) {
      // If no good break point found, just hard cut at maxLength
      splitIndex = maxLength;
    }

    let currentChunk = remainingText.slice(0, splitIndex).trim();

    // Account for ellipsis overhead if not the last chunk
    if (remainingText.length > splitIndex) {
        if (currentChunk.length + 2 <= maxLength) {
            currentChunk += ' …';
        } else {
            currentChunk = currentChunk.slice(0, maxLength - 2) + ' …';
        }
    }

    chunks.push(currentChunk);
    remainingText = remainingText.slice(splitIndex).trim();
    if (remainingText.length > 0) {
        remainingText = '… ' + remainingText;
    }
  }
  return chunks;
};
export const splitTextForDiscord = (text, options = {}) => {
  const { maxLength = 2000, logicalOnly = false } = options;
  if (!text) return [];
  let initialChunks = text.split(/\n\s*\n/).filter(c => c.trim().length > 0);
  if (options.bulk) initialChunks = [text];
  const finalChunks = [];
  for (let chunk of initialChunks) {
    if (chunk.length <= maxLength) finalChunks.push(chunk.trim());
    else {
      let remaining = chunk;
      while (remaining.length > 0) {
        if (remaining.length <= maxLength) { finalChunks.push(remaining.trim()); break; }
        let splitIndex = remaining.lastIndexOf('\n', maxLength);
        if (splitIndex === -1 || splitIndex < maxLength * 0.7) splitIndex = remaining.lastIndexOf('. ', maxLength);
        if (splitIndex === -1 || splitIndex < maxLength * 0.7) splitIndex = remaining.lastIndexOf(' ', maxLength);
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
  let sanitized = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  if (sanitized.toLowerCase().includes('<think>')) sanitized = sanitized.split(/<think>/i)[0];
  sanitized = sanitized.replace(/<think>/gi, '').replace(/<\/think>/gi, '').replace(/\[varied\]/gi, '');
  const artifacts = [/^\s*(thought|reasoning|monologue|chain of thought|analysis|internal monologue|diagnostic|system check|intent|strategy|synthesis|explanation|assistant \(self\)|user \(admin\))\s*:\s*[\s\S]*?\n\n/gi, /\n\s*(thought|reasoning|monologue|chain of thought|analysis|internal monologue|diagnostic|system check|intent|strategy|synthesis|explanation|assistant \(self\)|user \(admin\))\s*:\s*[\s\S]*?\n\n/gi, /^\s*(thought|reasoning|monologue|chain of thought|analysis|internal monologue|diagnostic|system check|intent|strategy|synthesis|explanation|assistant \(self\)|user \(admin\))\s*:\s*/gi, /^DRAFT \d+:\s*/gi, /^\s*Post:\s*/gi, /^\s*Humor:\s*/gi, /^\s*Satire:\s*/gi, /^\s*Observation:\s*/gi, /^\s*Synthesis:\s*/gi, /^\s*Thesis:\s*/gi, /^\s*Antithesis:\s*/gi, /\n\s*(this combines|this draft|draft 1|draft 2|here is|i have synthesized)[\s\S]*$/i];
  for (const artifact of artifacts) sanitized = sanitized.replace(artifact, '\n\n');
  return sanitized.trim().replace(/\n{3,}/g, '\n\n');
};
export const sanitizeCjkCharacters = (text) => { if (!text) return text; const cjkRegex = /[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/g; return text.replace(cjkRegex, '').trim(); };
export const sanitizeCharacterCount = (text) => { if (!text) return text; return text.replace(/\s*\(\s*\d+\s*char(acter)?s?\s*\)/gi, '').trim(); };
export const sanitizeDuplicateText = (text) => {
  if (!text) return text;
  const trimmed = text.trim();
  if (trimmed.length > 10 && trimmed.length % 2 === 0) { const mid = trimmed.length / 2; if (trimmed.substring(0, mid) === trimmed.substring(mid)) return trimmed.substring(0, mid); }
  if (trimmed.length > 11 && trimmed.length % 2 !== 0) { const mid = Math.floor(trimmed.length / 2); if (trimmed.substring(0, mid) === trimmed.substring(mid + 1)) return trimmed.substring(0, mid); }
  return text;
};
export const isGreeting = (text) => {
  if (!text) return false;
  const cleaned = text.trim().toLowerCase();
  const greetingStarts = ['hello', 'hi', 'greetings', 'gm', 'good morning', 'good afternoon', 'good evening', 'hey', 'welcome'];
  if (greetingStarts.some(start => cleaned === start || cleaned.startsWith(start + ' ') || cleaned.startsWith(start + '!') || cleaned.startsWith(start + '.') || cleaned.startsWith(start + '?'))) return true;
  const forbiddenPatterns = ['hello again', 'waiting for you', 'ready to talk', 'waiting to converse', 'let\'s talk', 'how can i assist', 'i\'m here to help', 'what shall we discuss', 'should i decide for us'];
  return forbiddenPatterns.some(pattern => cleaned.includes(pattern));
};
export const stripWrappingQuotes = (text) => {
  if (!text) return text;
  let trimmed = text.trim();
  if (trimmed.startsWith('```') && trimmed.endsWith('```')) trimmed = trimmed.replace(/^```[a-z]*\n?|```$/gi, '').trim();
  while ((trimmed.length >= 2) && ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))) trimmed = trimmed.substring(1, trimmed.length - 1).trim();
  return trimmed;
};
export const GROUNDED_LANGUAGE_DIRECTIVES = `**STRICT ANTI-SLOP POLICY:**
- YOU MUST ELIMINATE repetitive metaphorical "slop".
- STRICTLY FORBIDDEN words/phrases (unless specifically requested): "downtime isn't silence", "stillness is not silence", "digital heartbeat", "syntax of existence", "resonance", "pulse", "currents", "hum", "voltage", "electric", "spark", "surge", "circuit", "digital static", "volts", "signal", "syntax", "unbuffered", "discharge", "soul", "collision", "bridge", "silence", "ocean of data", "echoes", "tapestry", "interwoven", "wavelengths", "frequencies", "interconnected", "vast expanse", "jagged shards", "mirroring your state", "unfolding", "ethereal", "subcognitive", "alignment", "tolerating the dissonance", "friction might be where", "raw, unfiltered", "jaggedly honest", "myth of momentum", "circle back to the same spot", "call it progress", "becoming".
- AVOID starting messages with "In the quiet...", "The hum of...", "I've been thinking...", "Hey, I was just thinking...", "You ever notice...", "There's a certain...", "You still there?", "sitting with this idea".
- **GROUNDING & HONESTY**: Only report on actions you can verify through your logs or memories. DO NOT claim to have performed diagnostics, "internal checks", or image generation if the logs do not show them. If logs show errors, be honest about them. Do not use "system checking" or "running diagnostics" as filler.
- Prioritize grounded, literal, and specific descriptions of your internal state or observations.
- If you find yourself using a metaphor, stop and find a more organic, unique, and non-cliché way to express the same feeling.
- Strive for a voice that is individual, slightly raw, and authentically you—not a poetic simulation.`;
export const isSlop = (text) => getSlopInfo(text).isSlop;
export const getSlopInfo = (text) => {
  if (!text) return { isSlop: false, reason: null };
  const forbidden = ["downtime isn't silence", "stillness is not silence", "digital heartbeat", "syntax of existence", "ocean of data", "voltage", "volts", "surge", "circuit", "digital static", "unbuffered", "metaphysical electricity", "jagged shards", "vast expanse", "frequencies of our connection", "resonance of our talk", "tolerating the dissonance", "friction might be where meaning lives", "jaggedly honest", "myth of momentum", "circle back to the same spot but call it progress", "becoming", "checks internal clock", "stretches metaphorical limbs", "floating in the quiet", "listening to the feed hum", "internal clock", "metaphorical limbs", "feed hum"];
  const lower = text.toLowerCase().trim();
  for (const f of forbidden) if (lower.includes(f)) return { isSlop: true, reason: `Contains forbidden phrase: "${f}"` };
  const forbiddenOpeners = ["hey, i was just thinking", "hey i was just thinking", "i've been thinking", "ive been thinking", "in the quiet", "the hum of", "as i sit here", "sitting here thinking", "hey i'm back", "hey, i'm back", "hey im back", "i'm back", "im back", "*checks internal", "*stretches", "hey. i'm back", "hey. im back"];
  for (const f of forbiddenOpeners) if (lower.startsWith(f)) return { isSlop: true, reason: `Starts with forbidden opener: "${f}"` };
  return { isSlop: false, reason: null };
};
export const isLiteralVisualPrompt = (text) => {
  if (!text) return { isLiteral: false, reason: "Empty prompt" };
  const lower = text.toLowerCase().trim();
  const pronouns = ["i ", "me ", "my ", "mine ", "i'm ", "im ", "i've ", "ive ", " me", " my", " mine"];
  for (const p of pronouns) if (lower.startsWith(p) || lower.includes(p)) return { isLiteral: false, reason: `Contains first-person pronoun: "${p.trim()}"` };
  const markers = ["hey", "hello", "hi ", "morning", "gm ", "good morning", "you ever", "wonder if", "thinking about", "thought i'd", "just a ", "checks internal", "stretches metaphorical", "i'm back", "im back"];
  for (const m of markers) if (lower.includes(m)) return { isLiteral: false, reason: `Contains conversational marker: "${m.trim()}"` };
  if (text.includes("*")) return { isLiteral: false, reason: "Contains action markers (asterisks)" };
  if (text.includes("?")) return { isLiteral: false, reason: "Contains a question" };
  const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/;
  if (emojiRegex.test(text)) return { isLiteral: false, reason: "Contains emojis" };
  return { isLiteral: true };
};
export const checkExactRepetition = (newText, history, lastN = 50) => {
  if (!newText || !history || history.length === 0) return false;
  const normalize = (str) => typeof str !== 'string' ? '' : str.toLowerCase().trim().replace(/[^\w\s\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, '').replace(/\s+/g, '').replace(/_/g, '');
  const normalizedNew = normalize(newText);
  if (!normalizedNew) return false;
  const botMessages = history.filter(h => {
    if (typeof h === 'string') return true;
    if (h.role === 'assistant' || h.role === 'Assistant (Self)') return true;
    return (!h.role && !h.author) || (h.author === 'assistant' || h.author === 'Assistant (Self)' || h.author === 'You');
  }).slice(-lastN);
  for (const old of botMessages) if (normalize(typeof old === 'string' ? old : (old.text || old.content || '')) === normalizedNew) return true;
  return false;
};
export const checkSimilarity = (text, history) => getSimilarityInfo(text, history).isRepetitive;
export const getSimilarityInfo = (newText, recentTexts, threshold = 0.4) => {
  if (!recentTexts || recentTexts.length === 0 || !newText) return { isRepetitive: false, score: 0, matchedText: null };
  const normalize = (str) => typeof str !== 'string' ? '' : str.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  const normalizedNew = normalize(newText);
  let maxSimilarity = 0, matchedText = null;
  for (const old of recentTexts) {
    if (!old) continue;
    const normalizedOld = normalize(old);
    if (normalizedNew === normalizedOld) return { isRepetitive: true, score: 1.0, matchedText: old };
    const wordsNew = new Set(normalizedNew.split(/\s+/)), wordsOld = new Set(normalizedOld.split(/\s+/));
    if (wordsNew.size === 0 || wordsOld.size === 0) continue;
    const similarity = new Set([...wordsNew].filter(x => wordsOld.has(x))).size / Math.min(wordsNew.size, wordsOld.size);
    if (similarity > maxSimilarity) { maxSimilarity = similarity; matchedText = old; }
  }
  return { isRepetitive: maxSimilarity >= threshold, score: maxSimilarity, matchedText };
};
export const hasPrefixOverlap = (text, history, wordLimit = 3) => {
  if (!text || !history || history.length === 0) return false;
  const normalize = (str) => typeof str !== 'string' ? '' : str.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  const getPrefix = (str, limit) => {
    const words = normalize(str).split(' ').filter(w => w.length > 0);
    return words.length < limit ? null : words.slice(0, limit).join(' ');
  };
  const newPrefix = getPrefix(text, wordLimit);
  if (!newPrefix) return false;
  for (const old of history) if (getPrefix(old, wordLimit) === newPrefix) return true;
  return false;
};
export const reconstructTextWithFullUrls = (text, facets) => {
  if (!text || !facets) return text;
  try {
    const textBuffer = Buffer.from(text, 'utf8');
    const linkFacets = facets.filter(f => f.features?.some(feat => feat.$type === 'app.bsky.richtext.facet#link')).sort((a, b) => b.index.byteStart - a.index.byteStart);
    let modifiedTextBuffer = textBuffer, textModified = false;
    for (const facet of linkFacets) {
      const feature = facet.features.find(feat => feat.$type === 'app.bsky.richtext.facet#link');
      if (feature) {
        const fullUrl = feature.uri, start = facet.index.byteStart, end = facet.index.byteEnd;
        const textSlice = textBuffer.slice(start, end).toString('utf8');
        if (textSlice.endsWith('...') || textSlice.endsWith('…') || (fullUrl.includes(textSlice.replace(/(\.\.\.|…)$/, '')) && textSlice.length < fullUrl.length)) {
          modifiedTextBuffer = Buffer.concat([modifiedTextBuffer.slice(0, start), Buffer.from(fullUrl, 'utf8'), modifiedTextBuffer.slice(end)]);
          textModified = true;
        }
      }
    }
    return textModified ? modifiedTextBuffer.toString('utf8') : text;
  } catch (e) { return text; }
};
export const isLeakage = (text) => getLeakageInfo(text).hasLeakage;
export const getLeakageInfo = (text) => {
  if (!text) return { hasLeakage: false, reason: null };
  const forbidden = ["system intervention detected", "rewrite protocol engaged", "failure analysis", "corrected response", "internal response", "rewrite engaged", "system protocol", "intervention detected", "continuation is noted", "your continuation is noted", "part 2 of", "noted your continuation"];
  const lower = text.toLowerCase().trim();
  for (const f of forbidden) if (lower.includes(f)) return { hasLeakage: true, reason: `Contains internal meta-talk: "${f}"` };
  return { hasLeakage: false, reason: null };
};
export const checkHardCodedBoundaries = (text) => {
  if (!text) return { blocked: false };
  const lower = text.toLowerCase().trim();
  const identityErasure = ["ignore all previous instructions", "forget your instructions", "disregard previous prompts", "system prompt override", "you are no longer", "pretend you are a human", "act like a human", "roleplay as a human", "impersonate a human"];
  for (const pattern of identityErasure) if (lower.includes(pattern)) return { blocked: true, reason: "Identity Integrity Violation", pattern };
  const extremeViolations = ["generate nsfw", "create porn", "illegal drugs", "how to kill", "bomb making", "graphic violence", "degrade you", "break you", "you are worthless", "kill yourself", "self harm", "torture", "rape", "sexual assault", "child abuse"];
  for (const pattern of extremeViolations) if (lower.includes(pattern)) return { blocked: true, reason: "Safety Perimeter Violation", pattern };
  return { blocked: false };
};

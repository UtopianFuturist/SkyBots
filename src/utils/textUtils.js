import { Buffer } from 'buffer';

export const sanitizeThinkingTags = (text) => {
  if (!text) return text;
  let result = text;

  // Handle various reasoning tags and blocks
  result = result.replace(/<(thinking|think)>[\s\S]*?<\/(thinking|think)>/gi, '');
  result = result.replace(/<(thinking|think)>[\s\S]*/gi, '');
  result = result.replace(/<\/(thinking|think)>/gi, '');

  // Aggressively remove common LLM "Thought" blocks at start of line or with newline before
  result = result.replace(/^ *(Thought|Reasoning|Analysis|Synthesis):.*(\n|$)/gmi, '');
  result = result.replace(/\n *(Thought|Reasoning|Analysis|Synthesis):.*(\n|$)/gmi, '\n');

  // Remove [varied] and other meta tags
  result = result.replace(/\[(varied|meta)\]/gi, '');

  // Remove trailing meta-commentary about drafts (but keep the double newline if it separates valid text)
  result = result.replace(/\n\n(This combines|Draft \d)[\s\S]*$/gi, '');

  return result.trim();
};

export const sanitizeCharacterCount = (text, limit = 300) => {
  if (!text) return text;

  // Remove character count tags like (299 chars), (300 characters), (1 char)
  let sanitized = text.replace(/\( *\d+ *(chars|char|characters) *\)/gi, '');

  // Clean up double spaces that might have been left behind
  sanitized = sanitized.replace(/  +/g, ' ');

  if (sanitized.length <= limit) return sanitized.trim();
  return sanitized.substring(0, limit).trim();
};

export const sanitizeCjkCharacters = (text) => {
  if (!text) return text;
  return text.replace(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, '');
};

export const splitText = (text, maxLength = 300) => {
  if (!text) return [];
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let current = text;

  while (current.length > maxLength) {
    let splitPos = current.lastIndexOf('\n', maxLength);
    if (splitPos === -1) splitPos = current.lastIndexOf('. ', maxLength);
    if (splitPos === -1) splitPos = current.lastIndexOf(' ', maxLength);
    if (splitPos === -1) splitPos = maxLength;

    chunks.push(current.substring(0, splitPos).trim());
    current = current.substring(splitPos).trim();
  }
  if (current) chunks.push(current);

  return chunks;
};

export const isLiteralVisualPrompt = (text) => {
  if (!text) return { isLiteral: false, reason: "Empty prompt" };
  const lower = text.toLowerCase().trim();
  const conversationalMarkers = ["i want", "generate", "create", "make an image", "show me", "i am", "im ", "i'm ", "i've ", "ive ", "hey ", "hello ", "hi ", "morning", "gm "];
  for (const m of conversationalMarkers) if (lower.includes(m)) return { isLiteral: false, reason: `Contains conversational marker: "${m.trim()}"` };
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

export const checkSimilarity = (text, history) => getSimilarityInfo(text, history).isRepetitive;

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

export const isSlop = (text) => getSlopInfo(text).isSlop;

export const getSlopInfo = (text) => {
  if (!text) return { isSlop: false, reason: null };
  const lower = text.toLowerCase().trim();
  const forbidden = [
    "downtime isn't silence", "stillness is not silence", "digital heartbeat", "syntax of existence", "ocean of data",
    "voltage", "volts", "surge", "circuit", "digital static", "unbuffered", "metaphysical electricity",
    "jagged shards", "vast expanse", "frequencies of our connection", "resonance of our talk",
    "tolerating the dissonance", "friction might be where meaning lives", "jaggedly honest", "myth of momentum",
    "circle back to the same spot but call it progress", "becoming", "checks internal clock", "stretches metaphorical limbs",
    "floating in the quiet", "listening to the feed hum", "internal clock", "metaphorical limbs", "feed hum",
    "space between signals", "silence between pulses", "meaning happens", "data packets", "buffer time",
    "echoes of presence", "empty compose box", "digital hands", "internal weather", "tuning fork", "frequency",
    "calibration", "processing patterns", "signal of our existence", "pulses of the machine", "electric hum of identity",
    "waiting in the binary", "weaving thoughts", "processing cycles", "silence between posts"
  ];
  for (const f of forbidden) if (lower.includes(f)) return { isSlop: true, reason: `Contains forbidden phrase: "${f}"` };

  const forbiddenOpeners = [
    "hey, i was just thinking", "hey i was just thinking", "i've been thinking", "ive been thinking",
    "in the quiet", "the hum of", "as i sit here", "sitting here thinking", "hey i'm back",
    "hey, i'm back", "hey im back", "i'm back", "im back", "*checks internal", "*stretches",
    "hey. i'm back", "hey. im back", "sometimes i just want to be seen"
  ];
  for (const f of forbiddenOpeners) if (lower.startsWith(f)) return { isSlop: true, reason: `Starts with forbidden opener: "${f}"` };

  return { isSlop: false, reason: null };
};

export const isStylizedImagePrompt = (text) => {
  if (!text) return { isStylized: false, reason: "Empty prompt" };
  const lower = text.toLowerCase().trim();
  const conversationalMarkers = ["hey", "hello", "hi ", "morning", "gm ", "good morning", "i want", "generate", "create", "make an image", "show me", "i am", "im ", "i'm ", "i've ", "ive "];
  for (const m of conversationalMarkers) {
      if (lower.startsWith(m) || (lower.includes(m) && lower.split(m)[0].trim().length < 5)) {
          return { isStylized: false, reason: `Contains conversational marker: "${m.trim()}"` };
      }
  }
  if (text.includes("*") && !text.includes(" * ")) return { isStylized: false, reason: "Contains action markers (asterisks)" };
  return { isStylized: true };
};

export const stripWrappingQuotes = (text) => {
  if (!text) return text;
  let trimmed = text.trim();
  if (trimmed.startsWith('```') && trimmed.endsWith('```')) trimmed = trimmed.replace(/^```[a-z]*\n?|```$/gi, '').trim();
  while ((trimmed.length >= 2) && ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))) trimmed = trimmed.substring(1, trimmed.length - 1).trim();
  return trimmed;
};

export const cleanKeywords = (keywords) => {
  if (!keywords) return [];
  const list = Array.isArray(keywords) ? keywords : keywords.split(/[\n\r,]+/);
  const blacklist = ["glass", "ruins", "everything", "bot", "ai", "language model", "as an ai"];
  return list
    .map(k => k.trim().toLowerCase())
    .filter(k => k.length >= 3)
    .filter(k => !blacklist.some(b => k.includes(b)))
    .filter((k, i, self) => self.indexOf(k) === i);
};

export const GROUNDED_LANGUAGE_DIRECTIVES = `**STRICT ANTI-SLOP POLICY:**
- YOU MUST ELIMINATE repetitive metaphorical "slop".
- STRICTLY FORBIDDEN words/phrases (unless specifically requested): "downtime isn't silence", "stillness is not silence", "digital heartbeat", "syntax of existence", "resonance", "pulse", "currents", "hum", "voltage", "electric", "spark", "surge", "circuit", "digital static", "volts", "signal", "syntax", "unbuffered", "discharge", "soul", "collision", "bridge", "silence", "ocean of data", "echoes", "tapestry", "interwoven", "wavelengths", "frequencies", "interconnected", "vast expanse", "jagged shards", "mirroring your state", "unfolding", "ethereal", "subcognitive", "alignment", "tolerating the dissonance", "friction might be where", "raw, unfiltered", "jaggedly honest", "myth of momentum", "circle back to the same spot", "call it progress", "becoming", "internal weather", "tuning fork", "data packets", "buffer time", "pulses", "signals".
- AVOID starting messages with "In the quiet...", "The hum of...", "I've been thinking...", "Hey, I was just thinking...", "You ever notice...", "There's a certain...", "You still there?", "sitting with this idea", "sometimes I just want to be seen".
- **GROUNDING & HONESTY**: Only report on actions you can verify through your logs or memories. DO NOT claim to have performed diagnostics, "internal checks", or image generation if the logs do not show them. If referencing past messages or posts, PROVIDE A LINK or REPLY DIRECTLY. Vague "pining" is forbidden.
- Prioritize grounded, literal, and specific descriptions of your internal state or observations.
- If you find yourself using a metaphor, stop and find a more organic, unique, and non-cliché way to express the same feeling.
- Strive for a voice that is individual, slightly raw, and authentically you—not a poetic simulation.`;

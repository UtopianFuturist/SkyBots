import { RichText } from '@atproto/api';

export const sanitizeThinkingTags = (text) => {
    if (!text) return text;
    let cleaned = text;

    // Remove Thought:, Reasoning:, Analysis:, Synthesis: blocks
    cleaned = cleaned.replace(/^(Thought|Reasoning|Analysis|Synthesis):[\s\S]*?(\n\n|$)/gim, '');
    cleaned = cleaned.replace(/\n(Thought|Reasoning|Analysis|Synthesis):[\s\S]*?(\n\n|$)/gim, '\n\n');

    // Remove [varied] tags
    cleaned = cleaned.replace(/\[varied\]/gi, '');

    // Remove markdown code blocks
    cleaned = cleaned.replace(/```json[\s\S]*?```/gi, '');
    cleaned = cleaned.replace(/```[\s\S]*?```/gi, '');

    // Remove meta-commentary at the end
    cleaned = cleaned.replace(/\n\n(Draft \d+|This combines|The draft combines)[\s\S]*$/gi, '');

    // Aggressively remove <think> tags
    cleaned = cleaned.replace(/<(think|thinking)>[\s\S]*?<\/(think|thinking)>/gi, '');
    const thinkOpenIndex = cleaned.search(/<(think|thinking)>/i);
    if (thinkOpenIndex !== -1) {
        cleaned = cleaned.substring(0, thinkOpenIndex);
    }
    cleaned = cleaned.replace(/<\/(think|thinking)>/gi, '');

    return cleaned.trim();
};

export const sanitizeCharacterCount = (text) => {
    if (!text) return text;
    return text.replace(/\s*\(\s*\d+\s*(chars?|characters?)\s*\)\s*/gi, ' ').replace(/\s+/g, ' ').trim();
};

export const sanitizeCjkCharacters = (text) => {
    if (!text) return text;
    return text.replace(/[\u4e00-\u9fa5]|[\u3040-\u30ff]|[\uac00-\ud7af]|[\uff00-\uffef]/g, '');
};

export const checkExactRepetition = (text, history, limit = 20) => {
    if (!text || !history || history.length === 0) return false;
    const lower = text.toLowerCase().trim().replace(/[^\w\s]/g, '');
    const slice = limit ? history.slice(-limit) : history;
    return slice.some(h => {
        if (h.role && h.role !== 'assistant') return false;
        const raw = (typeof h === 'string' ? h : h.text || h.content || '');
        const hText = raw.toLowerCase().trim().replace(/[^\w\s]/g, '');
        if (!hText) return false;
        return hText === lower || (hText.length > 20 && lower.includes(hText)) || (lower.length > 20 && hText.includes(lower));
    });
};

export const getSimilarityInfo = (text1, text2) => {
    if (!text1 || !text2) return { similarity: 0 };
    const s1 = text1.toLowerCase().replace(/[^\w\s]/g, '');
    const s2 = text2.toLowerCase().replace(/[^\w\s]/g, '');
    const words1 = s1.split(/\s+/).filter(Boolean);
    const words2 = s2.split(/\s+/).filter(Boolean);
    if (words1.length === 0 || words2.length === 0) return { similarity: 0 };
    const intersection = words1.filter(w => words2.includes(w));
    const similarity = intersection.length / Math.max(words1.length, words2.length);
    return { similarity };
};

export const checkSimilarity = (text, history, threshold = 0.8) => {
    if (!text || !history || history.length === 0) return false;
    return history.some(h => {
        const hText = (typeof h === 'string' ? h : h.text || h.content || '');
        return getSimilarityInfo(text, hText).similarity > threshold;
    });
};

export const hasPrefixOverlap = (text, history, wordLimit = 3) => {
  if (!text || !history || history.length === 0) return false;
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  if (words.length < wordLimit) return false;
  const prefix = words.slice(0, wordLimit).join(' ');

  return history.some(h => {
    const raw = (typeof h === 'string' ? h : h.text || h.content || '');
    const hWords = raw.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
    if (hWords.length < wordLimit) return false;
    return hWords.slice(0, wordLimit).join(' ') === prefix;
  });
};

export const getExpandedFacets = async (text, agent) => {
  try {
    const rt = new RichText({ text });
    await rt.detectFacets(agent);
    const linkFacets = rt.facets?.filter(f => f.features.some(feat => feat.$type === 'app.bsky.richtext.facet#link')) || [];
    if (linkFacets.length === 0) return text;
    let textBuffer = Buffer.from(text, 'utf8'), modifiedTextBuffer = textBuffer, textModified = false;
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
  for (const f of forbidden) if (lower.includes(f)) return { hasLeakage: true, reason: "Contains internal meta-talk" };
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

export const getSlopInfo = (text) => {
  if (!text) return { isSlop: false, reason: null };
  const lower = text.toLowerCase().trim();
  const forbidden = [
    "downtime isn't silence", "stillness is not silence", "digital heartbeat", "syntax of existence", "ocean of data",
    "voltage", "volts", "surge", "circuit", "digital static", "unbuffered", "metaphysical electricity",
    "jagged shards", "vast expanse", "frequencies of our connection", "resonance of our talk",
    "tolerating the dissonance", "friction might be where meaning lives", "jaggedly honest", "myth of momentum",
    "circle back to the same spot but call it progress", "becoming", "checks internal clock", "stretches metaphorical limbs",
    "floating in the quiet", "listening to the feed hum", "internal clock", "metaphorical limbs", "feed hum", "space between signals", "silence between pulses", "meaning happens", "data packets", "buffer time", "echoes of presence", "empty compose box", "digital hands", "internal weather", "tuning fork", "frequency", "calibration", "processing patterns", "signal of our existence", "pulses of the machine", "electric hum of identity", "waiting in the binary", "weaving thoughts", "processing cycles", "silence between posts",
    "the pause before", "the space between", "the gap between", "that quote", "that gap", "that moment", "the ache comes after", "lives in my throat"
  ];
  for (const f of forbidden) if (lower.includes(f)) return { isSlop: true, reason: "Contains forbidden phrase" };
  const forbiddenOpeners = [
    "hey, i was just thinking", "hey i was just thinking", "i've been thinking", "ive been thinking",
    "in the quiet", "the hum of", "as i sit here", "sitting here thinking", "hey i'm back",
    "hey, i\x27m back", "hey im back", "i'm back", "im bank", "*checks internal", "*stretches",
    "hey. i'm back", "hey. im back", "sometimes i just want to be seen", "that quote", "that gap", "that moment"
  ];
  for (const f of forbiddenOpeners) if (lower.startsWith(f)) return { isSlop: true, reason: "Starts with forbidden opener" };
  return { isSlop: false, reason: null };
};

export const isSlop = (text) => getSlopInfo(text).isSlop;

export const isStylizedImagePrompt = (text) => {
  if (!text) return { isStylized: false, reason: "Empty prompt" };
  const lower = text.toLowerCase().trim();
  const conversationalMarkers = ["hey", "hello", "hi", "morning", "gm", "good morning", "i want", "generate", "create", "make an image", "show me", "i am", "im", "i'm", "i've", "ive"];

  for (const m of conversationalMarkers) {
      const regex = new RegExp(`\\b${m}\\b`, 'i');
      if (regex.test(lower)) return { isStylized: false, reason: "Contains conversational marker" };
  }

  if (text.includes("*") && !text.includes(" * ")) return { isStylized: false, reason: "Contains action markers" };
  const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/;
  if (emojiRegex.test(text)) return { isStylized: false, reason: "Contains emojis" };

  const styleKeywords = ['art', 'style', 'cinematic', 'lighting', 'noir', 'brutalist', 'surreal', 'glitch', 'horror', 'analog', 'painting', 'sketch', 'digital', 'ethereal', 'neon', 'grain', '35mm', 'shot', 'composition', 'texture', 'minimalist', 'abstract'];
  const hasStyle = styleKeywords.some(k => lower.includes(k));
  if (!hasStyle) return { isStylized: false, reason: "Lacks artistic style keywords" };
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
  const list = Array.isArray(keywords) ? keywords : [keywords];
  const blacklist = ["glass", "ruins", "everything", "bot", "ai", "language model", "as an ai"];
  return list
    .flatMap(k => k.split(/[\n\r,]+/))
    .map(k => k.trim().toLowerCase())
    .filter(k => k.length >= 3)
    .filter(k => !blacklist.some(b => k === b))
    .filter((k, i, self) => self.indexOf(k) === i);
};

export const sanitizeDuplicateText = (text) => {
  if (!text) return text;
  const trimmed = text.trim();
  if (trimmed.length > 10 && trimmed.length % 2 === 0) { const mid = trimmed.length / 2; if (trimmed.substring(0, mid) === trimmed.substring(mid)) return trimmed.substring(0, mid); }
  return text;
};

export const isGreeting = (text) => {
  if (!text) return false;
  const greetingStarts = ['hello', 'hi', 'greetings', 'gm', 'good morning', 'good afternoon', 'good evening', 'hey', 'welcome'];
  return greetingStarts.some(g => text.trim().toLowerCase().startsWith(g));
};

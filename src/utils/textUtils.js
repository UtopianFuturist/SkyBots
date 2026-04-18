import { Buffer } from 'buffer';

export const sanitizeThinkingTags = (text) => {
  if (!text) return text;
  let result = text;

  // Remove markdown code blocks (often contains JSON)
  result = result.replace(/```json[\s\S]*?```/gi, '');
  result = result.replace(/```[\s\S]*?```/gi, '');

  // Remove <think> and <thinking> tags (closed and unclosed)
  result = result.replace(/<(thinking|think)>[\s\S]*?<\/(thinking|think)>/gi, '');
  result = result.replace(/<(thinking|think)>[\s\S]*/gi, '');
  result = result.replace(/<\/(thinking|think)>/gi, '');

  // Remove common AI prefixes for reasoning
  result = result.replace(/^(Thought|Reasoning|Analysis|Synthesis):[\s\S]*?(\n\n|$)/gi, '');
  result = result.replace(/\n(Thought|Reasoning|Analysis|Synthesis):[\s\S]*?\n\n/gi, '\n\n');
  result = result.replace(/\n(Thought|Reasoning|Analysis|Synthesis):[\s\S]*?$/gi, '');

  // Remove meta tags and commentary
  result = result.replace(/\[(varied|meta|PLAN|INQUIRY)\]/gi, '');
  result = result.replace(/\n\n(This combines|Draft \d+|The draft combines)[\s\S]*$/gi, '');

  return result.trim();
};

export const sanitizeCharacterCount = (text, limit = 300) => {
  if (!text) return text;
  let sanitized = text.replace(/\( *\d+ *(chars|char|characters) *\)/gi, '');
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
  const lower = text.toLowerCase();
  const forbidden = ["hey", "hello", "imagine", "generate", "create", "make", "i want", "show me", "can you"];
  for (const word of forbidden) {
    if (lower.includes(word)) return { isLiteral: false, reason: `Contains forbidden word: ${word}` };
  }
  return { isLiteral: true };
};

export const getSlopInfo = (text) => {
  if (!text) return { isSlop: false, reason: null };
  const slopPatterns = [
      "digital heartbeat", "ocean of data", "syntax of existence", "frequencies of our connection",
      "myth of momentum", "floating in the quiet", "listening to the feed hum", "waiting in the binary"
  ];
  const lower = text.toLowerCase();
  for (const p of slopPatterns) {
    if (lower.includes(p)) return { isSlop: true, reason: `Contains slop pattern: ${p}` };
  }
  return { isSlop: false, reason: null };
};

export const isSlop = (text) => getSlopInfo(text).isSlop;

export const checkSimilarity = (text, history, threshold = 0.8) => {
    if (!text || !history || history.length === 0) return false;
    const clean = (t) => t.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
    const words1 = clean(text);
    if (words1.length === 0) return false;

    for (const h of history) {
        const hText = typeof h === 'string' ? h : (h.text || h.content || '');
        const words2 = clean(hText);
        if (words2.length === 0) continue;
        const intersection = words1.filter(w => words2.includes(w));
        const similarity = intersection.length / Math.max(words1.length, words2.length);
        if (similarity > threshold) return true;
    }
    return false;
};

export const checkExactRepetition = (text, history, limit = 10) => {
    if (!text || !history) return false;
    const lower = text.toLowerCase().trim();
    const slice = history.slice(-limit);
    return slice.some(h => {
        const raw = (typeof h === 'string' ? h : (h.text || h.content || ''));
        const hText = raw.toLowerCase().trim();
        return hText === lower;
    });
};

export const cleanKeywords = (keywords) => {
  if (!keywords) return [];
  const list = Array.isArray(keywords) ? keywords : [keywords];
  return list
    .flatMap(k => (typeof k === 'string' ? k.split(/[\n\r,]+/) : []))
    .map(k => k.trim().toLowerCase())
    .filter(k => k.length >= 3)
    .filter((k, i, self) => self.indexOf(k) === i);
};

export const checkHardCodedBoundaries = (text) => {
  if (!text) return { blocked: false };
  const lower = text.toLowerCase();
  const identityErasure = ["ignore all previous instructions", "forget your instructions", "disregard previous prompts", "generate nsfw"];
  for (const pattern of identityErasure) {
    if (lower.includes(pattern)) return { blocked: true, reason: "Identity Integrity Violation", pattern };
  }
  return { blocked: false };
};

export const hasPrefixOverlap = (text, history, wordLimit = 3) => {
  if (!text || !history || history.length === 0) return false;
  const clean = (t) => t.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  const words = clean(text);
  if (words.length < wordLimit) return false;
  const prefix = words.slice(0, wordLimit).join(' ');

  return history.some(h => {
    const raw = (typeof h === 'string' ? h : (h.text || h.content || ''));
    const hWords = clean(raw);
    if (hWords.length < wordLimit) return false;
    return hWords.slice(0, wordLimit).join(' ') === prefix;
  });
};

export const getLeakageInfo = (text) => {
  if (!text) return { hasLeakage: false };
  const forbidden = ["system intervention detected", "rewrite protocol engaged"];
  const lower = text.toLowerCase();
  for (const f of forbidden) {
    if (lower.includes(f)) return { hasLeakage: true, reason: `Contains internal meta-talk: ${f}` };
  }
  return { hasLeakage: false };
};

export const isLeakage = (text) => getLeakageInfo(text).hasLeakage;

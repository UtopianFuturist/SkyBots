/**
 * Normalizes memory thread tags to [ALL_CAPS_UNDERSCORE] format.
 */
export function normalizeTag(tag) {
    if (!tag) return '';
    return tag.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
}

/**
 * Ensures a memory entry string starts with a properly formatted tag.
 */
export function ensureStandardTag(text, category) {
    if (!text) return '';

    const tagMatch = text.match(/^\[(.*?)\]/);
    if (tagMatch) {
        const normalized = normalizeTag(tagMatch[1]);
        return text.replace(/^\[.*?\]/, `[${normalized}]`);
    }

    // If no tag, add one based on category
    const defaultTag = normalizeTag(category);
    return `[${defaultTag}] ${text}`;
}

/**
 * An alias to {@link isExtendedPictographic}
 *
 * @deprecated in favor of {@link isExtendedPictographic}, will be removed in v1.
 *
 * @param {number} cp
 * @return boolean
 */
export function isEmoji(cp: number): boolean;
/**
 * Check if the given code point is included in Unicode \\p{Emoji_Presentation} script property
 *
 * @param {number} cp
 * @return boolean
 */
export function isEmojiPresentation(cp: number): boolean;
/**
 * Check if the given code point is included in Unicode \\p{Extended_Pictographic} script property
 *
 * @param {number} cp
 * @return boolean
 */
export function isExtendedPictographic(cp: number): boolean;

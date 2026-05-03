/**
 * @typedef {import('./core.js').UnicodeRange} UnicodeRange
 * @typedef {import('./core.js').UnicodeDataEncoding} UnicodeDataEncoding
 */
/**
 * The Unicode `L` (Letter) properties data
 *
 * @type {UnicodeRange[]}
 */
export const letter_ranges: UnicodeRange[];
/**
 * The Unicode `N` (Numeric) properties data
 *
 * @type {UnicodeRange[]}
 */
export const numeric_ranges: UnicodeRange[];
/**
 * The Unicode `Alphabetic` properties data
 *
 * @type {UnicodeRange[]}
 */
export const alphabetic_ranges: UnicodeRange[];
export type UnicodeRange = import("./core.js").UnicodeRange;
export type UnicodeDataEncoding = import("./core.js").UnicodeDataEncoding;

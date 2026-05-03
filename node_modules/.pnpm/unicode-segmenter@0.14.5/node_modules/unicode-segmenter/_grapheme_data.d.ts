/**
 * @typedef {import('./core.js').UnicodeDataEncoding} UnicodeDataEncoding
 */
/**
 * @typedef {0} GC_Any
 * @typedef {1} GC_CR
 * @typedef {2} GC_Control
 * @typedef {3} GC_Extend
 * @typedef {4} GC_Extended_Pictographic
 * @typedef {5} GC_L
 * @typedef {6} GC_LF
 * @typedef {7} GC_LV
 * @typedef {8} GC_LVT
 * @typedef {9} GC_Prepend
 * @typedef {10} GC_Regional_Indicator
 * @typedef {11} GC_SpacingMark
 * @typedef {12} GC_T
 * @typedef {13} GC_V
 * @typedef {14} GC_ZWJ
 * @typedef {(
 *   | GC_Any
 *   | GC_CR
 *   | GC_Control
 *   | GC_Extend
 *   | GC_Extended_Pictographic
 *   | GC_L
 *   | GC_LF
 *   | GC_LV
 *   | GC_LVT
 *   | GC_Prepend
 *   | GC_Regional_Indicator
 *   | GC_SpacingMark
 *   | GC_T
 *   | GC_V
 *   | GC_ZWJ
 * )} GraphemeCategoryNum
 */
/**
 * @typedef {import('./core.js').CategorizedUnicodeRange<GraphemeCategoryNum>} GraphemeCategoryRange
 */
/**
 * @typedef {(
 *   | 'Any'
 *   | 'CR'
 *   | 'Control'
 *   | 'Extend'
 *   | 'Extended_Pictographic'
 *   | 'L'
 *   | 'LF'
 *   | 'LV'
 *   | 'LVT'
 *   | 'Prepend'
 *   | 'Regional_Indicator'
 *   | 'SpacingMark'
 *   | 'T'
 *   | 'V'
 *   | 'ZWJ'
 * )} GraphemeCategoryKey
 */
/**
 * Grapheme category enum
 *
 * Note:
 *   The object isn't actually frozen
 *   because using `Object.freeze` increases 800 bytes on Brotli compression.
 *
 * @type {Readonly<Record<GraphemeCategoryKey, GraphemeCategoryNum>>}
 */
export const GraphemeCategory: Readonly<Record<GraphemeCategoryKey, GraphemeCategoryNum>>;
/**
 * @type {GraphemeCategoryRange[]}
 */
export const grapheme_ranges: GraphemeCategoryRange[];
export type UnicodeDataEncoding = import("./core.js").UnicodeDataEncoding;
export type GC_Any = 0;
export type GC_CR = 1;
export type GC_Control = 2;
export type GC_Extend = 3;
export type GC_Extended_Pictographic = 4;
export type GC_L = 5;
export type GC_LF = 6;
export type GC_LV = 7;
export type GC_LVT = 8;
export type GC_Prepend = 9;
export type GC_Regional_Indicator = 10;
export type GC_SpacingMark = 11;
export type GC_T = 12;
export type GC_V = 13;
export type GC_ZWJ = 14;
export type GraphemeCategoryNum = (GC_Any | GC_CR | GC_Control | GC_Extend | GC_Extended_Pictographic | GC_L | GC_LF | GC_LV | GC_LVT | GC_Prepend | GC_Regional_Indicator | GC_SpacingMark | GC_T | GC_V | GC_ZWJ);
export type GraphemeCategoryRange = import("./core.js").CategorizedUnicodeRange<GraphemeCategoryNum>;
export type GraphemeCategoryKey = ("Any" | "CR" | "Control" | "Extend" | "Extended_Pictographic" | "L" | "LF" | "LV" | "LVT" | "Prepend" | "Regional_Indicator" | "SpacingMark" | "T" | "V" | "ZWJ");

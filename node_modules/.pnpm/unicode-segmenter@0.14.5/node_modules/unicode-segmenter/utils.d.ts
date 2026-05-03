/**
 * @deprecated never used
 *
 * @param {number} c UTF-16 code point
 */
export function isHighSurrogate(c: number): boolean;
/**
 * @deprecated never used
 *
 * @param {number} c UTF-16 code point
 */
export function isLowSurrogate(c: number): boolean;
/**
 * @deprecated never used
 *
 * @param {number} hi high surrogate
 * @param {number} lo low surrogate
 */
export function surrogatePairToCodePoint(hi: number, lo: number): number;
/**
 * @deprecated never used
 *
 * Check if given code point is within the BMP(Basic Multilingual Plane)
 *
 * @param {number} c Unicode code point
 * @return {boolean}
 */
export function isBMP(c: number): boolean;
/**
 * @deprecated never used
 *
 * Check if given code point is within the SMP(Supplementary Multilingual Plane)
 *
 * @param {number} c Unicode code point
 * @return {boolean}
 */
export function isSMP(c: number): boolean;
/**
 * @deprecated never used
 *
 * Check if given code point is within the SIP(Supplementary Ideographic Plane)
 *
 * @param {number} c Unicode code point
 * @return {boolean}
 */
export function isSIP(c: number): boolean;
/**
 * @deprecated never used
 *
 * Check if given code point is within the TIP(Tertiary Ideographic Plane)
 *
 * @param {number} c Unicode code point
 * @return {boolean}
 */
export function isTIP(c: number): boolean;
/**
 * @deprecated never used
 *
 * Check if given code point is within the SSP(Supplementary Special-purpose Plane)
 *
 * @param {number} c Unicode code point
 * @return {boolean}
 */
export function isSSP(c: number): boolean;

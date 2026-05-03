/**
 * Check if the given code point is included in Unicode \\p{L} general property
 *
 * @param {number} cp
 * @return boolean
 */
export function isLetter(cp: number): boolean;
/**
 * Check if the given code point is included in Unicode \\p{Alphabetic} dervied property
 *
 * @param {number} cp
 * @return boolean
 */
export function isAlphabetic(cp: number): boolean;
/**
 * Check if the given code point is included in Unicode \\p{N} general property
 *
 * @param {number} cp
 * @return boolean true if
 */
export function isNumeric(cp: number): boolean;
/**
 * @param {number} cp
 * @return boolean true
 */
export function isAlphanumeric(cp: number): boolean;

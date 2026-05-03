import { LexValue } from './lex.js';
/**
 * Performs deep equality comparison between two {@link LexValue}s.
 *
 * This function correctly handles all Lexicon data types including:
 * - Primitives (string, number, boolean, null)
 * - Arrays (recursive element comparison)
 * - Objects/LexMaps (recursive key-value comparison)
 * - Uint8Arrays (byte-by-byte comparison)
 * - CIDs (using CID equality)
 *
 * @param a - First LexValue to compare
 * @param b - Second LexValue to compare
 * @returns `true` if the values are deeply equal
 * @throws {TypeError} If either value is not a valid LexValue (e.g., contains unsupported types)
 *
 * @example
 * ```typescript
 * import { lexEquals } from '@atproto/lex-data'
 *
 * // Primitives
 * lexEquals('hello', 'hello')  // true
 * lexEquals(42, 42)            // true
 *
 * // Arrays
 * lexEquals([1, 2, 3], [1, 2, 3])  // true
 * lexEquals([1, 2], [1, 2, 3])     // false
 *
 * // Objects
 * lexEquals({ a: 1, b: 2 }, { a: 1, b: 2 })  // true
 * lexEquals({ a: 1 }, { a: 1, b: 2 })        // false
 *
 * // CIDs
 * lexEquals(cid1, cid2)  // true if CIDs are equal
 *
 * // Uint8Arrays
 * lexEquals(new Uint8Array([1, 2]), new Uint8Array([1, 2]))  // true
 * ```
 */
export declare function lexEquals(a: LexValue, b: LexValue): boolean;
//# sourceMappingURL=lex-equals.d.ts.map
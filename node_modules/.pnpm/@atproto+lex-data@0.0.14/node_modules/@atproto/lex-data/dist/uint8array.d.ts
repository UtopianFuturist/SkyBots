import { Base64Alphabet } from './uint8array-base64.js';
export type { Base64Alphabet };
/**
 * Encodes a Uint8Array into a base64 string.
 *
 * Uses native Uint8Array.prototype.toBase64 when available (Node.js 24+, modern browsers),
 * falling back to Node.js Buffer or a ponyfill implementation.
 *
 * @param bytes - The binary data to encode
 * @param alphabet - The base64 alphabet to use ('base64' or 'base64url'), defaults to 'base64'
 * @returns The base64 encoded string
 *
 * @example
 * ```typescript
 * import { toBase64 } from '@atproto/lex-data'
 *
 * const bytes = new Uint8Array([72, 101, 108, 108, 111])
 * toBase64(bytes)           // 'SGVsbG8='
 * toBase64(bytes, 'base64url')  // 'SGVsbG8' (URL-safe, no padding)
 * ```
 */
export declare const toBase64: (bytes: Uint8Array, alphabet?: Base64Alphabet) => string;
/**
 * Decodes a base64 string into a Uint8Array.
 *
 * Supports both padded and unpadded base64 strings. Uses native
 * Uint8Array.fromBase64 when available, falling back to Node.js Buffer
 * or a ponyfill implementation.
 *
 * @param b64 - The base64 string to decode
 * @param alphabet - The base64 alphabet to use ('base64' or 'base64url'), defaults to 'base64'
 * @returns The decoded binary data
 * @throws If the input is not a valid base64 string
 *
 * @example
 * ```typescript
 * import { fromBase64 } from '@atproto/lex-data'
 *
 * fromBase64('SGVsbG8=')       // Uint8Array([72, 101, 108, 108, 111])
 * fromBase64('SGVsbG8', 'base64url')  // Same, URL-safe alphabet
 * ```
 */
export declare const fromBase64: (b64: string, alphabet?: Base64Alphabet) => Uint8Array;
/**
 * Returns the input if it is a Uint8Array, otherwise returns undefined.
 *
 * @param input - The value to check
 * @returns The input if it's a Uint8Array, otherwise undefined
 *
 * @example
 * ```typescript
 * import { ifUint8Array } from '@atproto/lex-data'
 *
 * ifUint8Array(new Uint8Array([1, 2]))  // Uint8Array([1, 2])
 * ifUint8Array('not binary')            // undefined
 * ifUint8Array(new ArrayBuffer(4))      // undefined
 * ```
 */
export declare function ifUint8Array(input: unknown): Uint8Array | undefined;
/**
 * Coerces various binary data representations into a Uint8Array.
 *
 * Handles the following input types:
 * - `Uint8Array` - Returned as-is
 * - `ArrayBufferView` (e.g., DataView, other TypedArrays) - Converted to Uint8Array
 * - `ArrayBuffer` - Wrapped in a Uint8Array
 *
 * @param input - The value to convert
 * @returns A Uint8Array, or `undefined` if the input could not be converted
 *
 * @example
 * ```typescript
 * import { asUint8Array } from '@atproto/lex-data'
 *
 * asUint8Array(new Uint8Array([1, 2]))     // Uint8Array([1, 2])
 * asUint8Array(new ArrayBuffer(4))         // Uint8Array of length 4
 * asUint8Array(new Int16Array([1, 2]))     // Uint8Array view of the buffer
 * asUint8Array('string')                   // undefined
 * ```
 */
export declare function asUint8Array(input: unknown): Uint8Array | undefined;
/**
 * Compares two Uint8Arrays for byte-by-byte equality.
 *
 * @param a - First Uint8Array to compare
 * @param b - Second Uint8Array to compare
 * @returns `true` if both arrays have the same length and identical bytes
 *
 * @example
 * ```typescript
 * import { ui8Equals } from '@atproto/lex-data'
 *
 * ui8Equals(new Uint8Array([1, 2]), new Uint8Array([1, 2]))  // true
 * ui8Equals(new Uint8Array([1, 2]), new Uint8Array([1, 3]))  // false
 * ui8Equals(new Uint8Array([1]), new Uint8Array([1, 2]))     // false
 * ```
 */
export declare function ui8Equals(a: Uint8Array, b: Uint8Array): boolean;
/**
 * Concatenates multiple Uint8Arrays into a single Uint8Array.
 *
 * Uses Node.js Buffer.concat when available for performance,
 * falling back to a ponyfill implementation.
 *
 * @param arrays - The Uint8Arrays to concatenate
 * @returns A new Uint8Array containing all input bytes in order
 *
 * @example
 * ```typescript
 * import { ui8Concat } from '@atproto/lex-data'
 *
 * const a = new Uint8Array([1, 2])
 * const b = new Uint8Array([3, 4])
 * ui8Concat([a, b])  // Uint8Array([1, 2, 3, 4])
 * ```
 */
export declare const ui8Concat: (array: readonly Uint8Array[]) => Uint8Array;
//# sourceMappingURL=uint8array.d.ts.map
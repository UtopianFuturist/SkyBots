"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ui8Concat = exports.fromBase64 = exports.toBase64 = void 0;
exports.ifUint8Array = ifUint8Array;
exports.asUint8Array = asUint8Array;
exports.ui8Equals = ui8Equals;
const uint8array_concat_js_1 = require("./uint8array-concat.js");
const uint8array_from_base64_js_1 = require("./uint8array-from-base64.js");
const uint8array_to_base64_js_1 = require("./uint8array-to-base64.js");
// @TODO drop dependency on uint8arrays package once Uint8Array.fromBase64 /
// Uint8Array.prototype.toBase64 is widely supported, and mark fromBase64 /
// toBase64 as deprecated. We can also drop NodeJS specific implementations
// once NodeJS <24 is no longer supported.
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
exports.toBase64 = 
/* v8 ignore next -- @preserve */ uint8array_to_base64_js_1.toBase64Native ??
    uint8array_to_base64_js_1.toBase64Node ??
    uint8array_to_base64_js_1.toBase64Ponyfill;
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
exports.fromBase64 = 
/* v8 ignore next -- @preserve */ uint8array_from_base64_js_1.fromBase64Native ??
    uint8array_from_base64_js_1.fromBase64Node ??
    uint8array_from_base64_js_1.fromBase64Ponyfill;
/* v8 ignore next -- @preserve */
if (exports.toBase64 === uint8array_to_base64_js_1.toBase64Ponyfill || exports.fromBase64 === uint8array_from_base64_js_1.fromBase64Ponyfill) {
    /*#__PURE__*/
    console.warn('[@atproto/lex-data]: Uint8Array.fromBase64 / Uint8Array.prototype.toBase64 not available in this environment. Falling back to ponyfill implementation.');
}
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
function ifUint8Array(input) {
    if (input instanceof Uint8Array) {
        return input;
    }
    return undefined;
}
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
function asUint8Array(input) {
    if (input instanceof Uint8Array) {
        return input;
    }
    if (ArrayBuffer.isView(input)) {
        return new Uint8Array(input.buffer, input.byteOffset, input.byteLength / Uint8Array.BYTES_PER_ELEMENT);
    }
    if (input instanceof ArrayBuffer) {
        return new Uint8Array(input);
    }
    return undefined;
}
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
function ui8Equals(a, b) {
    if (a.byteLength !== b.byteLength) {
        return false;
    }
    for (let i = 0; i < a.byteLength; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}
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
exports.ui8Concat = 
/* v8 ignore next -- @preserve */ uint8array_concat_js_1.ui8ConcatNode ?? uint8array_concat_js_1.ui8ConcatPonyfill;
//# sourceMappingURL=uint8array.js.map
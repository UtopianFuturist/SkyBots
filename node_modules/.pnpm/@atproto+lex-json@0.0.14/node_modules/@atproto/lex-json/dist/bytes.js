"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLexBytes = parseLexBytes;
exports.encodeLexBytes = encodeLexBytes;
const lex_data_1 = require("@atproto/lex-data");
/**
 * Parses a `{$bytes: string}` JSON object into a `Uint8Array`.
 *
 * In the AT Protocol data model, binary data is represented in JSON as an object
 * with a single `$bytes` property containing a base64-encoded string. This function
 * decodes that representation back into raw bytes.
 *
 * @param input - An object potentially containing a `$bytes` property
 * @returns The decoded `Uint8Array` if the input is a valid `$bytes` object,
 *          or `undefined` if the input is not a valid `$bytes` representation
 *
 * @example
 * ```typescript
 * // Parse a $bytes object to Uint8Array
 * const bytes = parseLexBytes({ $bytes: 'SGVsbG8sIHdvcmxkIQ==' })
 * // bytes is Uint8Array containing "Hello, world!"
 *
 * // Returns undefined for non-$bytes objects
 * const result = parseLexBytes({ foo: 'bar' })
 * // result is undefined
 *
 * // Returns undefined for objects with extra properties
 * const invalid = parseLexBytes({ $bytes: 'SGVsbG8=', extra: true })
 * // invalid is undefined
 * ```
 */
function parseLexBytes(input) {
    if (!input || !('$bytes' in input)) {
        return undefined;
    }
    for (const key in input) {
        if (key !== '$bytes') {
            return undefined;
        }
    }
    if (typeof input.$bytes !== 'string') {
        return undefined;
    }
    try {
        return (0, lex_data_1.fromBase64)(input.$bytes);
    }
    catch {
        return undefined;
    }
}
/**
 * Encodes a `Uint8Array` into a `{$bytes: string}` JSON representation.
 *
 * In the AT Protocol data model, binary data is represented in JSON as an object
 * with a single `$bytes` property containing a base64-encoded string. This function
 * performs that encoding.
 *
 * @param bytes - The binary data to encode
 * @returns An object with a `$bytes` property containing the base64-encoded data
 *
 * @example
 * ```typescript
 * const bytes = new TextEncoder().encode('Hello, world!')
 * const encoded = encodeLexBytes(bytes)
 * // encoded is { $bytes: 'SGVsbG8sIHdvcmxkIQ==' }
 * ```
 */
function encodeLexBytes(bytes) {
    return { $bytes: (0, lex_data_1.toBase64)(bytes) };
}
//# sourceMappingURL=bytes.js.map
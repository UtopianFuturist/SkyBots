"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLexLink = parseLexLink;
exports.encodeLexLink = encodeLexLink;
const lex_data_1 = require("@atproto/lex-data");
function parseLexLink(input, options) {
    if (!input || !('$link' in input)) {
        return undefined;
    }
    for (const key in input) {
        if (key !== '$link') {
            return undefined;
        }
    }
    const { $link } = input;
    if (typeof $link !== 'string') {
        return undefined;
    }
    if ($link.length === 0) {
        return undefined;
    }
    // Arbitrary limit to prevent DoS via extremely long CIDs
    if ($link.length > 2048) {
        return undefined;
    }
    try {
        return (0, lex_data_1.parseCid)($link, options);
    }
    catch (cause) {
        return undefined;
    }
}
/**
 * Encodes a {@link Cid} instance into a `{$link: string}` JSON representation.
 *
 * In the AT Protocol data model, CID references are represented in JSON as an
 * object with a single `$link` property containing a base32-encoded CID string,
 * prefixed with "b". This function performs that encoding.
 *
 * @param cid - The CID to encode
 * @returns An object with a `$link` property containing the string representation of the CID
 *
 * @example
 * ```typescript
 * const cid = CID.parse('bafyreib2rxk3rybloqtqwbo')
 * const encoded = encodeLexLink(cid)
 * // encoded is { $link: 'bafyreib2rxk3rybloqtqwbo' }
 * ```
 */
function encodeLexLink(cid) {
    return { $link: cid.toString() };
}
//# sourceMappingURL=link.js.map
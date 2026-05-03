"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLexMap = isLexMap;
exports.isLexArray = isLexArray;
exports.isLexScalar = isLexScalar;
exports.isLexValue = isLexValue;
exports.isTypedLexMap = isTypedLexMap;
const cid_js_1 = require("./cid.js");
const object_js_1 = require("./object.js");
/**
 * Type guard to check if a value is a valid {@link LexMap}.
 *
 * Returns true if the value is a plain object where all values are valid
 * {@link LexValue} types.
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid LexMap
 *
 * @example
 * ```typescript
 * import { isLexMap } from '@atproto/lex'
 *
 * if (isLexMap(data)) {
 *   // data is narrowed to LexMap
 *   console.log(Object.keys(data))
 * }
 * ```
 */
function isLexMap(value) {
    return (0, object_js_1.isPlainObject)(value) && Object.values(value).every(isLexValue);
}
/**
 * Type guard to check if a value is a valid {@link LexArray}.
 *
 * Returns true if the value is an array where all elements are valid
 * {@link LexValue} types.
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid LexArray
 *
 * @example
 * ```typescript
 * import { isLexArray } from '@atproto/lex'
 *
 * if (isLexArray(data)) {
 *   // data is narrowed to LexArray
 *   data.forEach(item => console.log(item))
 * }
 * ```
 */
function isLexArray(value) {
    return Array.isArray(value) && value.every(isLexValue);
}
/**
 * Type guard to check if a value is a valid {@link LexScalar}.
 *
 * Returns true if the value is one of the primitive Lexicon types:
 * number (integer only), string, boolean, null, Cid, or Uint8Array.
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid LexScalar
 *
 * @example
 * ```typescript
 * import { isLexScalar } from '@atproto/lex'
 *
 * isLexScalar('hello')     // true
 * isLexScalar(42)          // true
 * isLexScalar(3.14)        // false (floats not allowed)
 * isLexScalar([1, 2])      // false (arrays are not scalars)
 * ```
 */
function isLexScalar(value) {
    switch (typeof value) {
        case 'object':
            return value === null || value instanceof Uint8Array || (0, cid_js_1.isCid)(value);
        case 'string':
        case 'boolean':
            return true;
        case 'number':
            if (Number.isInteger(value))
                return true;
        // fallthrough
        default:
            return false;
    }
}
/**
 * Type guard to check if a value is a valid {@link LexValue}.
 *
 * Performs a deep check to validate that the value (and all nested values)
 * conform to the Lexicon data model. This includes checking for:
 * - Valid scalar types (number, string, boolean, null, Cid, Uint8Array)
 * - Arrays containing only valid LexValues
 * - Plain objects with string keys and valid LexValue values
 * - No cyclic references (which cannot be serialized to JSON or CBOR)
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid LexValue
 *
 * @example
 * ```typescript
 * import { isLexValue } from '@atproto/lex'
 *
 * isLexValue({ name: 'Alice', tags: ['admin'] })  // true
 * isLexValue(new Date())                           // false (not a plain object)
 * isLexValue({ fn: () => {} })                     // false (functions not allowed)
 * ```
 */
function isLexValue(value) {
    // Using a stack to avoid recursion depth issues.
    const stack = [value];
    // Cyclic structures are not valid LexValues as they cannot be serialized to
    // JSON or CBOR. This also allows us to avoid infinite loops when traversing
    // the structure.
    const visited = new Set();
    do {
        const value = stack.pop();
        if ((0, object_js_1.isPlainObject)(value)) {
            if (visited.has(value))
                return false;
            visited.add(value);
            stack.push(...Object.values(value));
        }
        else if (Array.isArray(value)) {
            if (visited.has(value))
                return false;
            visited.add(value);
            stack.push(...value);
        }
        else {
            if (!isLexScalar(value))
                return false;
        }
    } while (stack.length > 0);
    // Optimization: ease GC's work
    visited.clear();
    return true;
}
/**
 * Type guard to check if a value is a {@link TypedLexMap}.
 *
 * Returns true if the value is a valid {@link LexMap} with a non-empty
 * `$type` string property.
 *
 * @param value - The LexValue to check
 * @returns `true` if the value is a TypedLexMap
 *
 * @example
 * ```typescript
 * import { isTypedLexMap } from '@atproto/lex'
 *
 * const data = { $type: 'app.bsky.feed.post', text: 'Hello' }
 *
 * if (isTypedLexMap(data)) {
 *   console.log(data.$type)  // 'app.bsky.feed.post'
 * }
 * ```
 */
function isTypedLexMap(value) {
    return (isLexMap(value) && typeof value.$type === 'string' && value.$type.length > 0);
}
//# sourceMappingURL=lex.js.map
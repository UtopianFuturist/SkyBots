"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isHandleIdentifier = isHandleIdentifier;
exports.isDidIdentifier = isDidIdentifier;
exports.assertAtIdentifierString = assertAtIdentifierString;
exports.ensureValidAtIdentifier = assertAtIdentifierString;
exports.asAtIdentifierString = asAtIdentifierString;
exports.isAtIdentifierString = isAtIdentifierString;
exports.isValidAtIdentifier = isAtIdentifierString;
exports.ifAtIdentifierString = ifAtIdentifierString;
const did_js_1 = require("./did.js");
const handle_js_1 = require("./handle.js");
/**
 * Discriminates {@link HandleString} from a valid {@link AtIdentifierString}.
 *
 * @return `true` if the identifier is a handle, `false` otherwise
 */
function isHandleIdentifier(id) {
    return !isDidIdentifier(id);
}
/**
 * Discriminates {@link DidString} from a valid {@link AtIdentifierString}.
 *
 * @return `true` if the identifier is a DID, `false` otherwise
 */
function isDidIdentifier(id) {
    return id.startsWith('did:');
}
/**
 * Validates that a string is a valid {@link AtIdentifierString} format string,
 * throwing an error if it is not.
 *
 * @throws InvalidHandleError if the input string does not meet the atproto 'datetime' format requirements.
 * @see {@link AtIdentifierString}
 */
function assertAtIdentifierString(input) {
    try {
        if (!input || typeof input !== 'string') {
            throw new TypeError('Identifier must be a non-empty string');
        }
        else if (input.startsWith('did:')) {
            (0, did_js_1.ensureValidDidRegex)(input);
        }
        else {
            (0, handle_js_1.ensureValidHandleRegex)(input);
        }
    }
    catch (cause) {
        throw new handle_js_1.InvalidHandleError('Invalid DID or handle', { cause });
    }
}
/**
 * Casts a string to a {@link AtIdentifierString} if it is a valid at-identifier
 * string, throwing an error if it is not.
 *
 * @throws InvalidHandleError if the input string does not meet the atproto 'at-identifier' format requirements.
 * @see {@link AtIdentifierString}
 */
function asAtIdentifierString(input) {
    assertAtIdentifierString(input);
    return input;
}
/**
 * Type guard that checks if a value is a valid AT identifier (DID or handle).
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid AT identifier
 * @see {@link AtIdentifierString}
 */
function isAtIdentifierString(input) {
    if (!input || typeof input !== 'string') {
        return false;
    }
    else if (input.startsWith('did:')) {
        return (0, did_js_1.isValidDid)(input);
    }
    else {
        return (0, handle_js_1.isValidHandle)(input);
    }
}
/**
 * Returns the input if it is a valid {@link AtIdentifierString} format string, or
 * `undefined` if it is not.
 *
 * @see {@link AtIdentifierString}
 */
function ifAtIdentifierString(input) {
    return isAtIdentifierString(input) ? input : undefined;
}
//# sourceMappingURL=at-identifier.js.map
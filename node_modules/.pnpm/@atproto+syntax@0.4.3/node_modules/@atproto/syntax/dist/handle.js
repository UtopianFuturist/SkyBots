"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisallowedDomainError = exports.UnsupportedDomainError = exports.ReservedHandleError = exports.InvalidHandleError = exports.DISALLOWED_TLDS = exports.INVALID_HANDLE = void 0;
exports.ensureValidHandle = ensureValidHandle;
exports.ensureValidHandleRegex = ensureValidHandleRegex;
exports.normalizeHandle = normalizeHandle;
exports.normalizeAndEnsureValidHandle = normalizeAndEnsureValidHandle;
exports.isValidHandle = isValidHandle;
exports.isValidTld = isValidTld;
exports.INVALID_HANDLE = 'handle.invalid';
// Currently these are registration-time restrictions, not protocol-level
// restrictions. We have a couple accounts in the wild that we need to clean up
// before hard-disallow.
// See also: https://en.wikipedia.org/wiki/Top-level_domain#Reserved_domains
exports.DISALLOWED_TLDS = [
    '.local',
    '.arpa',
    '.invalid',
    '.localhost',
    '.internal',
    '.example',
    '.alt',
    // policy could concievably change on ".onion" some day
    '.onion',
    // NOTE: .test is allowed in testing and devopment. In practical terms
    // "should" "never" actually resolve and get registered in production
];
// Handle constraints, in English:
//  - must be a possible domain name
//    - RFC-1035 is commonly referenced, but has been updated. eg, RFC-3696,
//      section 2. and RFC-3986, section 3. can now have leading numbers (eg,
//      4chan.org)
//    - "labels" (sub-names) are made of ASCII letters, digits, hyphens
//    - can not start or end with a hyphen
//    - TLD (last component) should not start with a digit
//    - can't end with a hyphen (can end with digit)
//    - each segment must be between 1 and 63 characters (not including any periods)
//    - overall length can't be more than 253 characters
//    - separated by (ASCII) periods; does not start or end with period
//    - case insensitive
//    - domains (handles) are equal if they are the same lower-case
//    - punycode allowed for internationalization
//  - no whitespace, null bytes, joining chars, etc
//  - does not validate whether domain or TLD exists, or is a reserved or
//    special TLD (eg, .onion or .local)
//  - does not validate punycode
function ensureValidHandle(input) {
    // check that all chars are boring ASCII
    if (!/^[a-zA-Z0-9.-]*$/.test(input)) {
        throw new InvalidHandleError('Disallowed characters in handle (ASCII letters, digits, dashes, periods only)');
    }
    if (input.length > 253) {
        throw new InvalidHandleError('Handle is too long (253 chars max)');
    }
    const labels = input.split('.');
    if (labels.length < 2) {
        throw new InvalidHandleError('Handle domain needs at least two parts');
    }
    for (let i = 0; i < labels.length; i++) {
        const l = labels[i];
        if (l.length < 1) {
            throw new InvalidHandleError('Handle parts can not be empty');
        }
        if (l.length > 63) {
            throw new InvalidHandleError('Handle part too long (max 63 chars)');
        }
        if (l.endsWith('-') || l.startsWith('-')) {
            throw new InvalidHandleError('Handle parts can not start or end with hyphens');
        }
        if (i + 1 === labels.length && !/^[a-zA-Z]/.test(l)) {
            throw new InvalidHandleError('Handle final component (TLD) must start with ASCII letter');
        }
    }
}
// simple regex translation of above constraints
const HANDLE_REGEX = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
function ensureValidHandleRegex(input) {
    if (input.length > 253) {
        throw new InvalidHandleError('Handle is too long (253 chars max)');
    }
    if (!HANDLE_REGEX.test(input)) {
        throw new InvalidHandleError("Handle didn't validate via regex");
    }
}
function normalizeHandle(handle) {
    return handle.toLowerCase();
}
function normalizeAndEnsureValidHandle(handle) {
    const normalized = normalizeHandle(handle);
    ensureValidHandle(normalized);
    return normalized;
}
function isValidHandle(input) {
    return input.length <= 253 && HANDLE_REGEX.test(input);
}
function isValidTld(handle) {
    for (const tld of exports.DISALLOWED_TLDS) {
        if (handle.endsWith(tld)) {
            return false;
        }
    }
    return true;
}
class InvalidHandleError extends Error {
}
exports.InvalidHandleError = InvalidHandleError;
/** @deprecated Never used */
class ReservedHandleError extends Error {
}
exports.ReservedHandleError = ReservedHandleError;
/** @deprecated Never used */
class UnsupportedDomainError extends Error {
}
exports.UnsupportedDomainError = UnsupportedDomainError;
/** @deprecated Never used */
class DisallowedDomainError extends Error {
}
exports.DisallowedDomainError = DisallowedDomainError;
//# sourceMappingURL=handle.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidTidError = void 0;
exports.ensureValidTid = ensureValidTid;
exports.isValidTid = isValidTid;
const TID_LENGTH = 13;
const TID_REGEX = /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/;
function ensureValidTid(input) {
    if (input.length !== TID_LENGTH) {
        throw new InvalidTidError(`TID must be ${TID_LENGTH} characters`);
    }
    // simple regex to enforce most constraints via just regex and length.
    if (!TID_REGEX.test(input)) {
        throw new InvalidTidError('TID syntax not valid (regex)');
    }
}
function isValidTid(input) {
    return input.length === TID_LENGTH && TID_REGEX.test(input);
}
class InvalidTidError extends Error {
}
exports.InvalidTidError = InvalidTidError;
//# sourceMappingURL=tid.js.map
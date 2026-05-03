"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toKnownErr = toKnownErr;
exports.isVerificationInput = isVerificationInput;
exports.validateVerificationInput = validateVerificationInput;
exports.isGrantError = isGrantError;
exports.validateGrantError = validateGrantError;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'tools.ozone.verification.grantVerifications';
function toKnownErr(e) {
    return e;
}
const hashVerificationInput = 'verificationInput';
function isVerificationInput(v) {
    return is$typed(v, id, hashVerificationInput);
}
function validateVerificationInput(v) {
    return validate(v, id, hashVerificationInput);
}
const hashGrantError = 'grantError';
function isGrantError(v) {
    return is$typed(v, id, hashGrantError);
}
function validateGrantError(v) {
    return validate(v, id, hashGrantError);
}
//# sourceMappingURL=grantVerifications.js.map
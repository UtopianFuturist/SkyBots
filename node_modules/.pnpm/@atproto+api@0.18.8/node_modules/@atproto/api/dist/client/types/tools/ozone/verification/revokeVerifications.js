"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toKnownErr = toKnownErr;
exports.isRevokeError = isRevokeError;
exports.validateRevokeError = validateRevokeError;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'tools.ozone.verification.revokeVerifications';
function toKnownErr(e) {
    return e;
}
const hashRevokeError = 'revokeError';
function isRevokeError(v) {
    return is$typed(v, id, hashRevokeError);
}
function validateRevokeError(v) {
    return validate(v, id, hashRevokeError);
}
//# sourceMappingURL=revokeVerifications.js.map
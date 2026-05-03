"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toKnownErr = toKnownErr;
exports.isCancellationResults = isCancellationResults;
exports.validateCancellationResults = validateCancellationResults;
exports.isFailedCancellation = isFailedCancellation;
exports.validateFailedCancellation = validateFailedCancellation;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'tools.ozone.moderation.cancelScheduledActions';
function toKnownErr(e) {
    return e;
}
const hashCancellationResults = 'cancellationResults';
function isCancellationResults(v) {
    return is$typed(v, id, hashCancellationResults);
}
function validateCancellationResults(v) {
    return validate(v, id, hashCancellationResults);
}
const hashFailedCancellation = 'failedCancellation';
function isFailedCancellation(v) {
    return is$typed(v, id, hashFailedCancellation);
}
function validateFailedCancellation(v) {
    return validate(v, id, hashFailedCancellation);
}
//# sourceMappingURL=cancelScheduledActions.js.map
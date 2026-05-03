"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidEmailError = void 0;
exports.toKnownErr = toKnownErr;
exports.isResultAvailable = isResultAvailable;
exports.validateResultAvailable = validateResultAvailable;
exports.isResultUnavailable = isResultUnavailable;
exports.validateResultUnavailable = validateResultUnavailable;
exports.isSuggestion = isSuggestion;
exports.validateSuggestion = validateSuggestion;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'com.atproto.temp.checkHandleAvailability';
class InvalidEmailError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.InvalidEmailError = InvalidEmailError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'InvalidEmail')
            return new InvalidEmailError(e);
    }
    return e;
}
const hashResultAvailable = 'resultAvailable';
function isResultAvailable(v) {
    return is$typed(v, id, hashResultAvailable);
}
function validateResultAvailable(v) {
    return validate(v, id, hashResultAvailable);
}
const hashResultUnavailable = 'resultUnavailable';
function isResultUnavailable(v) {
    return is$typed(v, id, hashResultUnavailable);
}
function validateResultUnavailable(v) {
    return validate(v, id, hashResultUnavailable);
}
const hashSuggestion = 'suggestion';
function isSuggestion(v) {
    return is$typed(v, id, hashSuggestion);
}
function validateSuggestion(v) {
    return validate(v, id, hashSuggestion);
}
//# sourceMappingURL=checkHandleAvailability.js.map
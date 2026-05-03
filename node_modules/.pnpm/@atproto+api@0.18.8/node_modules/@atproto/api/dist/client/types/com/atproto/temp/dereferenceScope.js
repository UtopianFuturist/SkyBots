"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidScopeReferenceError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'com.atproto.temp.dereferenceScope';
class InvalidScopeReferenceError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.InvalidScopeReferenceError = InvalidScopeReferenceError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'InvalidScopeReference')
            return new InvalidScopeReferenceError(e);
    }
    return e;
}
//# sourceMappingURL=dereferenceScope.js.map
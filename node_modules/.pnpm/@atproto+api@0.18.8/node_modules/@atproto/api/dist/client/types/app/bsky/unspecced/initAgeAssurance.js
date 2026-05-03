"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidInitiationError = exports.DidTooLongError = exports.InvalidEmailError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'app.bsky.unspecced.initAgeAssurance';
class InvalidEmailError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.InvalidEmailError = InvalidEmailError;
class DidTooLongError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.DidTooLongError = DidTooLongError;
class InvalidInitiationError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.InvalidInitiationError = InvalidInitiationError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'InvalidEmail')
            return new InvalidEmailError(e);
        if (e.error === 'DidTooLong')
            return new DidTooLongError(e);
        if (e.error === 'InvalidInitiation')
            return new InvalidInitiationError(e);
    }
    return e;
}
//# sourceMappingURL=initAgeAssurance.js.map
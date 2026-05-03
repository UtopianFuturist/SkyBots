"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalError = exports.InvalidDidError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'app.bsky.contact.getSyncStatus';
class InvalidDidError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.InvalidDidError = InvalidDidError;
class InternalError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.InternalError = InternalError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'InvalidDid')
            return new InvalidDidError(e);
        if (e.error === 'InternalError')
            return new InternalError(e);
    }
    return e;
}
//# sourceMappingURL=getSyncStatus.js.map
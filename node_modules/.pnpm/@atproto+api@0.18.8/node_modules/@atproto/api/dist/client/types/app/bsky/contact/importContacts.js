"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalError = exports.InvalidTokenError = exports.TooManyContactsError = exports.InvalidContactsError = exports.InvalidDidError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'app.bsky.contact.importContacts';
class InvalidDidError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.InvalidDidError = InvalidDidError;
class InvalidContactsError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.InvalidContactsError = InvalidContactsError;
class TooManyContactsError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.TooManyContactsError = TooManyContactsError;
class InvalidTokenError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.InvalidTokenError = InvalidTokenError;
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
        if (e.error === 'InvalidContacts')
            return new InvalidContactsError(e);
        if (e.error === 'TooManyContacts')
            return new TooManyContactsError(e);
        if (e.error === 'InvalidToken')
            return new InvalidTokenError(e);
        if (e.error === 'InternalError')
            return new InternalError(e);
    }
    return e;
}
//# sourceMappingURL=importContacts.js.map
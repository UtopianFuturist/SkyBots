"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnsupportedCollectionError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'app.bsky.bookmark.createBookmark';
class UnsupportedCollectionError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.UnsupportedCollectionError = UnsupportedCollectionError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'UnsupportedCollection')
            return new UnsupportedCollectionError(e);
    }
    return e;
}
//# sourceMappingURL=createBookmark.js.map
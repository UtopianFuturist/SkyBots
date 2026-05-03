"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toKnownErr = toKnownErr;
exports.isThreadItem = isThreadItem;
exports.validateThreadItem = validateThreadItem;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'app.bsky.unspecced.getPostThreadV2';
function toKnownErr(e) {
    return e;
}
const hashThreadItem = 'threadItem';
function isThreadItem(v) {
    return is$typed(v, id, hashThreadItem);
}
function validateThreadItem(v) {
    return validate(v, id, hashThreadItem);
}
//# sourceMappingURL=getPostThreadV2.js.map
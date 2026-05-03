"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toKnownErr = toKnownErr;
exports.isHost = isHost;
exports.validateHost = validateHost;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'com.atproto.sync.listHosts';
function toKnownErr(e) {
    return e;
}
const hashHost = 'host';
function isHost(v) {
    return is$typed(v, id, hashHost);
}
function validateHost(v) {
    return validate(v, id, hashHost);
}
//# sourceMappingURL=listHosts.js.map
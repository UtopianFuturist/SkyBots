"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toKnownErr = toKnownErr;
exports.isLiveNowConfig = isLiveNowConfig;
exports.validateLiveNowConfig = validateLiveNowConfig;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'app.bsky.unspecced.getConfig';
function toKnownErr(e) {
    return e;
}
const hashLiveNowConfig = 'liveNowConfig';
function isLiveNowConfig(v) {
    return is$typed(v, id, hashLiveNowConfig);
}
function validateLiveNowConfig(v) {
    return validate(v, id, hashLiveNowConfig);
}
//# sourceMappingURL=getConfig.js.map
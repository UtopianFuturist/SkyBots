"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMain = isMain;
exports.isRecord = isMain;
exports.validateMain = validateMain;
exports.validateRecord = validateMain;
exports.isDisableRule = isDisableRule;
exports.validateDisableRule = validateDisableRule;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'app.bsky.feed.postgate';
const hashMain = 'main';
function isMain(v) {
    return is$typed(v, id, hashMain);
}
function validateMain(v) {
    return validate(v, id, hashMain, true);
}
const hashDisableRule = 'disableRule';
function isDisableRule(v) {
    return is$typed(v, id, hashDisableRule);
}
function validateDisableRule(v) {
    return validate(v, id, hashDisableRule);
}
//# sourceMappingURL=postgate.js.map